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
