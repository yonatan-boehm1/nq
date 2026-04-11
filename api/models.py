from pydantic import BaseModel
from datetime import date, time
from typing import Literal, Optional


class ORBResult(BaseModel):
    trade_day: date
    trade_start_time: time
    trade_end_time: time
    direction: Literal["long", "short"]
    or_high: float
    or_low: float
    target_price: float
    stop_price: float
    outcome: Literal["PROFIT", "STOP", "MANUAL"]
    or_delta: float
    manual_close_price: float | None = None
    trade_delta: float | None = None


class ORBRequest(BaseModel):
    start_date: str = "2021-01-01"
    long_take_profit: float = 1.0
    long_stop_loss: float = 0.5
    short_take_profit: float = 1.0
    short_stop_loss: float = 0.5
    range_start: str = "09:30"
    range_end: str = "09:45"
    direction: Optional[Literal["long", "short"]] = None
    mode: Literal["fast", "accurate"] = "fast"

class FibRequest(BaseModel):
    start_date: str = "2021-01-01"
    long_entry_trigger: float = 0.618
    long_take_profit: float = 0.0
    long_stop_loss: float = 1.272
    short_entry_trigger: float = 0.618
    short_take_profit: float = 0.0
    short_stop_loss: float = 1.272
    range_start: str = "02:00:00"
    range_end: str = "09:00:00"
    direction: Optional[Literal["long", "short"]] = None
    min_or_delta: Optional[float] = None
    max_or_delta: Optional[float] = None

class ORBResultsRequest(BaseModel):
    take_profit_min: float = 0.01
    take_profit_max: float = 1.0
    stop_loss_min: float = 0.01
    stop_loss_max: float = 1.0
    max_drawdown: float = -3000.0
    min_trades: int = 0
    direction: Optional[Literal["long", "short"]] = None
    target_drawdown: float = 1000.0


Granularity = Literal["seconds", "minutes", "hours", "days", "weeks", "months"]
