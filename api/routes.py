from datetime import datetime
from fastapi import APIRouter
from models import Granularity, ORBRequest
from utils.metrics import find_biggest_drawdown
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
def get_orb_backtest(request: ORBRequest):
    params = {
        "take_profit": float(request.take_profit),
        "stop_loss": float(request.stop_loss),
        "start_date": datetime.strptime(str(request.start_date), "%Y-%m-%d").date(),
        "range_start": request.range_start,
        "range_end": request.range_end,  
    }
    res = conn.execute(ORB_QUERY, params).df()
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
    df = conn.execute("""
        SELECT * FROM orb_results
        WHERE take_profit >= $take_profit_min
        AND take_profit <= $take_profit_max
        AND stop_loss >= $stop_loss_min
        AND stop_loss <= $stop_loss_max
        AND max_drawdown >= $max_drawdown
        AND total_trades >= $min_trades
        ORDER BY trade_day ASC
    """, {
        "take_profit_min": request.take_profit_min,
        "take_profit_max": request.take_profit_max,
        "stop_loss_min": request.stop_loss_min,
        "stop_loss_max": request.stop_loss_max,
        "max_drawdown": request.max_drawdown,
        "min_trades": request.min_trades
    }).df()
    return df.to_dict(orient="records")
