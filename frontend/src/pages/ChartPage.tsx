import { useRef, useState, useCallback, useMemo } from "react";
import styled from "styled-components";
import { theme } from "../styles/theme";
import { fetchChart, GRANULARITY_OPTIONS } from "../api/chart";
import type { Candle, Granularity } from "../api/chart";

/* ─── constants ────────────────────────────────────────────── */
const PADDING = { top: 24, right: 16, bottom: 48, left: 72 };
const CANDLE_GAP_RATIO = 0.25; // fraction of candle width that is gap

/* ─── helpers ───────────────────────────────────────────────── */
function fmt(ts: string) {
  // ts comes as "2024-01-02 09:30:00-05:00" style from DuckDB
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString("en-US", { hour12: false });
}

function fmtShort(ts: string) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

/* ─── Chart component ───────────────────────────────────────── */
interface HoverState {
  x: number;
  y: number;
  candle: Candle;
}

const PriceChart = ({ candles }: { candles: Candle[] }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const WIDTH = 1200;
  const HEIGHT = 500;
  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;

  const { minP, maxP, priceRange } = useMemo(() => {
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const minP = Math.min(...lows);
    const maxP = Math.max(...highs);
    const pad = (maxP - minP) * 0.05;
    return { minP: minP - pad, maxP: maxP + pad, priceRange: maxP - minP + 2 * pad };
  }, [candles]);

  const toY = useCallback(
    (price: number) => PADDING.top + innerH - ((price - minP) / priceRange) * innerH,
    [minP, priceRange, innerH],
  );

  const n = candles.length;
  const candleW = Math.max(1, innerW / n);
  const bodyW = Math.max(1, candleW * (1 - CANDLE_GAP_RATIO));
  const toX = (i: number) => PADDING.left + (i + 0.5) * candleW;

  // Y-axis ticks
  const tickCount = 8;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    minP + (priceRange * i) / tickCount,
  );

  // X-axis ticks — show ~8 evenly spaced labels
  const xTickCount = Math.min(8, n);
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i * (n - 1)) / Math.max(xTickCount - 1, 1)),
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
      const relX = svgX - PADDING.left;
      const idx = Math.round(relX / candleW - 0.5);
      if (idx < 0 || idx >= n) {
        setHover(null);
        return;
      }
      setHover({
        x: toX(idx),
        y: toY(candles[idx].close),
        candle: candles[idx],
      });
    },
    [candles, candleW, n, toX, toY],
  );

  const priceY = hover ? toY(hover.candle.close) : null;

  return (
    <SvgWrapper>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines + Y-axis labels */}
        {yTicks.map((price, i) => {
          const y = toY(price);
          return (
            <g key={i}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="#1a1a1a"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill={theme.colors.textMuted}
                fontFamily="'JetBrains Mono', monospace"
              >
                {price.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xTicks.map((idx) => {
          const x = toX(idx);
          return (
            <text
              key={idx}
              x={x}
              y={HEIGHT - PADDING.bottom + 18}
              textAnchor="middle"
              fontSize={9}
              fill={theme.colors.textMuted}
              fontFamily="'JetBrains Mono', monospace"
            >
              {fmtShort(candles[idx].time)}
            </text>
          );
        })}

        {/* Candlesticks */}
        {candles.map((c, i) => {
          const x = toX(i);
          const isUp = c.close >= c.open;
          const color = isUp ? theme.colors.accent : theme.colors.danger;
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyBot = toY(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          return (
            <g key={i}>
              {/* Wick */}
              <line
                x1={x}
                x2={x}
                y1={toY(c.high)}
                y2={toY(c.low)}
                stroke={color}
                strokeWidth={Math.max(0.5, bodyW * 0.15)}
                opacity={0.9}
              />
              {/* Body */}
              <rect
                x={x - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={isUp ? color : "transparent"}
                stroke={color}
                strokeWidth={isUp ? 0 : 0.8}
                opacity={0.9}
              />
            </g>
          );
        })}

        {/* Hover crosshair */}
        {hover && priceY !== null && (
          <g pointerEvents="none">
            {/* Vertical line */}
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke={theme.colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            {/* Horizontal line */}
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={priceY}
              y2={priceY}
              stroke={theme.colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            {/* Price label on Y axis */}
            <rect
              x={0}
              y={priceY - 10}
              width={PADDING.left - 2}
              height={20}
              fill={theme.colors.accent}
              rx={2}
            />
            <text
              x={PADDING.left - 6}
              y={priceY + 4}
              textAnchor="end"
              fontSize={10}
              fill="#000"
              fontWeight="bold"
              fontFamily="'JetBrains Mono', monospace"
            >
              {hover.candle.close.toFixed(2)}
            </text>
            {/* Dot */}
            <circle cx={hover.x} cy={priceY} r={4} fill={theme.colors.accent} />
          </g>
        )}
      </svg>

      {/* Floating tooltip */}
      {hover && (
        <Tooltip
          style={{
            left: hover.x > WIDTH * 0.6 ? undefined : `${(hover.x / WIDTH) * 100 + 1}%`,
            right: hover.x > WIDTH * 0.6 ? `${((WIDTH - hover.x) / WIDTH) * 100 + 1}%` : undefined,
            top: "12px",
          }}
        >
          <TooltipRow>
            <TooltipLabel>Time</TooltipLabel>
            <TooltipValue>{fmt(hover.candle.time)}</TooltipValue>
          </TooltipRow>
          <TooltipDivider />
          <TooltipRow>
            <TooltipLabel>O</TooltipLabel>
            <TooltipValue>{hover.candle.open.toFixed(2)}</TooltipValue>
          </TooltipRow>
          <TooltipRow>
            <TooltipLabel>H</TooltipLabel>
            <TooltipValue $accent={theme.colors.accent}>{hover.candle.high.toFixed(2)}</TooltipValue>
          </TooltipRow>
          <TooltipRow>
            <TooltipLabel>L</TooltipLabel>
            <TooltipValue $accent={theme.colors.danger}>{hover.candle.low.toFixed(2)}</TooltipValue>
          </TooltipRow>
          <TooltipRow>
            <TooltipLabel>C</TooltipLabel>
            <TooltipValue
              $accent={
                hover.candle.close >= hover.candle.open
                  ? theme.colors.accent
                  : theme.colors.danger
              }
            >
              {hover.candle.close.toFixed(2)}
            </TooltipValue>
          </TooltipRow>
          <TooltipDivider />
          <TooltipRow>
            <TooltipLabel>Vol</TooltipLabel>
            <TooltipValue>{hover.candle.volume.toLocaleString()}</TooltipValue>
          </TooltipRow>
        </Tooltip>
      )}
    </SvgWrapper>
  );
};

/* ─── Page ──────────────────────────────────────────────────── */
const ChartPage = () => {
  const [start, setStart] = useState("2024-01-02T09:30");
  const [end, setEnd] = useState("2024-01-02T16:00");
  const [granularity, setGranularity] = useState<Granularity>("1m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChart(start, end, granularity);
      setCandles(data);
      setFetched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <Header>
        <HeaderRow>
          <HeaderDot />
          <HeaderMeta>NQ Futures</HeaderMeta>
        </HeaderRow>
        <Title>Price Chart</Title>
        <Subtitle>1-minute OHLCV — highest-volume contract — times in IL (Asia/Jerusalem)</Subtitle>
      </Header>

      <FilterBar>
        <FilterField>
          <FilterLabel>Start</FilterLabel>
          <FilterInput
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </FilterField>
        <FilterField>
          <FilterLabel>End</FilterLabel>
          <FilterInput
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </FilterField>
        <FilterField>
          <FilterLabel>Granularity</FilterLabel>
          <GranularityGroup>
            {GRANULARITY_OPTIONS.map((opt) => (
              <GranBtn
                key={opt.value}
                $active={granularity === opt.value}
                onClick={() => setGranularity(opt.value)}
              >
                {opt.label}
              </GranBtn>
            ))}
          </GranularityGroup>
        </FilterField>
        <RunButton onClick={handleFetch} disabled={loading} $loading={loading}>
          {loading ? "Loading…" : "Fetch →"}
        </RunButton>
      </FilterBar>

      {error && <ErrorBox>{error}</ErrorBox>}

      {fetched && candles.length === 0 && !loading && (
        <Empty>No data found for the selected range.</Empty>
      )}

      {candles.length > 0 && (
        <>
          <ChartMeta>{candles.length} candles · {granularity} · {start} → {end}</ChartMeta>
          <PriceChart candles={candles} />
        </>
      )}
    </Page>
  );
};

export default ChartPage;

/* ─── Styled components ─────────────────────────────────────── */
const Page = styled.div`
  min-height: 100vh;
  background: ${theme.colors.bg};
  color: ${theme.colors.textPrimary};
  font-family: ${theme.fonts.mono};
  padding: 48px 40px;
`;

const Header = styled.div`
  margin-bottom: 40px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
`;

const HeaderDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${theme.colors.accentBlue};
`;

const HeaderMeta = styled.span`
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const Title = styled.h1`
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #fff;
`;

const Subtitle = styled.p`
  color: ${theme.colors.textSecondary};
  font-size: 12px;
  margin-top: 6px;
`;

const FilterBar = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
`;

const FilterField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FilterLabel = styled.label`
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-family: ${theme.fonts.mono};
`;

const FilterInput = styled.input`
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  color: ${theme.colors.textPrimary};
  font-family: ${theme.fonts.mono};
  font-size: 13px;
  padding: 9px 14px;
  color-scheme: dark;
  transition: border-color 0.15s;

  &:focus {
    outline: none;
    border-color: ${theme.colors.accentBlue};
  }
`;

const RunButton = styled.button<{ $loading: boolean }>`
  background: ${({ $loading }) => ($loading ? "#1a1a1a" : "#fff")};
  color: ${({ $loading }) => ($loading ? theme.colors.textSecondary : "#000")};
  border: none;
  border-radius: 2px;
  font-family: ${theme.fonts.mono};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 10px 28px;
  cursor: ${({ $loading }) => ($loading ? "not-allowed" : "pointer")};
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  height: 40px;

  &:hover {
    background: ${({ $loading }) => (!$loading ? theme.colors.accentBlue : "#1a1a1a")};
    color: ${({ $loading }) => (!$loading ? "#000" : theme.colors.textSecondary)};
  }
`;

const ErrorBox = styled.div`
  color: ${theme.colors.danger};
  font-size: 13px;
  margin-bottom: 24px;
  padding: 12px 16px;
  border: 1px solid #331111;
  border-radius: 2px;
`;

const Empty = styled.div`
  color: ${theme.colors.textSecondary};
  font-size: 13px;
  padding: 60px 0;
  text-align: center;
`;

const ChartMeta = styled.div`
  color: ${theme.colors.textMuted};
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 12px;
`;

const SvgWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 500px;
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  overflow: hidden;
  cursor: crosshair;
`;

const Tooltip = styled.div`
  position: absolute;
  background: #111;
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  padding: 10px 14px;
  font-family: ${theme.fonts.mono};
  font-size: 11px;
  pointer-events: none;
  z-index: 20;
  min-width: 160px;
`;

const TooltipRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 24px;
  line-height: 1.8;
`;

const TooltipLabel = styled.span`
  color: ${theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 10px;
`;

const TooltipValue = styled.span<{ $accent?: string }>`
  color: ${({ $accent }) => $accent ?? theme.colors.textPrimary};
  font-weight: 600;
`;

const TooltipDivider = styled.div`
  border-top: 1px solid ${theme.colors.border};
  margin: 4px 0;
`;

const GranularityGroup = styled.div`
  display: flex;
  gap: 0;
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  overflow: hidden;
  height: 40px;
`;

const GranBtn = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? theme.colors.accentBlue : "transparent")};
  color: ${({ $active }) => ($active ? "#000" : theme.colors.textSecondary)};
  border: none;
  border-right: 1px solid ${theme.colors.border};
  font-family: ${theme.fonts.mono};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  height: 100%;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: ${({ $active }) => ($active ? theme.colors.accentBlue : "#1a1a1a")};
    color: ${({ $active }) => ($active ? "#000" : theme.colors.textPrimary)};
  }
`;
