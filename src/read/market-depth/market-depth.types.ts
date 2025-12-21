import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface MarketDepthRequestArgs extends BaseRequestArgs {
  marketName: string;
  limit?: number;
}

export const MarketOrderSchema = z.object({
  price: z.number(),
  size: z.number(),
});

export const MarketDepthSchema = z.object({
  market: z.string(),
  bids: z.array(MarketOrderSchema),
  asks: z.array(MarketOrderSchema),
});

// TODO: These values will change in the near future
export type MarketDepthAggregationSize = 1 | 2 | 5 | 10;
export type MarketOrder = z.infer<typeof MarketOrderSchema>;
export type MarketDepth = z.infer<typeof MarketDepthSchema>;
