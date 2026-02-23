from pydantic import BaseModel
from datetime import date, time
from typing import Literal


class ORBResult(BaseModel):
    trade_day: date
    trade_start_time: time
    trade_end_time: time
    trade_time_elapsed: float
    direction: Literal["long", "short"]
    or_high: float
    or_low: float
    target_price: float
    stop_price: float
    outcome: Literal["PROFIT", "STOP"]
    or_delta: float
    trade_delta: float

class ORBRequest(BaseModel):
    start_date: str = "2023-01-01"
    take_profit: float = 1.0
    stop_loss: float = 0.5
    range_start: str = "09:30"
    range_end: str = "09:45"