from datetime import datetime
from fastapi import APIRouter, Query
from models import Granularity, ORBRequest, ORBResultsRequest, FibRequest
from utils.metrics import find_biggest_drawdown, timer
from queries import ORB_FAST,ORB_ACCURATE , FIB_QUERY, CHART_QUERY
from database import conn

router = APIRouter()


@router.get("/")
def hello_world():
    return {"message": "Hello World"}


@router.get("/date-range")
def get_items(start: str = None, end: str = None, granularity: Granularity = "seconds"):
    res = conn.execute()
    return {"start": start, "end": end}


@router.post("/backtest/orb")
@timer
def get_orb_backtest(request: ORBRequest):
    params = {
        "long_take_profit": float(request.long_take_profit),
        "long_stop_loss": float(request.long_stop_loss),
        "short_take_profit": float(request.short_take_profit),
        "short_stop_loss": float(request.short_stop_loss),
        "start_date": datetime.strptime(str(request.start_date), "%Y-%m-%d").date(),
        "range_start": request.range_start,
        "range_end": request.range_end,
        "direction": request.direction
    }
    query = ORB_ACCURATE if request.mode == "accurate" else ORB_FAST
    res = conn.execute(query, params).df()
    res = res.fillna("")
    data = res.to_dict(orient="records")
    biggest_drawdown, drawdown_start, drawdown_end = find_biggest_drawdown(data)
    return {
        "trades": data,
        "biggest_drawdown": biggest_drawdown,
        "drawdown_start": drawdown_start,
        "drawdown_end": drawdown_end,
    }


@router.post("/backtest/fib")
@timer
def get_fib_backtest(request: FibRequest):
    params = {
        "start_date": datetime.strptime(str(request.start_date), "%Y-%m-%d").date(),
        "long_entry_trigger": float(request.long_entry_trigger),
        "long_take_profit": float(request.long_take_profit),
        "long_stop_loss": float(request.long_stop_loss),
        "short_entry_trigger": float(request.short_entry_trigger),
        "short_take_profit": float(request.short_take_profit),
        "short_stop_loss": float(request.short_stop_loss),
        "range_start": request.range_start,
        "range_end": request.range_end,
        "min_or_delta": float(request.min_or_delta) if request.min_or_delta is not None else None,
        "max_or_delta": float(request.max_or_delta) if request.max_or_delta is not None else None,
    }
    res = conn.execute(FIB_QUERY, params).df()
    res = res.fillna("")
    data = res.to_dict(orient="records")
    biggest_drawdown, drawdown_start, drawdown_end = find_biggest_drawdown(data)
    return {
        "trades": data,
        "biggest_drawdown": biggest_drawdown,
        "drawdown_start": drawdown_start,
        "drawdown_end": drawdown_end,
    }


@router.post("/results/orb")
def get_orb_results(request: ORBResultsRequest):
    df = conn.execute(
        """
        SELECT *,
               CASE 
                   WHEN max_drawdown < 0 THEN (total_pnl / ABS(max_drawdown)) * $target_drawdown 
                   ELSE total_pnl 
               END AS scaled_pnl
        FROM orb_results
        WHERE max_drawdown >= $max_drawdown
        AND total_trades >= $min_trades
        AND ($direction IS NULL OR direction = $direction)
        ORDER BY scaled_pnl DESC;
    """,
        {
            "max_drawdown": request.max_drawdown, 
            "min_trades": request.min_trades, 
            "direction": request.direction,
            "target_drawdown": request.target_drawdown
        },
    ).df()
    return df.to_dict(orient="records")


@router.get("/chart")
@timer
def get_chart_data(
    start: str = Query(..., description="Start datetime, e.g. 2024-01-02T09:30"),
    end: str = Query(..., description="End datetime, e.g. 2024-01-02T16:00"),
    granularity: str = Query("1 minute", description="DuckDB interval string: '1 minute', '5 minutes', '1 hour', etc."),
):
    """Return OHLCV candles for the highest-volume contract in the requested range, bucketed to the given granularity."""
    VALID = {
        "1m":  "1 minute",
        "5m":  "5 minutes",
        "15m": "15 minutes",
        "30m": "30 minutes",
        "1h":  "1 hour",
        "4h":  "4 hours",
        "1d":  "1 day",
    }
    interval = VALID.get(granularity, granularity)  # accept shorthand or raw interval
    df = conn.execute(
        CHART_QUERY,
        {"start": start, "end": end, "interval": interval},
    ).df()
    df = df.fillna("")
    return df.to_dict(orient="records")
