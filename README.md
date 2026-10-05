# NQ Backtester

A backtesting tool for intraday strategies on Nasdaq-100 E-mini futures (NQ). It runs over five years of one-second price data. You set a strategy's parameters in the browser, and a FastAPI backend runs the whole backtest as a single DuckDB SQL query. The results page shows the trade log, P&L, win rate and max drawdown.

![ORB backtest results](docs/screenshot.png)

## Features

- **ORB Backtest**: Opening Range Breakout. You set the range window, plus separate take-profit and stop-loss multiples for longs and shorts, and can filter by direction. There are two modes:
  - *fast*: builds the range from 1-second bars and looks for entries and exits on 1-minute bars.
  - *accurate*: uses 1-second bars for everything.
  Trades that hit neither target close at the session's last price.
- **Results**: a precomputed grid of 5,202 take-profit/stop-loss/direction combinations. You can filter by max drawdown and minimum trade count, and rank by P&L scaled to a target drawdown.
- **Fibonacci**: a retracement entry strategy based on an overnight range.
- **Chart**: candlesticks of the highest-volume contract for any time range, in 1m to 1d buckets.

## Stack

| Layer    | Tech |
|----------|------|
| Data     | [Databento](https://databento.com) (CME Globex `GLBX.MDP3`, `ohlcv-1s`), Parquet |
| Storage  | DuckDB |
| Backend  | Python 3.11, FastAPI, Uvicorn |
| Frontend | React 19, TypeScript, Vite, styled-components, React Router |

## Dataset

| Table          | Rows       | Description |
|----------------|-----------:|-------------|
| `nq_ohlcv`     | 67.7M      | 1-second OHLCV bars for all NQ contracts |
| `nq_ohlcv_1m`  | 2.6M       | 1-minute bars, used by the fast mode and the chart |
| `orb_results`  | 5,202      | Precomputed ORB parameter grid |

The data covers Feb 2021 to Feb 2026, about 1,300 trading days. The DuckDB file is about 4.6 GB, so it isn't committed. Raw Databento downloads are gitignored too.

## Project layout

```
api/            FastAPI app
  queries.py      backtest SQL (ORB fast/accurate, Fibonacci, chart)
  routes.py       endpoints: /backtest/orb, /backtest/fib, /results/orb, /chart
  jobs/           batch job that fills orb_results
data/           scripts that pull data from Databento and load it into DuckDB
frontend/       React app
```

## Running locally

**Requirements:** Python 3.11, Node 20+, and a DuckDB file with the tables above. A Databento API key is needed only to pull new data.

Create a `.env` file in the repo root:

```
DB_PATH=/absolute/path/to/nq.db
# Databento key, only needed for the data/ scripts
API_KEY=your-databento-key
```

**Backend** (http://localhost:8000):

```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd api
uvicorn main:app --reload --port 8000
```

**Frontend** (http://localhost:5173):

```bash
npm install          # repo root: installs axios, which the frontend uses
cd frontend
npm install
npm run dev
```

**Loading data:** `data/api_seconds.py` submits a Databento batch job for the date range set at the top of the file. It downloads the DBN files, converts them to Parquet and inserts them into `nq_ohlcv`.
