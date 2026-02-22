from fastapi import APIRouter
from pydantic import BaseModel
from queries import ORB_QUERY
from database import conn

class ORBRequest(BaseModel):
    take_profit: float = 1.0
    stop_loss: float = 0.5
    start_date: str = '2023-08-01'

router = APIRouter()

@router.get("/")
def hello_world():
    return {"message": "Hello World"}

@router.get("/date-range")
def get_items(start: str = None, end: str = None):
    return {"start": start, "end": end}

@router.post('/backtest/orb')
def get_orb_backtest(request: ORBRequest):
    params = {
        'take_profit': float(request.take_profit),
        'stop_loss': float(request.stop_loss),
        'start_date': str(request.start_date) 
    }
    res = conn.execute(ORB_QUERY, params).df()
    return res.to_dict(orient='records')