import client from "./client";

export interface ORBResultsRow {
  take_profit: number;
  stop_loss: number;
  total_trades: number;
  win_rate: number;
  total_pnl: number;
  avg_pnl: number;
  profits: number;
  stops: number;
  long_trades: number;
  short_trades: number;
  max_drawdown: number;
  drawdown_start: string;
  drawdown_end: string;
}

export interface ORBResultsRequest {
  max_drawdown: number;
  min_trades: number;
}

export const fetchResults = async (
  params: ORBResultsRequest,
): Promise<ORBResultsRow[]> => {
  const { data } = await client.post<ORBResultsRow[]>("/results/orb", params);
  return data;
};
