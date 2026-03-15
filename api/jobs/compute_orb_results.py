import itertools
from database import conn
from queries import ORB_COMBO_QUERY
from utils.metrics import find_biggest_drawdown
from models import ORBResult
from datetime import datetime
import numpy as np

TAKE_PROFITS = [round(x, 2) for x in np.arange(0.01, 1.01, 0.01)]
STOP_LOSSES  = [round(x, 2) for x in np.arange(0.01, 1.01, 0.01)]
START_DATE = '2023-08-01'
combinations = list(itertools.product(TAKE_PROFITS, STOP_LOSSES))

def run():
    print("Precomputing base tables...")
    
    conn.execute("""
        CREATE OR REPLACE TEMP TABLE t_raw_data AS
        SELECT 
            ts_event,
            ts_event::DATE AS trade_day,
            (ts_event AT TIME ZONE 'America/New_York')::TIME AS event_time_nyc,
            symbol,
            high,
            low,
            volume
        FROM main.nq_ohlcv
        WHERE ts_event >= $start_date
        AND symbol NOT LIKE '%-%'
    """, {"start_date": datetime.strptime(START_DATE, "%Y-%m-%d").date()})

    conn.execute("""
        CREATE OR REPLACE TEMP TABLE t_daily_lead AS
        SELECT trade_day, symbol
        FROM t_raw_data
        GROUP BY 1, 2
        QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day ORDER BY SUM(volume) DESC) = 1
    """)

    conn.execute("""
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
    """, {"range_start": "09:30", "range_end": "09:45"})

    print("Base tables ready.")

    combinations = list(itertools.product(TAKE_PROFITS, STOP_LOSSES))
    print(f"Running {len(combinations)} combinations...")

    for i, (take_profit, stop_loss) in enumerate(combinations):
        existing = conn.execute("""
            SELECT 1 FROM orb_results 
            WHERE take_profit = ? AND stop_loss = ?
        """, [take_profit, stop_loss]).fetchone()

        if existing:
            print(f"[{i+1}/{len(combinations)}] Skipping tp={take_profit} sl={stop_loss}")
            continue

        df = conn.execute(ORB_COMBO_QUERY, {
            "take_profit": take_profit,
            "stop_loss": stop_loss,
            "range_end": "09:45",
        }).df()

        trades = [ORBResult(**row) for row in df.to_dict(orient="records")]
        if not trades:
            continue

        total = len(trades)
        profits = sum(1 for t in trades if t.outcome == "PROFIT")
        stops = total - profits
        win_rate = (profits / total) * 100
        total_pnl = sum(t.trade_delta for t in trades)
        avg_pnl = total_pnl / total
        longs = sum(1 for t in trades if t.direction == "long")
        shorts = total - longs
        max_drawdown, drawdown_start, drawdown_end = find_biggest_drawdown(trades)

        conn.execute("""
            INSERT OR REPLACE INTO orb_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            take_profit, stop_loss,
            total, win_rate, total_pnl, avg_pnl,
            profits, stops, longs, shorts,
            max_drawdown, drawdown_start, drawdown_end
        ])

        print(f"[{i+1}/{len(combinations)}] tp={take_profit} sl={stop_loss} — {total} trades, wr={win_rate:.1f}%")

    print("Done.")

if __name__ == "__main__":
    run()