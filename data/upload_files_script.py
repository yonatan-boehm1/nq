import os
import duckdb
from dotenv import load_dotenv
from pathlib import Path


def upload_files():
    load_dotenv()

    DB_FILE = os.getenv("DB_PATH")

    con = duckdb.connect(DB_FILE)

    start = "2023-10-01"
    end = "2024-01-01"
    # 1. Point to your base directory shown in image_30e566.png
    base_dir = Path(f"./raw_seconds_{start}_{end}")

    # 2. 'rglob' finds every .parquet file in ALL subfolders recursively
    parquet_files = list(base_dir.rglob("*.parquet"))

    print(f"Total Parquet files found: {len(parquet_files)}")
    for parquet_file in parquet_files:
        print(f"Loading {parquet_file} into DuckDB...")
        con.execute(
            f"""
                INSERT OR REPLACE INTO nq_ohlcv 
                SELECT 
                    ts_event,
                    rtype,
                    publisher_id,
                    instrument_id,
                    open,
                    high,
                    low,
                    close,
                    volume,
                    symbol
                FROM read_parquet('{parquet_file}')
            """
        )

    # FIX 6: Add verification
    query = "SELECT COUNT(*) FROM nq_ohlcv WHERE ts_event BETWEEN ? AND ?"
    count = con.execute(query, [start, end]).fetchone()[0]
    print(f"Successfully loaded {count:,} trades into {DB_FILE}")
    con.close()


if __name__ == "__main__":
    upload_files()
