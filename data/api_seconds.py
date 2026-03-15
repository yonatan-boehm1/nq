import databento as db
import duckdb
import time
import pathlib
from dotenv import load_dotenv
import os

# --- CONFIGURATION ---
load_dotenv()

DB_FILE = os.getenv("DB_PATH")
api_key = os.getenv("API_KEY")

dataset = "GLBX.MDP3"
symbols = ["NQ.FUT"]
schema = "ohlcv-1s"
stype_in = "parent"
start = "2021-02-01T00:00:00"
end = "2021-02-05T00:00:00"

client = db.Historical(api_key)


def pull_and_ingest_trades():
    # 1. Submit Batch Job (Settled on 'trades' for $0.50/GB)
    job = client.batch.submit_job(
        dataset=dataset,
        symbols=symbols,
        schema=schema,
        start=start,
        end=end,
        encoding="dbn",
        stype_in=stype_in,
    )
    job_id = job["id"]
    print(f"Job {job_id} submitted for 'seconds' schema. Waiting...")

    # 2. Wait for completion

    while True:
        jobs = client.batch.list_jobs()
        status = next((job["state"] for job in jobs if job["id"] == job_id), None)

        if status == "done":
            break
        elif status in ["error", "expired"]:
            raise Exception(f"Job {job_id} failed: {status}")

        print(f"Status: {status}")
        time.sleep(30)

    # 3. Download
    output_dir = pathlib.Path(f"raw_seconds_{start[:10]}_{end[:10]}")
    output_dir.mkdir(exist_ok=True)
    files = client.batch.download(job_id=job_id, output_dir=output_dir)

    # 4. Ingest into DuckDB
    parquet_files = []
    for dbn_file in filter(lambda x: x.name.endswith(".dbn.zst"), files):
        print(f"Converting {dbn_file}...")
        # Read DBN file
        store = db.DBNStore.from_file(dbn_file)

        parquet_path = dbn_file.with_suffix(".parquet")
        store.to_parquet(parquet_path)
        parquet_files.append(parquet_path)

    con = duckdb.connect(DB_FILE)

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
    pull_and_ingest_trades()
