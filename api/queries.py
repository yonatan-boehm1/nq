# Step 1: filter raw data to relevant date range
# Step 2: find the lead contract by daily volume
# Step 3: calculate the opening range (16:30-16:45)
# Step 4: detect first breach and compute targets
# Step 5: find trade outcome (profit or stop)

ORB_ACCURATE = """
WITH 
raw_data AS (
    SELECT 
        ts_event,
        ts_event::DATE AS trade_day,
        symbol,
        open,
        high,
        close,
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
        close AS last_close,
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
    CASE WHEN fo.outcome = 'MANUAL' THEN lc.last_close ELSE NULL END AS manual_close_price,
    CASE 
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'long'  THEN -($long_stop_loss  * fo.or_delta)
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'short' THEN -($short_stop_loss * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'long'  THEN ($long_take_profit  * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'short' THEN ($short_take_profit * fo.or_delta)
        WHEN fo.direction = 'long'  THEN lc.last_close - fo.or_high
        WHEN fo.direction = 'short' THEN fo.or_low - lc.last_close
    END AS trade_delta
FROM final_outcome fo
LEFT JOIN last_candle lc ON fo.trade_day = lc.trade_day AND fo.symbol = lc.symbol
WHERE ($direction IS NULL OR fo.direction = $direction) 
ORDER BY fo.trade_day;"""

ORB_FAST = """
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
fast_data AS (
    SELECT 
        ts_event,
        ts_event::DATE AS trade_day,
        symbol,
        volume,
        open,
        high,
        close,
        low
    FROM main.nq_ohlcv_1m
    WHERE ts_event >= $start_date
),
last_candle AS (
    SELECT
        trade_day,
        symbol,
        close AS last_close,
        (ts_event AT TIME ZONE 'America/New_York')::TIME AS last_time
    FROM fast_data
    QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day, symbol ORDER BY ts_event DESC) = 1
),
daily_lead AS (
    SELECT 
        trade_day,
        symbol
    FROM fast_data
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
    WHERE (r.ts_event AT TIME ZONE 'America/New_York')::TIME >= $range_start 
      AND (r.ts_event AT TIME ZONE 'America/New_York')::TIME <= $range_end
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
    FROM fast_data r
    JOIN first_breach fb 
    ON r.trade_day = fb.trade_day
    AND r.symbol = fb.symbol
    WHERE r.ts_event >= fb.breach_ts
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
        SELECT 1 FROM fast_data r
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
    CASE WHEN fo.outcome = 'MANUAL' THEN lc.last_close ELSE NULL END AS manual_close_price,
    CASE 
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'long'  THEN -($long_stop_loss  * fo.or_delta)
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'short' THEN -($short_stop_loss * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'long'  THEN ($long_take_profit  * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'short' THEN ($short_take_profit * fo.or_delta)
        WHEN fo.direction = 'long'  THEN lc.last_close - fo.or_high
        WHEN fo.direction = 'short' THEN fo.or_low - lc.last_close
    END AS trade_delta
FROM final_outcome fo
LEFT JOIN last_candle lc ON fo.trade_day = lc.trade_day AND fo.symbol = lc.symbol
WHERE ($direction IS NULL OR fo.direction = $direction) 
ORDER BY fo.trade_day;"""

