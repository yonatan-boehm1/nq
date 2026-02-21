from fastapi import FastAPI
import uvicorn
import datetime
from pydantic import BaseModel

class Request(BaseModel):
    timezone: datetime.timezone
    range_hour_start: datetime.time
    range_hour_end: datetime.time
    

app = FastAPI()

@app.get("/")
def hello_world():
    return {"message": "Hello World"}

@app.get("/date-range")
def get_items(start: datetime.datetime = None, end: datetime.datetime = None):
    return {"start": start, "end": end}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)