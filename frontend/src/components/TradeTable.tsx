import { useState } from "react";
import styled from "styled-components";
import { theme } from "../styles/theme";
import type { ORBResult, ORBTradeData } from "../api/backtest";

interface Props {
  data: ORBTradeData[];
}

interface Col {
  key: keyof ORBTradeData;
  label: string;
}

const baseCols: Col[] = [
  { key: "trade_day", label: "Date" },
  { key: "direction", label: "Dir" },
  { key: "trade_start_time", label: "Entry" },
  { key: "trade_end_time", label: "Exit" },
  { key: "or_high", label: "OR High" },
  { key: "or_low", label: "OR Low" },
  { key: "or_delta", label: "OR Δ" },
  { key: "entry_price", label: "Entry $" },
  { key: "target_price", label: "Target" },
  { key: "stop_price", label: "Stop" },
  { key: "outcome", label: "Outcome" },
  { key: "trade_delta", label: "P&L Δ" },
];

const getCellColor = (
  key: keyof ORBTradeData,
  val: ORBTradeData[keyof ORBTradeData],
): string => {
  if (key === "outcome")
    return val === "PROFIT"
      ? theme.colors.accent
      : val === "STOP"
        ? theme.colors.danger
        : theme.colors.accentBlue;
  if (key === "direction")
    return val === "long" ? theme.colors.accentBlue : theme.colors.accentOrange;
  if (key === "trade_delta")
    return (val as number) >= 0 ? theme.colors.accent : theme.colors.danger;
  return theme.colors.textPrimary;
};

const TradeTable = ({ data }: Props) => {
  const [sortCol, setSortCol] = useState<keyof ORBTradeData>("trade_day");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const hasEntryPrice = data.some((d) => d.entry_price !== undefined);
  const activeCols = baseCols.filter(
    (c) => c.key !== "entry_price" || hasEntryPrice,
  );

  const handleSort = (col: keyof ORBTradeData) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    const va = a[sortCol],
      vb = b[sortCol];
    if (va && vb && va < vb) return sortDir === "asc" ? -1 : 1;
    if (va && vb && va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <>
      <SectionLabel>Trade Log</SectionLabel>
      <Wrapper>
        <Table>
          <thead>
            <tr>
              {activeCols.map((c) => (
                <Th
                  key={c.key}
                  $active={sortCol === c.key}
                  onClick={() => handleSort(c.key)}
                >
                  {c.label}{" "}
                  {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <Tr key={i}>
                {activeCols.map((c) => {
                  let val: string | number = row[c.key] as string | number;
                  if (typeof val === "number") val = val.toFixed(2);
                  if (c.key === "trade_day") val = val.slice(0, 10);
                  return (
                    <Td key={c.key} $color={getCellColor(c.key, row[c.key])}>
                      {val ?? "—"}
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </tbody>
        </Table>
      </Wrapper>
      <Footer>{data.length} rows</Footer>
    </>
  );
};

export default TradeTable;

const Wrapper = styled.div`
  overflow-x: auto;
  overflow-y: auto;
  max-height: 600px;
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-family: ${theme.fonts.mono};
`;

const Th = styled.th<{ $active: boolean }>`
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 12px 16px;
  text-align: left;
  color: ${({ $active }) =>
    $active ? theme.colors.accent : theme.colors.textSecondary};
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  white-space: nowrap;
  background: #0a0a0a;
  cursor: pointer;
  transition: color 0.15s;
  user-select: none;
  box-shadow: 0 1px 0 ${theme.colors.border}; /* add bottom border natively to sticky header since tr border might scroll */

  &:hover {
    color: ${theme.colors.accent};
  }
`;

const Tr = styled.tr`
  border-bottom: 1px solid ${theme.colors.border};

  &:hover td {
    background: #111;
  }
`;

const Td = styled.td<{ $color: string }>`
  padding: 10px 16px;
  color: ${({ $color }) => $color};
  white-space: nowrap;
  transition: background 0.1s;
`;

const Footer = styled.div`
  color: ${theme.colors.textMuted};
  font-size: 10px;
  margin-top: 12px;
  text-align: right;
  font-family: ${theme.fonts.mono};
`;

const SectionLabel = styled.div`
  color: ${theme.colors.textMuted};
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 16px;
  font-family: ${theme.fonts.mono};
`;
