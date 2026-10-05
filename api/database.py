import duckdb
from dotenv import load_dotenv
import os

load_dotenv()

# A local file path, or "md:<database>" for MotherDuck (reads MOTHERDUCK_TOKEN from the environment)
DB_FILE = os.getenv("DB_PATH")

conn = duckdb.connect(DB_FILE, read_only=True)

# The queries split trading days with ts_event::DATE, which follows the session time zone.
# Pin it so a server running in UTC gives the same results as a machine in Israel.
conn.execute("SET TimeZone = 'Asia/Jerusalem'")
