import os
from dotenv import load_dotenv
import databento as db
import duckdb
import pandas as pd

load_dotenv()
api_key = os.getenv("API_KEY")
dataset = ("GLBX.MDP3",)
symbols = (["NQ.FUT"],)
schema = ("trades",)
stype_in = ("parent",)
start = ("2022-06-02T14:00:00",)
end = ("2022-06-02T14:01:00",)

client = db.Historical(api_key)
data = client.timeseries.get_range()

data.to_csv("./data1.csv")
