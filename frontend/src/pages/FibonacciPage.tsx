import { useMemo, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { theme } from "../styles/theme";
import { fetchFibonacci } from "../api/fibonacci";
import type { FibTradeData } from "../api/fibonacci";
import StatCards from "../components/StatCards";
import TradeTable from "../components/TradeTable";
import FibForm, { FibFormValues } from "../components/FibForm";

const defaultForm: FibFormValues = {
  start_date: "2021-02-01",
  long_entry_trigger: 1.0,
  long_take_profit: 0.0,
  long_stop_loss: 1.272,
  short_entry_trigger: 1.0,
  short_take_profit: 0.0,
  short_stop_loss: 1.272,
  range_start: "02:00",
  range_end: "09:00",
  direction: null,
  min_or_delta: "",
  max_or_delta: "",
};

const FibonacciPage = () => {
  const [form, setForm] = useState<FibFormValues>(defaultForm);
  const [data, setData] = useState<FibTradeData[]>([]);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      const result = await fetchFibonacci({
        ...form,
        long_entry_trigger: parseFloat(String(form.long_entry_trigger)),
        long_take_profit: parseFloat(String(form.long_take_profit)),
        long_stop_loss: parseFloat(String(form.long_stop_loss)),
        short_entry_trigger: parseFloat(String(form.short_entry_trigger)),
        short_take_profit: parseFloat(String(form.short_take_profit)),
        short_stop_loss: parseFloat(String(form.short_stop_loss)),
        min_or_delta: form.min_or_delta !== "" ? parseFloat(form.min_or_delta) : null,
        max_or_delta: form.max_or_delta !== "" ? parseFloat(form.max_or_delta) : null,
      });
      setData(result.trades);
      setDrawdown({
        max: result.biggest_drawdown,
        start: result.drawdown_start,
        end: result.drawdown_end,
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
          <Title>Fibonacci Retracement</Title>
          <Subtitle>
            0.618 Extension Entry — OR Range 02:00–09:00 Israel Time
          </Subtitle>
        </Header>

        <FibForm
          form={form}
          onChange={handleChange}
          onDirectionChange={handleDirectionChange}
          onSubmit={handleSubmit}
          loading={loading}
        />

        {error && <ErrorBox>{error}</ErrorBox>}
        {submitted && data.length === 0 && (
          <Empty>No trades found.</Empty>
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

export default FibonacciPage;

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
