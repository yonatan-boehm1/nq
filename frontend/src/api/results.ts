import client from "./client";

export interface ORBResultsRow {
  take_profit: number;
  stop_loss: number;
  direction: string;
  total_trades: number;
  win_rate: number;
  total_pnl: number;
  avg_pnl: number;
  profits: number;
  stops: number;
  max_drawdown: number;
  drawdown_start: string;
  drawdown_end: string;
  scaled_pnl: number;
}

export interface ORBResultsRequest {
  max_drawdown: number;
  min_trades: number;
  direction: "long" | "short" | null;
  target_drawdown: number;
}

export const fetchResults = async (
  params: ORBResultsRequest,
): Promise<ORBResultsRow[]> => {
  const { data } = await client.post<ORBResultsRow[]>("/results/orb", params);
  return data;
};
