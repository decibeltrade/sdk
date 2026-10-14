import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export type TrendingMarketsRequestArgs = BaseRequestArgs;

export const TrendingMarketSchema = z.object({
  market_addr: z.string(),
  rank: z.number(),
  is_new: z.boolean(),
});

export const TrendingMarketsResponseSchema = z.object({
  markets: z.array(TrendingMarketSchema),
});

export type TrendingMarket = z.infer<typeof TrendingMarketSchema>;
export type TrendingMarketsResponse = z.infer<typeof TrendingMarketsResponseSchema>;
