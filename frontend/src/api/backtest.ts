import client from "./client";

export interface ORBRequest {
  start_date: string;
  take_profit: number;
  stop_loss: number;
  range_start: string;
  range_end: string;
}

export interface ORBTradeData {
  trade_day: string;
  trade_start_time: string;
  trade_end_time: string;
  trade_time_elapsed: string;
  direction: "long" | "short";
  or_high: number;
  or_low: number;
  target_price: number;
  stop_price: number;
  outcome: "PROFIT" | "STOP" | "MANUAL";
  or_delta: number;
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
    take_profit: parseFloat(String(params.take_profit)),
    stop_loss: parseFloat(String(params.stop_loss)),
  });
  console.log(data);
  return data;
};
