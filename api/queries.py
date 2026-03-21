# Step 1: filter raw data to relevant date range
# Step 2: find the lead contract by daily volume
# Step 3: calculate the opening range (16:30-16:45)
# Step 4: detect first breach and compute targets
# Step 5: find trade outcome (profit or stop)

ORB_QUERY = """
WITH 
raw_data AS (
    SELECT 
        ts_event,
        ts_event::DATE AS trade_day,
        symbol,
        open,
        high,
        low,
        volume
    FROM main.nq_ohlcv
    WHERE ts_event >= $start_date
    AND symbol NOT LIKE '%-%'
),
last_candle AS (
    SELECT
        trade_day,
        symbol,
        open AS last_open,
        (ts_event AT TIME ZONE 'America/New_York')::TIME AS last_time
    FROM raw_data
    QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day, symbol ORDER BY ts_event DESC) = 1
),
daily_lead AS (
    SELECT 
        trade_day,
        symbol
    FROM raw_data
    GROUP BY 1, 2
    QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day ORDER BY SUM(volume) DESC) = 1
),
opening_range AS (
    SELECT 
        r.trade_day,
        r.symbol,
        MAX(r.high) AS or_high,
        MIN(r.low) AS or_low,
        (MAX(r.high) - MIN(r.low)) AS or_delta
    FROM raw_data r
    JOIN daily_lead dl ON r.trade_day = dl.trade_day AND r.symbol = dl.symbol
    WHERE (r.ts_event AT TIME ZONE 'America/New_York')::TIME BETWEEN $range_start AND $range_end
    GROUP BY 1, 2
),
first_breach AS (
    SELECT
        o.*,
        r.trade_day,
        r.ts_event AS breach_ts,
        r.symbol,
        CASE 
            WHEN r.high >= o.or_high THEN 'long'
            ELSE 'short'
        END AS direction,
        CASE WHEN r.high >= o.or_high THEN (o.or_high + $long_take_profit * o.or_delta) ELSE (o.or_low - $short_take_profit * o.or_delta) END AS target_price,
        CASE WHEN r.high >= o.or_high THEN (o.or_high - ($long_stop_loss * o.or_delta)) ELSE (o.or_low + ($short_stop_loss * o.or_delta)) END AS stop_price       
    FROM raw_data r
    JOIN opening_range o ON r.trade_day = o.trade_day AND r.symbol = o.symbol
    WHERE (r.ts_event AT TIME ZONE 'America/New_York')::TIME >= $range_end
    AND (r.high >= o.or_high OR r.low <= o.or_low)
    QUALIFY ROW_NUMBER() OVER(PARTITION BY r.trade_day ORDER BY (r.ts_event AT TIME ZONE 'America/New_York')::TIME ASC) = 1
),
closed_trades AS (
    SELECT 
        fb.trade_day,
        fb.symbol,
        (fb.breach_ts AT TIME ZONE 'America/New_York')::TIME AS trade_start_time,
        (r.ts_event AT TIME ZONE 'America/New_York')::TIME AS trade_end_time,
        fb.direction,
        fb.or_high,
        fb.or_low,
        fb.target_price,
        fb.stop_price,
        CASE 
            WHEN fb.direction = 'long' AND r.high >= fb.target_price THEN 'PROFIT'
            WHEN fb.direction = 'long' AND r.low <= fb.stop_price THEN 'STOP'
            WHEN fb.direction = 'short' AND r.low <= fb.target_price THEN 'PROFIT'
            WHEN fb.direction = 'short' AND r.high >= fb.stop_price THEN 'STOP'
        END AS outcome,
        fb.or_delta
    FROM raw_data r
    JOIN first_breach fb 
    ON r.trade_day = fb.trade_day
    AND r.symbol = fb.symbol
    WHERE r.ts_event > fb.breach_ts
    AND (
        (fb.direction = 'long' AND (r.high >= fb.target_price OR r.low <= fb.stop_price))
        OR 
        (fb.direction = 'short' AND (r.low <= fb.target_price OR r.high >= fb.stop_price))
    )
    QUALIFY ROW_NUMBER() OVER(PARTITION BY r.trade_day ORDER BY r.ts_event ASC) = 1
),
manual_trades AS (
    SELECT
        fb.trade_day,
        fb.symbol,
        (fb.breach_ts AT TIME ZONE 'America/New_York')::TIME AS trade_start_time,
        lc.last_time AS trade_end_time,
        fb.direction,
        fb.or_high,
        fb.or_low,
        fb.target_price,
        fb.stop_price,
        'MANUAL' AS outcome,
        fb.or_delta
    FROM first_breach fb
    JOIN last_candle lc ON fb.trade_day = lc.trade_day AND fb.symbol = lc.symbol
    WHERE NOT EXISTS (
        SELECT 1 FROM raw_data r
        WHERE r.trade_day = fb.trade_day
        AND r.symbol = fb.symbol
        AND r.ts_event > fb.breach_ts
        AND (
            (fb.direction = 'long' AND (r.high >= fb.target_price OR r.low <= fb.stop_price))
            OR 
            (fb.direction = 'short' AND (r.low <= fb.target_price OR r.high >= fb.stop_price))
        )
    )
),
final_outcome AS (
    SELECT * FROM closed_trades
    UNION ALL
    SELECT * FROM manual_trades
)
SELECT 
    fo.*,
    CASE WHEN fo.outcome = 'MANUAL' THEN lc.last_open ELSE NULL END AS manual_close_price,
    CASE 
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'long'  THEN -($long_stop_loss  * fo.or_delta)
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'short' THEN -($short_stop_loss * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'long'  THEN ($long_take_profit  * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'short' THEN ($short_take_profit * fo.or_delta)
        WHEN fo.direction = 'long'  THEN lc.last_open - fo.or_high
        WHEN fo.direction = 'short' THEN fo.or_low - lc.last_open
    END AS trade_delta
FROM final_outcome fo
LEFT JOIN last_candle lc ON fo.trade_day = lc.trade_day AND fo.symbol = lc.symbol
WHERE ($direction IS NULL OR fo.direction = $direction) 
ORDER BY fo.trade_day;"""

