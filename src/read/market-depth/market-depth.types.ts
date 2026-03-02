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
  asks: z.array(MarketOrderSchema),
  bids: z.array(MarketOrderSchema),
  best_ask: z.number().nullable().optional(),
  best_bid: z.number().nullable().optional(),
  unix_ms: z.number(),
});

export type MarketDepthAggregationSize = 1 | 2 | 5 | 10 | 100 | 1000;
export type MarketOrder = z.infer<typeof MarketOrderSchema>;
export type MarketDepth = z.infer<typeof MarketDepthSchema>;