FIB1_QUERY = """
WITH 
-- 1. BASE DATA: Pulling strictly from the 1-minute table
fast_data AS (
    SELECT 
        ts_event,
        ts_event::DATE AS trade_day,
        symbol,
        open,
        high,
        low,
        close,
        volume
    FROM main.nq_ohlcv_1m
    WHERE ts_event >= $start_date
),
-- 2. FIND THE ACTIVE CONTRACT
daily_lead AS (
    SELECT 
        trade_day,
        symbol
    FROM fast_data
    GROUP BY 1, 2
    QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day ORDER BY SUM(volume) DESC) = 1
),
-- 3. BUILD THE OPENING RANGE BOX
opening_range AS (
    SELECT 
        r.trade_day,
        r.symbol,
        MAX(r.high) AS or_high,
        MIN(r.low) AS or_low,
        (MAX(r.high) - MIN(r.low)) AS or_delta
    FROM fast_data r
    JOIN daily_lead dl ON r.trade_day = dl.trade_day AND r.symbol = dl.symbol
    -- STRICTLY LESS THAN (<) to prevent the trigger candle from being in the range
    WHERE (r.ts_event AT TIME ZONE 'Asia/Jerusalem')::TIME >= $range_start 
      AND (r.ts_event AT TIME ZONE 'Asia/Jerusalem')::TIME < $range_end
    GROUP BY 1, 2
),
-- 4. FIND THE ENTRY TRIGGER (CANDLE CLOSE)
first_breach AS (
    SELECT
        o.*,
        m.trade_day,
        m.ts_event AS breach_ts,
        m.symbol,
        CASE 
            WHEN m.close <= (o.or_low - ($long_entry_trigger * o.or_delta)) 
            THEN ((o.or_low) - ($long_entry_trigger * o.or_delta)) 
            ELSE ((o.or_high) + ($short_entry_trigger * o.or_delta)) 
        END AS entry_price, -- The exact price the candle closed at
        CASE 
            WHEN m.close <= (o.or_low - ($long_entry_trigger * o.or_delta)) THEN 'long'
            ELSE 'short'
        END AS direction,
        CASE 
            WHEN m.close <= (o.or_low - ($long_entry_trigger * o.or_delta)) 
            THEN ((o.or_low) - ($long_take_profit * o.or_delta)) 
            ELSE ((o.or_high) + ($short_take_profit * o.or_delta)) 
        END AS target_price,
        CASE 
            WHEN m.close <= (o.or_low - ($long_entry_trigger * o.or_delta)) 
            THEN ((o.or_low) - ($long_stop_loss * o.or_delta)) 
            ELSE ((o.or_high) + ($short_stop_loss * o.or_delta)) 
        END AS stop_price       
    FROM fast_data m
    JOIN opening_range o ON m.trade_day = o.trade_day AND m.symbol = o.symbol
    WHERE (m.ts_event AT TIME ZONE 'Asia/Jerusalem')::TIME > $range_end
    AND (
        m.close >= (o.or_high + ($short_entry_trigger * o.or_delta)) 
        OR 
        m.close <= (o.or_low - ($long_entry_trigger * o.or_delta))
    )
    QUALIFY ROW_NUMBER() OVER(PARTITION BY m.trade_day ORDER BY (m.ts_event AT TIME ZONE 'America/New_York')::TIME ASC) = 1
),
-- 5. MARK THE END OF THE DAY
last_candle AS (
    SELECT
        trade_day,
        symbol,
        open AS last_open,
        (ts_event AT TIME ZONE 'America/New_York')::TIME AS last_time
    FROM fast_data
    QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day, symbol ORDER BY ts_event DESC) = 1
),
-- 6. SCAN FOR EXITS (TAKE PROFIT OR STOP LOSS)
closed_trades AS (
    SELECT 
        fb.trade_day,
        fb.symbol,
        (fb.breach_ts AT TIME ZONE 'Asia/Jerusalem')::TIME AS trade_start_time,
        (m.ts_event AT TIME ZONE 'Asia/Jerusalem')::TIME AS trade_end_time,
        fb.direction,
        fb.or_high,
        fb.or_low,
        fb.target_price,
        fb.stop_price,
        CASE 
            WHEN fb.direction = 'long' AND m.high >= fb.target_price THEN 'PROFIT'
            WHEN fb.direction = 'long' AND m.low <= fb.stop_price THEN 'STOP'
            WHEN fb.direction = 'short' AND m.low <= fb.target_price THEN 'PROFIT'
            WHEN fb.direction = 'short' AND m.high >= fb.stop_price THEN 'STOP'
        END AS outcome,
        fb.or_delta,
        fb.entry_price
    FROM fast_data m
    JOIN first_breach fb ON m.trade_day = fb.trade_day AND m.symbol = fb.symbol
    WHERE m.ts_event > fb.breach_ts 
    AND (
        (fb.direction = 'long' AND (m.high >= fb.target_price OR m.low <= fb.stop_price))
        OR 
        (fb.direction = 'short' AND (m.low <= fb.target_price OR m.high >= fb.stop_price))
    )
    QUALIFY ROW_NUMBER() OVER(PARTITION BY m.trade_day ORDER BY m.ts_event ASC) = 1
),
-- 7. CATCH UNCLOSED TRADES
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
        fb.or_delta,
        fb.entry_price
    FROM first_breach fb
    JOIN last_candle lc ON fb.trade_day = lc.trade_day AND fb.symbol = lc.symbol
    WHERE NOT EXISTS (
        SELECT 1 FROM closed_trades ct WHERE ct.trade_day = fb.trade_day
    )
),
-- 8. CALCULATE FINAL MATH
final_outcome AS (
    SELECT * FROM closed_trades
    UNION ALL
    SELECT * FROM manual_trades
)
SELECT 
    fo.*,
    CASE WHEN fo.outcome = 'MANUAL' THEN lc.last_open ELSE NULL END AS manual_close_price,
    CASE 
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'long'  THEN fo.stop_price - fo.entry_price
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'short' THEN fo.entry_price - fo.stop_price
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'long'  THEN fo.target_price - fo.entry_price
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'short' THEN fo.entry_price - fo.target_price
        WHEN fo.direction = 'long'  THEN lc.last_open - fo.entry_price
        WHEN fo.direction = 'short' THEN fo.entry_price - lc.last_open
    END AS trade_delta
FROM final_outcome fo
LEFT JOIN last_candle lc ON fo.trade_day = lc.trade_day AND fo.symbol = lc.symbol 
ORDER BY fo.trade_day;"""

