import client from "./client";

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Granularity = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

export const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "1m",  label: "1m"  },
  { value: "5m",  label: "5m"  },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h",  label: "1h"  },
  { value: "4h",  label: "4h"  },
  { value: "1d",  label: "1D"  },
];

export const fetchChart = async (
  start: string,
  end: string,
  granularity: Granularity = "1m",
): Promise<Candle[]> => {
  const { data } = await client.get<Candle[]>("/chart", {
    params: { start, end, granularity },
  });
  return data;
};
