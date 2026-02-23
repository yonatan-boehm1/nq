import duckdb
from dotenv import load_dotenv
import os

load_dotenv()

DB_FILE = os.getenv("DB_PATH")

conn = duckdb.connect(DB_FILE, read_only=True)