FIB_QUERY = """WITH 
fast_data AS (
    SELECT 
        ts_event,
        ts_event::DATE AS trade_day,
        symbol,
        open,
        high,
        low,
        close,
        volume
    FROM main.nq_ohlcv_1m
    WHERE ts_event >= $start_date
),
daily_lead AS (
    SELECT 
        trade_day,
        symbol
    FROM fast_data
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
    FROM fast_data r
    JOIN daily_lead dl ON r.trade_day = dl.trade_day AND r.symbol = dl.symbol
    WHERE (r.ts_event AT TIME ZONE 'Asia/Jerusalem')::TIME >= $range_start 
      AND (r.ts_event AT TIME ZONE 'Asia/Jerusalem')::TIME < $range_end
    GROUP BY 1, 2
),

-- STEP 1: THE SIGNAL (Candle closes past the line)
trade_setup AS (
    SELECT
        o.*,
        m.trade_day,
        m.ts_event AS setup_ts,
        m.symbol,
        -- Define the exact price level we want to place our limit order at
        CASE 
            WHEN m.close >= (o.or_high + ($short_entry_trigger * o.or_delta)) 
            THEN (o.or_high + ($short_entry_trigger * o.or_delta)) 
            ELSE (o.or_low - ($long_entry_trigger * o.or_delta)) 
        END AS limit_entry_price,
        
        CASE 
            WHEN m.close >= (o.or_high + ($short_entry_trigger * o.or_delta)) THEN 'short'
            ELSE 'long'
        END AS direction
        
    FROM fast_data m
    JOIN opening_range o ON m.trade_day = o.trade_day AND m.symbol = o.symbol
    WHERE (m.ts_event AT TIME ZONE 'Asia/Jerusalem')::TIME >= $range_end
    AND (
        m.close >= (o.or_high + ($short_entry_trigger * o.or_delta)) 
        OR 
        m.close <= (o.or_low - ($long_entry_trigger * o.or_delta))
    )
    QUALIFY ROW_NUMBER() OVER(PARTITION BY m.trade_day ORDER BY m.ts_event ASC) = 1
),

-- STEP 2: THE EXECUTION (Price pulls back to fill the limit order)
trade_execution AS (
    SELECT 
        s.*,
        e.ts_event AS fill_ts,
        s.limit_entry_price AS entry_price, -- Because it's a limit order, we get exact fill price
        
        -- Calculate TP and SL based on the Opening Range boundaries
        CASE 
            WHEN s.direction = 'long' THEN (s.or_low - ($long_take_profit * s.or_delta)) 
            ELSE (s.or_high + ($short_take_profit * s.or_delta)) 
        END AS target_price,
        
        CASE 
            WHEN s.direction = 'long' THEN (s.or_low - ($long_stop_loss * s.or_delta)) 
            ELSE (s.or_high + ($short_stop_loss * s.or_delta)) 
        END AS stop_price

    FROM fast_data e
    JOIN trade_setup s ON e.trade_day = s.trade_day AND e.symbol = s.symbol
    -- Only look for fills AFTER the setup candle has closed
    WHERE e.ts_event > s.setup_ts 
    AND (
        (s.direction = 'long' AND e.low <= s.limit_entry_price)
        OR 
        (s.direction = 'short' AND e.high >= s.limit_entry_price)
    )
    QUALIFY ROW_NUMBER() OVER(PARTITION BY e.trade_day ORDER BY e.ts_event ASC) = 1
),

last_candle AS (
    SELECT
        trade_day,
        symbol,
        open AS last_open,
        (ts_event AT TIME ZONE 'America/New_York')::TIME AS last_time_nyc
    FROM fast_data
    QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day, symbol ORDER BY ts_event DESC) = 1
),

-- STEP 3: THE EXITS (Start tracking AFTER the execution)
closed_trades AS (
    SELECT 
        te.trade_day,
        te.symbol,
        (te.fill_ts AT TIME ZONE 'America/New_York')::TIME AS trade_start_time,
        (m.ts_event AT TIME ZONE 'America/New_York')::TIME AS trade_end_time,
        te.direction,
        te.or_high,
        te.or_low,
        te.target_price,
        te.stop_price,
        CASE 
            WHEN te.direction = 'long' AND m.high >= te.target_price THEN 'PROFIT'
            WHEN te.direction = 'long' AND m.low <= te.stop_price THEN 'STOP'
            WHEN te.direction = 'short' AND m.low <= te.target_price THEN 'PROFIT'
            WHEN te.direction = 'short' AND m.high >= te.stop_price THEN 'STOP'
        END AS outcome,
        te.or_delta,
        te.entry_price
    FROM fast_data m
    JOIN trade_execution te ON m.trade_day = te.trade_day AND m.symbol = te.symbol
    -- Scan for exits only after the limit order is filled
    WHERE m.ts_event > te.fill_ts 
    AND (
        (te.direction = 'long' AND (m.high >= te.target_price OR m.low <= te.stop_price))
        OR 
        (te.direction = 'short' AND (m.low <= te.target_price OR m.high >= te.stop_price))
    )
    QUALIFY ROW_NUMBER() OVER(PARTITION BY m.trade_day ORDER BY m.ts_event ASC) = 1
),

manual_trades AS (
    SELECT
        te.trade_day,
        te.symbol,
        (te.fill_ts AT TIME ZONE 'America/New_York')::TIME AS trade_start_time,
        lc.last_time_nyc AS trade_end_time,
        te.direction,
        te.or_high,
        te.or_low,
        te.target_price,
        te.stop_price,
        'MANUAL' AS outcome,
        te.or_delta,
        te.entry_price
    FROM trade_execution te
    JOIN last_candle lc ON te.trade_day = lc.trade_day AND te.symbol = lc.symbol
    WHERE NOT EXISTS (
        SELECT 1 FROM closed_trades ct WHERE ct.trade_day = te.trade_day
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
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'long'  THEN fo.stop_price - fo.entry_price
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'short' THEN fo.entry_price - fo.stop_price
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'long'  THEN fo.target_price - fo.entry_price
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'short' THEN fo.entry_price - fo.target_price
        WHEN fo.direction = 'long'  THEN lc.last_open - fo.entry_price
        WHEN fo.direction = 'short' THEN fo.entry_price - lc.last_open
    END AS trade_delta
FROM final_outcome fo
LEFT JOIN last_candle lc ON fo.trade_day = lc.trade_day AND fo.symbol = lc.symbol 
WHERE ($min_or_delta IS NULL OR fo.or_delta >= $min_or_delta)
  AND ($max_or_delta IS NULL OR fo.or_delta <= $max_or_delta)
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
            THEN (o.or_high + $long_take_profit * o.or_delta) 
            ELSE (o.or_low  - $short_take_profit * o.or_delta) 
        END AS target_price,
        CASE WHEN r.high >= o.or_high 
            THEN (o.or_high - ($long_stop_loss  * o.or_delta)) 
            ELSE (o.or_low  + ($short_stop_loss * o.or_delta)) 
        END AS stop_price       
    FROM t_fast_data r
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
    FROM t_fast_data r
    JOIN first_breach fb ON r.trade_day = fb.trade_day AND r.symbol = fb.symbol
    WHERE r.ts_event >= fb.breach_ts
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
        SELECT 1 FROM t_fast_data r
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
    CASE WHEN fo.outcome = 'MANUAL' THEN lc.last_close ELSE NULL END AS manual_close_price,
    CASE 
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'long'  THEN -($long_stop_loss  * fo.or_delta)
        WHEN fo.outcome = 'STOP'   AND fo.direction = 'short' THEN -($short_stop_loss * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'long'  THEN ($long_take_profit  * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' AND fo.direction = 'short' THEN ($short_take_profit * fo.or_delta)
        WHEN fo.direction = 'long'  THEN lc.last_close - fo.or_high
        WHEN fo.direction = 'short' THEN fo.or_low - lc.last_close
    END AS trade_delta
FROM final_outcome fo
LEFT JOIN t_last_candle lc ON fo.trade_day = lc.trade_day AND fo.symbol = lc.symbol
ORDER BY fo.trade_day;
"""

CHART_QUERY = """
WITH base AS (
    SELECT
        ts_event,
        symbol,
        open,
        high,
        low,
        close,
        volume
    FROM main.nq_ohlcv_1m
    WHERE ts_event >= $start::TIMESTAMPTZ
      AND ts_event <= $end::TIMESTAMPTZ
),
lead_symbol AS (
    SELECT symbol
    FROM base
    GROUP BY symbol
    ORDER BY SUM(volume) DESC
    LIMIT 1
),
bucketed AS (
    SELECT
        time_bucket($interval::INTERVAL, b.ts_event AT TIME ZONE 'Asia/Jerusalem') AS bucket,
        FIRST(b.open ORDER BY b.ts_event)  AS open,
        MAX(b.high)                         AS high,
        MIN(b.low)                          AS low,
        LAST(b.close ORDER BY b.ts_event)   AS close,
        SUM(b.volume)                       AS volume
    FROM base b
    JOIN lead_symbol ls ON b.symbol = ls.symbol
    GROUP BY bucket
)
SELECT
    bucket::VARCHAR AS time,
    open,
    high,
    low,
    close,
    volume
FROM bucketed
ORDER BY bucket ASC
LIMIT 2000;
"""