ORB_COMBO_QUERY = """
WITH first_breach AS (
    SELECT
        o.trade_day,
        o.symbol,
        o.or_high,
        o.or_low,
        o.or_delta,
        r.ts_event AS breach_ts,
        r.event_time_nyc AS breach_time_nyc,
        CASE 
            WHEN r.high >= o.or_high THEN 'long'
            ELSE 'short'
        END AS direction,
        CASE WHEN r.high >= o.or_high 
            THEN (o.or_high + $take_profit * o.or_delta) 
            ELSE (o.or_low - $take_profit * o.or_delta) 
        END AS target_price,
        CASE WHEN r.high >= o.or_high 
            THEN (o.or_high - ($stop_loss * o.or_delta)) 
            ELSE (o.or_low + ($stop_loss * o.or_delta)) 
        END AS stop_price       
    FROM t_raw_data r
    JOIN t_opening_range o ON r.trade_day = o.trade_day AND r.symbol = o.symbol
    WHERE r.event_time_nyc >= $range_end
    AND (r.high >= o.or_high OR r.low <= o.or_low)
    QUALIFY ROW_NUMBER() OVER(PARTITION BY r.trade_day ORDER BY r.event_time_nyc ASC) = 1
),
closed_trades AS (
    SELECT 
        fb.trade_day,
        fb.symbol,
        fb.breach_time_nyc AS trade_start_time,
        r.event_time_nyc AS trade_end_time,
        fb.direction,
        fb.or_high,
        fb.or_low,
        fb.target_price,
        fb.stop_price,
        CASE 
            WHEN fb.direction = 'long' AND r.high >= fb.target_price THEN 'PROFIT'
            WHEN fb.direction = 'long' AND r.low <= fb.stop_price THEN 'STOP'
            WHEN fb.direction = 'short' AND r.low <= fb.target_price THEN 'PROFIT'
            WHEN fb.direction = 'short' AND r.high >= fb.stop_price THEN 'STOP'
        END AS outcome,
        fb.or_delta
    FROM t_raw_data r
    JOIN first_breach fb ON r.trade_day = fb.trade_day AND r.symbol = fb.symbol
    WHERE r.ts_event > fb.breach_ts
    AND (
        (fb.direction = 'long' AND (r.high >= fb.target_price OR r.low <= fb.stop_price))
        OR 
        (fb.direction = 'short' AND (r.low <= fb.target_price OR r.high >= fb.stop_price))
    )
    QUALIFY ROW_NUMBER() OVER(PARTITION BY r.trade_day ORDER BY r.ts_event ASC) = 1
),
manual_trades AS (
    SELECT
        fb.trade_day,
        fb.symbol,
        fb.breach_time_nyc AS trade_start_time,
        lc.last_time AS trade_end_time,
        fb.direction,
        fb.or_high,
        fb.or_low,
        fb.target_price,
        fb.stop_price,
        'MANUAL' AS outcome,
        fb.or_delta
    FROM first_breach fb
    JOIN t_last_candle lc ON fb.trade_day = lc.trade_day AND fb.symbol = lc.symbol
    WHERE NOT EXISTS (
        SELECT 1 FROM t_raw_data r
        WHERE r.trade_day = fb.trade_day
        AND r.symbol = fb.symbol
        AND r.ts_event > fb.breach_ts
        AND (
            (fb.direction = 'long' AND (r.high >= fb.target_price OR r.low <= fb.stop_price))
            OR 
            (fb.direction = 'short' AND (r.low <= fb.target_price OR r.high >= fb.stop_price))
        )
    )
),
final_outcome AS (
    SELECT * FROM closed_trades
    UNION ALL
    SELECT * FROM manual_trades
)
SELECT 
    fo.*,
    CASE WHEN fo.outcome = 'MANUAL' THEN lc.last_open ELSE NULL END AS manual_close_price,
    CASE 
        WHEN fo.outcome = 'STOP'   THEN -($stop_loss * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' THEN ($take_profit * fo.or_delta)
        WHEN fo.direction = 'long'  THEN lc.last_open - fo.or_high
        WHEN fo.direction = 'short' THEN fo.or_low - lc.last_open
    END AS trade_delta
FROM final_outcome fo
LEFT JOIN t_last_candle lc ON fo.trade_day = lc.trade_day AND fo.symbol = lc.symbol
ORDER BY fo.trade_day;
"""
