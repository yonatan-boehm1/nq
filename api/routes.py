from datetime import datetime
from fastapi import APIRouter
from models import Granularity, ORBRequest, ORBResultsRequest
from utils.metrics import find_biggest_drawdown, timer
from queries import ORB_QUERY
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
    res = conn.execute(ORB_QUERY, params).df()
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
        SELECT * FROM orb_results
        WHERE max_drawdown >= $max_drawdown
        AND total_trades >= $min_trades
        ORDER BY avg_pnl DESC
        LIMIT 100;
    """,
        {"max_drawdown": request.max_drawdown, "min_trades": request.min_trades},
    ).df()
    return df.to_dict(orient="records")
