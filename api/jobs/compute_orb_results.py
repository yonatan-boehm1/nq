import itertools
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import conn
from queries import ORB_COMBO_QUERY
from utils.metrics import find_biggest_drawdown_job
from models import ORBResult
from datetime import datetime
import numpy as np

VALUES     = [round(x, 2) for x in np.arange(0.5, 3.01, 0.05)]   # 51 values: 0.50, 0.55, ..., 3.00
DIRECTIONS = ["long", "short"]
START_DATE = "2021-02-01"


def run():
    print("Precomputing base tables...")

    # ── Seconds table (nq_ohlcv) — used for opening range precision ──────────
    conn.execute(
        """
        CREATE OR REPLACE TEMP TABLE t_raw_data AS
        SELECT 
            ts_event,
            ts_event::DATE AS trade_day,
            (ts_event AT TIME ZONE 'America/New_York')::TIME AS event_time_nyc,
            symbol,
            high,
            low,
            open,
            close,
            volume
        FROM main.nq_ohlcv
        WHERE ts_event >= $start_date
        AND symbol NOT LIKE '%-%'
    """,
        {"start_date": datetime.strptime(START_DATE, "%Y-%m-%d").date()},
    )

    # ── 1-minute table (nq_ohlcv_1m) — used for breach and exit scanning ─────
    conn.execute(
        """
        CREATE OR REPLACE TEMP TABLE t_fast_data AS
        SELECT 
            ts_event,
            ts_event::DATE AS trade_day,
            (ts_event AT TIME ZONE 'America/New_York')::TIME AS event_time_nyc,
            symbol,
            high,
            low,
            open,
            close,
            volume
        FROM main.nq_ohlcv_1m
        WHERE ts_event >= $start_date
    """,
        {"start_date": datetime.strptime(START_DATE, "%Y-%m-%d").date()},
    )

    # ── Daily lead contract (from 1m table) ───────────────────────────────────
    conn.execute(
        """
        CREATE OR REPLACE TEMP TABLE t_daily_lead AS
        SELECT trade_day, symbol
        FROM t_fast_data
        GROUP BY 1, 2
        QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day ORDER BY SUM(volume) DESC) = 1
    """
    )

    # ── Opening range from SECONDS data (high-precision candles) ──────────────
    conn.execute(
        """
        CREATE OR REPLACE TEMP TABLE t_opening_range AS
        SELECT 
            r.trade_day,
            r.symbol,
            MAX(r.high) AS or_high,
            MIN(r.low) AS or_low,
            (MAX(r.high) - MIN(r.low)) AS or_delta
        FROM t_raw_data r
        JOIN t_daily_lead dl ON r.trade_day = dl.trade_day AND r.symbol = dl.symbol
        WHERE r.event_time_nyc BETWEEN $range_start AND $range_end
        GROUP BY 1, 2
    """,
        {"range_start": "09:30", "range_end": "09:45"},
    )

    # ── Last candle from 1m data ───────────────────────────────────────────────
    conn.execute(
        """
        CREATE OR REPLACE TEMP TABLE t_last_candle AS
        SELECT
            trade_day,
            symbol,
            close AS last_close,
            event_time_nyc AS last_time
        FROM t_fast_data
        QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day, symbol ORDER BY ts_event DESC) = 1
    """
    )

    # ── Recreate results table with direction column ───────────────────────────
    conn.execute("""
        CREATE OR REPLACE TABLE orb_results (
            take_profit    DOUBLE,
            stop_loss      DOUBLE,
            direction      VARCHAR,
            total_trades   INTEGER,
            win_rate       DOUBLE,
            total_pnl      DOUBLE,
            avg_pnl        DOUBLE,
            profits        INTEGER,
            stops          INTEGER,
            max_drawdown   DOUBLE,
            drawdown_start VARCHAR,
            drawdown_end   VARCHAR,
            PRIMARY KEY (take_profit, stop_loss, direction)
        )
    """)

    print("Base tables ready.")

    combinations = list(itertools.product(VALUES, VALUES, DIRECTIONS))
    total_combos = len(combinations)
    print(f"Running {total_combos} combinations ({len(VALUES)}×{len(VALUES)}×2)...")

    for i, (take_profit, stop_loss, direction) in enumerate(combinations):
        df = conn.execute(
            ORB_COMBO_QUERY,
            {
                "long_take_profit":  take_profit if direction == "long"  else 1.0,
                "long_stop_loss":    stop_loss   if direction == "long"  else 1.0,
                "short_take_profit": take_profit if direction == "short" else 1.0,
                "short_stop_loss":   stop_loss   if direction == "short" else 1.0,
                "range_end":         "09:45",
                "direction":         direction,
            },
        ).df()

        trades = [ORBResult(**row) for row in df.to_dict(orient="records")]
        if not trades:
            continue

        total     = len(trades)
        profits   = sum(1 for t in trades if t.trade_delta is not None and t.trade_delta >= 0)
        stops_    = sum(1 for t in trades if t.trade_delta is not None and t.trade_delta < 0)
        win_rate  = (profits / total) * 100
        total_pnl = sum(t.trade_delta for t in trades if t.trade_delta is not None)
        avg_pnl   = total_pnl / total
        max_drawdown, drawdown_start, drawdown_end = find_biggest_drawdown_job(trades)

        conn.execute(
            """
            INSERT OR REPLACE INTO orb_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            [
                take_profit,
                stop_loss,
                direction,
                total,
                win_rate,
                total_pnl,
                avg_pnl,
                profits,
                stops_,
                max_drawdown,
                drawdown_start,
                drawdown_end,
            ],
        )

        if (i + 1) % 100 == 0 or i == total_combos - 1:
            print(
                f"[{i+1}/{total_combos}] tp={take_profit} sl={stop_loss} dir={direction} "
                f"— {total} trades, wr={win_rate:.1f}%"
            )

    print("Done.")


if __name__ == "__main__":
    run()
