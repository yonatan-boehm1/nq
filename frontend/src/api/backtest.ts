import client from "./client";

export interface ORBRequest {
  start_date: string;
  long_take_profit: number;
  long_stop_loss: number;
  short_take_profit: number;
  short_stop_loss: number;
  range_start: string;
  range_end: string;
  direction?: "long" | "short" | null;
  mode: "fast" | "accurate";
}

export interface ORBTradeData {
  trade_day: string;
  trade_start_time: string;
  trade_end_time: string;
  direction: "long" | "short";
  or_high: number;
  or_low: number;
  target_price: number;
  stop_price: number;
  outcome: "PROFIT" | "STOP" | "MANUAL";
  or_delta: number;
  entry_price?: number;
  trade_delta: number;
}

export interface ORBResult {
  trades: ORBTradeData[];
  biggest_drawdown: number;
  drawdown_start: string;
  drawdown_end: string;
}

export const fetchBacktest = async (params: ORBRequest): Promise<ORBResult> => {
  const { data } = await client.post<ORBResult>("/backtest/orb", {
    ...params,
    long_take_profit: parseFloat(String(params.long_take_profit)),
    long_stop_loss: parseFloat(String(params.long_stop_loss)),
    short_take_profit: parseFloat(String(params.short_take_profit)),
    short_stop_loss: parseFloat(String(params.short_stop_loss)),
  });
  return data;
};
