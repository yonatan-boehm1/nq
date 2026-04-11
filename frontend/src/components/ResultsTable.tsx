import { useState, useMemo } from "react";
import styled from "styled-components";
import { theme } from "../styles/theme";
import type { ORBResultsRow } from "../api/results";

type SortDir = "asc" | "desc";

interface Col {
  key: keyof ORBResultsRow;
  label: string;
  format?: (v: number | string) => string;
}

interface Props {
  data: ORBResultsRow[];
  loading: boolean;
}

const cols: Col[] = [
  {
    key: "direction",
    label: "Dir",
  },
  {
    key: "take_profit",
    label: "Take Profit",
    format: (v) => (v as number).toFixed(2),
  },
  {
    key: "stop_loss",
    label: "Stop Loss",
    format: (v) => (v as number).toFixed(2),
  },
  { key: "total_trades", label: "Trades" },
  {
    key: "win_rate",
    label: "Win Rate",
    format: (v) => `${(v as number).toFixed(1)}%`,
  },
  {
    key: "total_pnl",
    label: "Total PnL",
    format: (v) => (v as number).toFixed(2),
  },
  {
    key: "scaled_pnl",
    label: "Scaled PnL",
    format: (v) => (v as number).toFixed(2),
  },
  { key: "avg_pnl", label: "Avg PnL", format: (v) => (v as number).toFixed(2) },
  { key: "profits", label: "Profits" },
  { key: "stops", label: "Stops" },
  {
    key: "max_drawdown",
    label: "Max DD",
    format: (v) => (v as number).toFixed(2),
  },
  {
    key: "drawdown_start",
    label: "DD Start",
    format: (v) => (v as string).split("T")[0],
  },
  {
    key: "drawdown_end",
    label: "DD End",
    format: (v) => (v as string).split("T")[0],
  },
];

const getCellColor = (
  key: keyof ORBResultsRow,
  val: number | string,
): string => {
  if (key === "direction")
    return (val as string) === "long" ? theme.colors.accentBlue : theme.colors.accentOrange;
  if (key === "total_pnl" || key === "avg_pnl" || key === "scaled_pnl")
    return (val as number) >= 0 ? theme.colors.accent : theme.colors.danger;
  if (key === "max_drawdown") return theme.colors.danger;
  if (key === "win_rate")
    return (val as number) >= 50 ? theme.colors.accent : theme.colors.danger;
  return theme.colors.textPrimary;
};

const ResultsTable = ({ data, loading }: Props) => {
  const [sortCol, setSortCol] = useState<keyof ORBResultsRow>("scaled_pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (col: keyof ORBResultsRow) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(
    () =>
      [...data].sort((a, b) => {
        const va = a[sortCol],
          vb = b[sortCol];
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      }),
    [data, sortCol, sortDir],
  );

  if (!data.length && !loading)
    return <Status>Adjust filters and click Apply to load results.</Status>;

  return (
    <>
      <Wrapper>
        <Table>
          <thead>
            <tr>
              {cols.map((c) => (
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
            {loading ? (
              <tr>
                <Td
                  colSpan={cols.length}
                  $color={theme.colors.textSecondary}
                  style={{ textAlign: "center", padding: "40px" }}
                >
                  Loading...
                </Td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <Tr key={i}>
                  {cols.map((c) => {
                    const raw = row[c.key];
                    const val = c.format ? c.format(raw as number) : raw;
                    return (
                      <Td
                        key={c.key}
                        $color={getCellColor(c.key, raw as number)}
                      >
                        {val}
                      </Td>
                    );
                  })}
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </Wrapper>
      <Footer>{data.length} rows</Footer>
    </>
  );
};

export default ResultsTable;

const Wrapper = styled.div`
  overflow-x: auto;
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

const Status = styled.div`
  color: ${theme.colors.textSecondary};
  font-size: 13px;
  padding: 40px 0;
  text-align: center;
  font-family: ${theme.fonts.mono};
`;
