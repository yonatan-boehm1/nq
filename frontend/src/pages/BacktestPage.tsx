import { useMemo, useState } from "react";
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
  take_profit: 1.0,
  stop_loss: 0.5,
  range_start: "09:30",
  range_end: "09:45",
  direction: null,
};

const App = () => {
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

  const memoizedTable = useMemo(
    () => <TradeTable data={data} />,
    [data, loading],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleDirectionChange = (val: "long" | "short" | null) => {
    setForm((f) => ({ ...f, direction: val }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSubmitted(false);
    try {
      const trade_data = await fetchBacktest({
        ...form,
        take_profit: parseFloat(String(form.take_profit)),
        stop_loss: parseFloat(String(form.stop_loss)),
      });
      setData(trade_data.trades);
      setDrawdown({
        max: trade_data.biggest_drawdown,
        start: trade_data.drawdown_start,
        end: trade_data.drawdown_end,
      });
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
          onSubmit={handleSubmit}
          loading={loading}
        />

        {error && <ErrorBox>{error}</ErrorBox>}
        {submitted && data.length === 0 && (
          <Empty>No trades found for the selected parameters.</Empty>
        )}
        {submitted && data.length > 0 && (
          <>
            <StatCards
              data={data}
              maxDrawdown={drawdown.max}
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

export default App;

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
