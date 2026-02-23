import styled from "styled-components";
import { theme } from "../styles/theme";
import type { ORBResult, ORBTradeData } from "../api/backtest";

interface Props {
  data: ORBTradeData[];
  maxDrawdown: number;
  drawdownStart: string;
  drawdownEnd: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: string;
}

const StatCard = ({ label, value, accent }: StatCardProps) => (
  <Card $accent={accent}>
    <CardLabel>{label}</CardLabel>
    <CardValue $accent={accent}>{value}</CardValue>
  </Card>
);

const StatCards = ({
  data,
  maxDrawdown,
  drawdownStart,
  drawdownEnd,
}: Props) => {
  const total = data.length;
  const profits = data.filter((d) => d.outcome === "PROFIT").length;
  const stops = data.filter((d) => d.outcome === "STOP").length;
  const totalDelta = data
    .reduce((s, d) => s + (d.trade_delta || 0), 0)
    .toFixed(2);
  const avgDelta = (
    data.reduce((s, d) => s + (d.trade_delta || 0), 0) / total
  ).toFixed(2);
  const winRate = ((profits / total) * 100).toFixed(1);
  const longs = data.filter((d) => d.direction === "long").length;
  const shorts = data.filter((d) => d.direction === "short").length;

  return (
    <>
      <SectionLabel>Summary — {total} trades</SectionLabel>
      <Grid>
        <StatCard
          label="Win Rate"
          value={`${winRate}%`}
          accent={theme.colors.accent}
        />
        <StatCard
          label="Total P&L Δ"
          value={parseFloat(totalDelta) >= 0 ? `+${totalDelta}` : totalDelta}
          accent={
            parseFloat(totalDelta) >= 0
              ? theme.colors.accent
              : theme.colors.danger
          }
        />
        <StatCard
          label="Avg P&L Δ"
          value={parseFloat(avgDelta) >= 0 ? `+${avgDelta}` : avgDelta}
          accent={
            parseFloat(avgDelta) >= 0
              ? theme.colors.accentBlue
              : theme.colors.danger
          }
        />
        <StatCard
          label="Profits"
          value={profits}
          accent={theme.colors.accentBlue}
        />
        <StatCard label="Stops" value={stops} accent={theme.colors.danger} />
        <StatCard label="Long" value={longs} />
        <StatCard label="Short" value={shorts} />
        <DrawdownCard>
          <CardLabel>Max Drawdown</CardLabel>
          <CardValue $accent={theme.colors.danger}>
            {maxDrawdown.toFixed(2)}
          </CardValue>
          <DrawdownDates>
            {drawdownStart} → {drawdownEnd}
          </DrawdownDates>
        </DrawdownCard>
      </Grid>
    </>
  );
};

export default StatCards

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 40px;
`;

const Card = styled.div<{ $accent?: string }>`
  background: ${theme.colors.surface};
  border: 1px solid ${({ $accent }) => $accent || theme.colors.border};
  border-radius: 2px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CardLabel = styled.span`
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: ${theme.fonts.mono};
`;

const CardValue = styled.span<{ $accent?: string }>`
  color: ${({ $accent }) => $accent || theme.colors.textPrimary};
  font-size: 28px;
  font-weight: 700;
  font-family: ${theme.fonts.mono};
  letter-spacing: -0.02em;
`;

const SectionLabel = styled.div`
  color: ${theme.colors.textMuted};
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 16px;
  font-family: ${theme.fonts.mono};
`;

const DrawdownCard = styled.div`
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.danger};
  border-radius: 2px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  grid-column: span 2;
`;

const DrawdownDates = styled.span`
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  font-family: ${theme.fonts.mono};
  margin-top: 4px;
`;