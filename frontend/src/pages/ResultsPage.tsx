import { useMemo, useState } from "react";
import styled from "styled-components";
import { theme } from "../styles/theme";
import ResultsTable from "../components/ResultsTable";
import { fetchResults } from "../api/results";
import type { ORBResultsRequest, ORBResultsRow } from "../api/results";

const defaultFilters: ORBResultsRequest = {
  max_drawdown: -99999.0,
  min_trades: 0,
  direction: null,
  target_drawdown: 1000.0,
};

const ResultsPage = () => {
  const [data, setData] = useState<ORBResultsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ORBResultsRequest>(defaultFilters);

  const handleSlider =
    (key: keyof ORBResultsRequest) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }));
    };

  const handleDirection = (val: "long" | "short" | null) => {
    setFilters((prev) => ({ ...prev, direction: val }));
  };

  const memoizedTable = useMemo(
    () => <ResultsTable data={data} loading={loading} />,
    [data, loading],
  );
  const handleApply = () => {
    setLoading(true);
    setError(null);
    fetchResults(filters)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Page>
      <Header>
        <HeaderRow>
          <HeaderDot />
          <HeaderMeta>NQ Futures</HeaderMeta>
        </HeaderRow>
        <Title>Precomputed Results</Title>
        <Subtitle>
          All take profit / stop loss combinations for 09:30–09:45 ET
        </Subtitle>
      </Header>

      <FiltersGrid>
        <SliderGroup>
          <SliderLabel>
            Max Drawdown
            <Value>
              {filters.max_drawdown === -99999
                ? "Any"
                : filters.max_drawdown.toFixed(0)}
            </Value>
          </SliderLabel>
          <Slider
            type="range"
            min="-5000"
            max="0"
            step="50"
            value={
              filters.max_drawdown === -99999 ? -5000 : filters.max_drawdown
            }
            onChange={handleSlider("max_drawdown")}
          />
        </SliderGroup>

        <Divider />

        <SliderGroup>
          <SliderLabel>
            Min Trades
            <Value>{filters.min_trades}</Value>
          </SliderLabel>
          <Slider
            type="range"
            min="0"
            max="700"
            step="1"
            value={filters.min_trades}
            onChange={handleSlider("min_trades")}
          />
        </SliderGroup>

        <Divider />

        <SliderGroup>
          <SliderLabel>
            Direction
          </SliderLabel>
          <DirButtons>
            <DirBtn
              $active={filters.direction === "long"}
              $color="#3b82f6"
              onClick={() => handleDirection(filters.direction === "long" ? null : "long")}
            >
              Long
            </DirBtn>
            <DirBtn
              $active={filters.direction === "short"}
              $color="#f97316"
              onClick={() => handleDirection(filters.direction === "short" ? null : "short")}
            >
              Short
            </DirBtn>
          </DirButtons>
        </SliderGroup>

        <Divider />

        <SliderGroup>
          <SliderLabel>
            DD Limit (Risk)
            <Value>{filters.target_drawdown}</Value>
          </SliderLabel>
          <Slider
            type="range"
            min="100"
            max="10000"
            step="100"
            value={filters.target_drawdown}
            onChange={handleSlider("target_drawdown")}
          />
        </SliderGroup>

        <ApplyButton onClick={handleApply} disabled={loading}>
          {loading ? "Loading..." : "Apply →"}
        </ApplyButton>
      </FiltersGrid>

      {error && <Error>{error}</Error>}
      {memoizedTable}
    </Page>
  );
};

export default ResultsPage;

const Header = styled.div`
  margin-bottom: 48px;
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
  background: ${theme.colors.accent};
`;
const HeaderMeta = styled.span`
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-family: ${theme.fonts.mono};
`;
const Title = styled.h1`
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #fff;
  font-family: ${theme.fonts.mono};
`;
const Subtitle = styled.p`
  color: ${theme.colors.textSecondary};
  font-size: 12px;
  margin-top: 6px;
  font-family: ${theme.fonts.mono};
`;
const Error = styled.div`
  color: ${theme.colors.danger};
  font-size: 13px;
  margin-bottom: 24px;
  padding: 12px 16px;
  border: 1px solid #331111;
  border-radius: 2px;
  font-family: ${theme.fonts.mono};
`;

const FiltersGrid = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
  margin-bottom: 32px;
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  overflow: hidden;
`;

const SliderGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  padding: 24px;
`;

const SliderLabel = styled.label`
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: ${theme.fonts.mono};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Value = styled.span`
  color: ${theme.colors.accent};
  font-size: 11px;
`;

const Slider = styled.input`
  -webkit-appearance: none;
  width: 100%;
  height: 2px;
  background: ${theme.colors.border};
  border-radius: 2px;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${theme.colors.accent};
    cursor: pointer;
    transition: transform 0.15s;

    &:hover {
      transform: scale(1.3);
    }
  }
`;

const Divider = styled.div`
  width: 1px;
  background: ${theme.colors.border};
  align-self: stretch;
`;

const DirButtons = styled.div`
  display: flex;
  gap: 8px;
  height: 36px;
`;

const DirBtn = styled.button<{ $active: boolean; $color: string }>`
  flex: 1;
  background: ${({ $active, $color }) => ($active ? $color : "transparent")};
  color: ${({ $active, $color }) => ($active ? "#000" : $color)};
  border: 1px solid ${({ $color }) => $color};
  border-radius: 2px;
  font-family: ${theme.fonts.mono};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  white-space: nowrap;
`;

const ApplyButton = styled.button`
  align-self: stretch;
  background: #fff;
  color: #000;
  border: none;
  border-left: 1px solid ${theme.colors.border};
  font-family: ${theme.fonts.mono};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0 28px;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  white-space: nowrap;

  &:hover {
    background: ${theme.colors.accent};
  }

  &:disabled {
    background: #1a1a1a;
    color: ${theme.colors.textSecondary};
    cursor: not-allowed;
  }
`;

const Page = styled.div`
  min-height: 100vh;
  background: ${theme.colors.bg};
  color: ${theme.colors.textPrimary};
  font-family: ${theme.fonts.mono};
  padding: 48px 40px;
`;
