import { useMemo, useState, useEffect } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { theme } from "../styles/theme";
import { fetchBacktest } from "../api/backtest";
import type { ORBResult, ORBTradeData } from "../api/backtest";
import type { FormValues } from "../components/Form";
import Form from "../components/Form";
import StatCards from "../components/StatCards";
import TradeTable from "../components/TradeTable";

const defaultForm: FormValues = {
  start_date: "2021-02-01",
  long_take_profit: 1.0,
  long_stop_loss: 0.5,
  short_take_profit: 1.0,
  short_stop_loss: 0.5,
  range_start: "09:30",
  range_end: "09:45",
  direction: null,
  mode: "fast",
};

const BacktestPage = () => {
  const [form, setForm] = useState<FormValues>(defaultForm);
  const [data, setData] = useState<ORBTradeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [drawdown, setDrawdown] = useState<{
    max: number;
    start: string;
    end: string;
  }>({ max: 0, start: "", end: "" });
  const [targetDrawdown, setTargetDrawdown] = useState<number>(1000);
  const [sliderValue, setSliderValue] = useState<number>(1000);

  useEffect(() => {
    const handler = setTimeout(() => {
      setTargetDrawdown(sliderValue);
    }, 150);
    return () => clearTimeout(handler);
  }, [sliderValue]);

  const multiplier = drawdown.max !== 0 ? targetDrawdown / Math.abs(drawdown.max) : 1;

  const scaledData = useMemo(() => {
    if (!data.length) return [];
    return data.map((d) => ({
      ...d,
      trade_delta: d.trade_delta !== null ? d.trade_delta * multiplier : 0,
    }));
  }, [data, multiplier]);

  const memoizedTable = useMemo(
    () => <TradeTable data={scaledData} />,
    [scaledData],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleDirectionChange = (val: "long" | "short" | null) => {
    setForm((f) => ({ ...f, direction: val }));
  };

  const handleModeChange = (val: "fast" | "accurate") => {
    setForm((f) => ({ ...f, mode: val }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSubmitted(false);
    try {
      const trade_data = await fetchBacktest({
        ...form,
        long_take_profit: parseFloat(String(form.long_take_profit)),
        long_stop_loss: parseFloat(String(form.long_stop_loss)),
        short_take_profit: parseFloat(String(form.short_take_profit)),
        short_stop_loss: parseFloat(String(form.short_stop_loss)),
      });
      setData(trade_data.trades);
      setDrawdown({
        max: trade_data.biggest_drawdown,
        start: trade_data.drawdown_start,
        end: trade_data.drawdown_end,
      });
      const initialDD = trade_data.biggest_drawdown !== 0 ? Math.abs(trade_data.biggest_drawdown) : 1000;
      setSliderValue(initialDD);
      setTargetDrawdown(initialDD);
      setSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Page>
        <Header>
          <HeaderRow>
            <HeaderDot />
            <HeaderMeta>NQ Futures</HeaderMeta>
          </HeaderRow>
          <Title>ORB Backtest</Title>
          <Subtitle>Opening Range Breakout — 16:30–16:45 EST</Subtitle>
        </Header>

        <Form
          form={form}
          onChange={handleChange}
          onDirectionChange={handleDirectionChange}
          onModeChange={handleModeChange}
          onSubmit={handleSubmit}
          loading={loading}
        />

        {error && <ErrorBox>{error}</ErrorBox>}
        {submitted && data.length === 0 && (
          <Empty>No trades found for the selected parameters.</Empty>
        )}
        {submitted && data.length > 0 && (
          <>
            <SizingBox>
              <SizingLabel>
                Target DD Limit
                <SizingValue>${(sliderValue).toFixed(0)}</SizingValue>
              </SizingLabel>
              <SizingSlider
                type="range"
                min="10"
                max="10000"
                step="10"
                value={sliderValue}
                onChange={(e) => setSliderValue(parseFloat(e.target.value))}
              />
              <SizingInfo>
                Position size scaled by {(multiplier).toFixed(2)}x
              </SizingInfo>
            </SizingBox>
            <StatCards
              data={scaledData}
              maxDrawdown={drawdown.max * multiplier}
              drawdownStart={drawdown.start}
              drawdownEnd={drawdown.end}
            />
            {memoizedTable}
          </>
        )}
      </Page>
    </>
  );
};

export default BacktestPage;

export const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${theme.colors.bg}; margin: 0; padding: 0; }
  ::-webkit-scrollbar { height: 4px; background: #111; }
  ::-webkit-scrollbar-thumb { background: #333; }
`;

export const Page = styled.div`
  min-height: 100vh;
  background: ${theme.colors.bg};
  color: ${theme.colors.textPrimary};
  font-family: ${theme.fonts.mono};
  padding: 48px 40px;
`;

export const Header = styled.div`
  margin-bottom: 48px;
`;

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
`;

export const HeaderDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${theme.colors.accent};
`;

export const HeaderMeta = styled.span`
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

export const Title = styled.h1`
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #fff;
`;

export const Subtitle = styled.p`
  color: ${theme.colors.textSecondary};
  font-size: 12px;
  margin-top: 6px;
`;

export const ErrorBox = styled.div`
  color: ${theme.colors.danger};
  font-size: 13px;
  margin-bottom: 24px;
  padding: 12px 16px;
  border: 1px solid #331111;
  border-radius: 2px;
`;

export const Empty = styled.div`
  color: ${theme.colors.textSecondary};
  font-size: 13px;
  padding: 40px 0;
  text-align: center;
`;

const SizingBox = styled.div`
  display: flex;
  align-items: center;
  gap: 32px;
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  padding: 24px;
  margin-bottom: 24px;
  border-radius: 2px;
`;

const SizingLabel = styled.label`
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: ${theme.fonts.mono};
  display: flex;
  flex-direction: column;
  gap: 8px;
  white-space: nowrap;
`;

const SizingValue = styled.span`
  color: ${theme.colors.accent};
  font-size: 14px;
  font-weight: 700;
`;

const SizingSlider = styled.input`
  -webkit-appearance: none;
  flex: 1;
  height: 2px;
  background: ${theme.colors.border};
  border-radius: 2px;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${theme.colors.accent};
    cursor: pointer;
    transition: transform 0.15s;

    &:hover {
      transform: scale(1.3);
    }
  }
`;

const SizingInfo = styled.div`
  color: ${theme.colors.textMuted};
  font-size: 10px;
  font-family: ${theme.fonts.mono};
  white-space: nowrap;
`;
