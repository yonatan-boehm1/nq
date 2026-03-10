from models import ORBResult
from datetime import datetime
import pytz


def find_biggest_drawdown(data: list[ORBResult]) -> float:
    drawdown = 0
    max_drawdown = 0
    print(data[0]["trade_day"])
    current_start = data[0]["trade_day"]
    drawdown_start, drawdown_end = data[0]["trade_day"], data[0]["trade_day"]
    for trade in data:
        if trade["trade_delta"] < 0:
            drawdown += trade["trade_delta"]
        else:
            drawdown = drawdown + trade["trade_delta"]
            if drawdown >= 0:
                drawdown = 0
                current_start = trade["trade_day"]
        if drawdown < max_drawdown:
            max_drawdown = drawdown
            drawdown_end = trade["trade_day"]
            drawdown_start = current_start
    return max_drawdown, str(drawdown_start)[:10], str(drawdown_end)[:10]
