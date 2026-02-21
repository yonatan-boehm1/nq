import datetime


def primary_method_query(start_hour: datetime.time, end_hour: datetime.time):
    return """
--final query
WITH 
-- 1. סינון ראשוני: מחשבים תאריכים ושעות פעם אחת ומסננים טווח רלוונטי
raw_data AS (
    SELECT 
        ts_event,
        ts_event::DATE AS trade_day, -- חישוב יקר שנעשה פעם אחת
        symbol,
        high,
        low,
        volume
    FROM main.nq_ohlcv
    WHERE ts_event >= '2023-01-01' -- חובה! תמיד לסנן טווח זמן לעבודה
    AND symbol NOT LIKE '%-%'
),
-- 2. מציאת החוזה המוביל (לפי ווליום יומי)
daily_lead AS (
    SELECT 
        trade_day,
        symbol
    FROM raw_data
    GROUP BY 1, 2
    QUALIFY ROW_NUMBER() OVER(PARTITION BY trade_day ORDER BY SUM(volume) DESC) = 1
),
-- 3. חישוב ה-Opening Range (רק לחוזה המוביל)
opening_range AS (
    SELECT 
        r.trade_day,
        r.symbol,
        MAX(r.high) AS or_high,
        MIN(r.low) AS or_low,
        (MAX(r.high) - MIN(r.low)) AS or_delta
    FROM raw_data r
    JOIN daily_lead dl ON r.trade_day = dl.trade_day AND r.symbol = dl.symbol
    WHERE r.ts_event::TIMESTAMP::TIME BETWEEN '16:30:00' AND '16:45:00'
    GROUP BY 1, 2
),
-- 4. זיהוי הפריצה הראשונה + חישוב יעדים
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
        -- יעדים (מחושבים מראש לביצועים)
        CASE WHEN r.high >= o.or_high THEN (o.or_high + o.or_delta) ELSE (o.or_low - o.or_delta) END as target_price,
        CASE WHEN r.high >= o.or_high THEN (o.or_high - (0.5 * o.or_delta)) ELSE (o.or_low + (0.5 * o.or_delta)) END as stop_price       
    FROM raw_data r
    JOIN opening_range o ON r.trade_day = o.trade_day AND r.symbol = o.symbol
    WHERE r.ts_event::TIMESTAMP::TIME > '16:45:00'
    AND (r.high >= o.or_high OR r.low <= o.or_low)
    QUALIFY ROW_NUMBER() OVER(PARTITION BY r.trade_day ORDER BY r.ts_event ASC) = 1
),
-- 5. מציאת התוצאה (Target vs Stop) - החלק הכבד שעבר אופטימיזציה
final_outcome AS (
    SELECT 
        fb.trade_day,
        CAST(fb.breach_ts AS TIMESTAMP)::TIME AS trade_start_time,
        CAST(r.ts_event AS TIMESTAMP)::TIME AS trade_end_time,
        (r.ts_event - fb.breach_ts) AS trade_time_elapsed,
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
        END as outcome,
        fb.or_delta
    FROM raw_data r
    JOIN first_breach fb 
    ON r.trade_day = fb.trade_day -- קריטי: Join על תאריך מחושב מראש
    AND r.symbol = fb.symbol
    WHERE r.ts_event > fb.breach_ts
    AND (
        (fb.direction = 'long' AND (r.high >= fb.target_price OR r.low <= fb.stop_price))
        OR 
        (fb.direction = 'short' AND (r.low <= fb.target_price OR r.high >= fb.stop_price))
    )
    QUALIFY ROW_NUMBER() OVER(PARTITION BY r.trade_day ORDER BY r.ts_event ASC) = 1
)
SELECT 
    *,
    CASE 
        WHEN fo.outcome = 'STOP' THEN -(0.5 * fo.or_delta)
        WHEN fo.outcome = 'PROFIT' THEN fo.or_delta
    END as trade_delta
FROM final_outcome fo
ORDER BY trade_day;"""