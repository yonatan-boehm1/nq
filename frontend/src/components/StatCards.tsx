import styled from "styled-components";
import { theme } from "../styles/theme";
import type { ORBResult, ORBTradeData } from "../api/backtest";

interface Props {
  data: ORBTradeData[];
  maxDrawdown: number;
  drawdownStart: string;
  drawdownEnd: string;
}

const StatCards = ({
  data,
  maxDrawdown,
  drawdownStart,
  drawdownEnd,
}: Props) => {
  const total = data.length;
  const profits = data.filter((d) => d.trade_delta >= 0).length;
  const stops = data.filter((d) => d.trade_delta < 0).length;
  const manuals = data.filter((d) => d.outcome === "MANUAL").length;
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
      <TopRow>
        <BigCard
          $accent={
            parseFloat(totalDelta) >= 0
              ? theme.colors.accent
              : theme.colors.danger
          }
        >
          <BigLabel>Total P&L</BigLabel>
          <BigValue
            $accent={
              parseFloat(totalDelta) >= 0
                ? theme.colors.accent
                : theme.colors.danger
            }
          >
            {parseFloat(totalDelta) >= 0 ? `+${totalDelta}` : totalDelta}
          </BigValue>
        </BigCard>

        <BigCard $accent={theme.colors.accentBlue}>
          <BigLabel>Avg P&L</BigLabel>
          <BigValue
            $accent={
              parseFloat(avgDelta) >= 0
                ? theme.colors.accentBlue
                : theme.colors.danger
            }
          >
            {parseFloat(avgDelta) >= 0 ? `+${avgDelta}` : avgDelta}
          </BigValue>
        </BigCard>

        <BigCard $accent={theme.colors.accent}>
          <BigLabel>Win Rate</BigLabel>
          <BigValue $accent={theme.colors.accent}>{winRate}%</BigValue>
        </BigCard>

        <DrawdownCard>
          <BigLabel>Max Drawdown</BigLabel>
          <BigValue $accent={theme.colors.danger}>
            {maxDrawdown.toFixed(2)}
          </BigValue>
          <DrawdownDates>
            {drawdownStart} → {drawdownEnd}
          </DrawdownDates>
        </DrawdownCard>
      </TopRow>

      {/* bottom row — trade breakdown */}
      <BottomRow>
        <StatCard label="Trades" value={total} />
        <Divider />
        <StatCard
          label="Profits"
          value={profits}
          accent={theme.colors.accent}
        />
        <Divider />
        <StatCard label="Stops" value={stops} accent={theme.colors.danger} />
        <Divider />
        <StatCard
          label="Manuals"
          value={manuals}
          accent={theme.colors.accentBlue}
        />
        <Divider />
        <StatCard label="Long" value={longs} accent={theme.colors.border} />
        <Divider />
        <StatCard label="Short" value={shorts} accent={theme.colors.border} />
      </BottomRow>
    </>
  );
};

const SectionLabel = styled.div`
  color: ${theme.colors.textMuted};
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 16px;
  font-family: ${theme.fonts.mono};
`;

const TopRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 12px;
`;

const BottomRow = styled.div`
  display: flex;
  align-items: stretch;
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  margin-bottom: 40px;
`;

const BigCard = styled.div<{ $accent?: string }>`
  background: ${theme.colors.surface};
  border: 1px solid ${({ $accent }) => $accent || theme.colors.border};
  border-radius: 2px;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const BigLabel = styled.span`
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-family: ${theme.fonts.mono};
`;

const BigValue = styled.span<{ $accent?: string }>`
  color: ${({ $accent }) => $accent || theme.colors.textPrimary};
  font-size: 40px;
  font-weight: 700;
  font-family: ${theme.fonts.mono};
  letter-spacing: -0.03em;
  line-height: 1;
`;

const DrawdownCard = styled.div`
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.danger};
  border-radius: 2px;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DrawdownDates = styled.span`
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  font-family: ${theme.fonts.mono};
  margin-top: 4px;
`;

const SmallCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  padding: 20px 24px;
`;

const SmallLabel = styled.span`
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: ${theme.fonts.mono};
`;

const SmallValue = styled.span<{ $accent?: string }>`
  color: ${({ $accent }) => $accent || theme.colors.textPrimary};
  font-size: 24px;
  font-weight: 700;
  font-family: ${theme.fonts.mono};
`;

const Divider = styled.div`
  width: 1px;
  background: ${theme.colors.border};
  align-self: stretch;
`;

const StatCard = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) => (
  <SmallCard>
    <SmallLabel>{label}</SmallLabel>
    <SmallValue $accent={accent}>{value}</SmallValue>
  </SmallCard>
);

export default StatCards;
