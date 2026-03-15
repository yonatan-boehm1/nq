from pydantic import BaseModel
from datetime import date, time
from typing import Literal


class ORBResult(BaseModel):
    trade_day: date
    trade_start_time: time
    trade_end_time: time
    direction: Literal["long", "short"]
    or_high: float
    or_low: float
    target_price: float
    stop_price: float
    outcome: Literal["PROFIT", "STOP"]
    or_delta: float
    trade_delta: float


class ORBRequest(BaseModel):
    start_date: str = "2021-01-01"
    take_profit: float = 1.0
    stop_loss: float = 0.5
    range_start: str = "09:30"
    range_end: str = "09:45"

class ORBResultsRequest(BaseModel):
    take_profit_min: float = 0.01
    take_profit_max: float = 1.0
    stop_loss_min: float = 0.01
    stop_loss_max: float = 1.0
    max_drawdown: float = -3000.0
    min_trades: int = 0

Granularity = Literal["seconds", "minutes", "hours", "days", "weeks", "months"]
