import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface MarketTradesRequestArgs extends BaseRequestArgs {
  marketName: string;
  limit?: number;
}

export const MarketTradeSchema = z.object({
  account: z.string(),
  market: z.string(),
  action: z.string(),
  size: z.number(),
  price: z.number(),
  is_profit: z.boolean(),
  realized_pnl_amount: z.number(),
  is_funding_positive: z.boolean(),
  realized_funding_amount: z.number(),
  is_rebate: z.boolean(),
  fee_amount: z.number(),
  transaction_unix_ms: z.number(),
  transaction_version: z.number(),
});

export const MarketTradesHistorySchema = z.array(MarketTradeSchema);

export const MarketTradeWsMessageSchema = z.object({
  trades: z.array(MarketTradeSchema),
});

export type MarketTrade = z.infer<typeof MarketTradeSchema>;
export type MarketTradesHistory = z.infer<typeof MarketTradesHistorySchema>;
export type MarketTradeWsMessage = z.infer<typeof MarketTradeWsMessageSchema>;
