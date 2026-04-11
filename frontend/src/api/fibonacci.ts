import client from "./client";
import type { ORBTradeData, ORBResult } from "./backtest";

export interface FibTradeData extends ORBTradeData {
  entry_price: number;
}

export interface FibResult {
  trades: FibTradeData[];
  biggest_drawdown: number;
  drawdown_start: string;
  drawdown_end: string;
}

export interface FibRequest {
  start_date: string;
  long_entry_trigger: number;
  long_take_profit: number;
  long_stop_loss: number;
  short_entry_trigger: number;
  short_take_profit: number;
  short_stop_loss: number;
  range_start: string;
  range_end: string;
  direction?: "long" | "short" | null;
  min_or_delta?: number | null;
  max_or_delta?: number | null;
}

export const fetchFibonacci = async (params: FibRequest): Promise<FibResult> => {
  const { data } = await client.post<FibResult>("/backtest/fib", {
    ...params,
    long_entry_trigger: parseFloat(String(params.long_entry_trigger)),
    long_take_profit: parseFloat(String(params.long_take_profit)),
    long_stop_loss: parseFloat(String(params.long_stop_loss)),
    short_entry_trigger: parseFloat(String(params.short_entry_trigger)),
    short_take_profit: parseFloat(String(params.short_take_profit)),
    short_stop_loss: parseFloat(String(params.short_stop_loss)),
  });
  return data;
};
