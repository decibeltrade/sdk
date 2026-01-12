import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface UserTradeHistoryRequestArgs extends BaseRequestArgs {
  subAddr: string;
  limit?: number;
}

export const UserTradeSchema = z.object({
  account: z.string(),
  market: z.string(),
  action: z.enum(["OpenLong", "CloseLong", "OpenShort", "CloseShort", "Net"]),
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

export const UserTradesSchema = z.array(UserTradeSchema);
export const UserTradesWsMessageSchema = z.object({
  trades: z.array(UserTradeSchema),
});

export type UserTrade = z.infer<typeof UserTradeSchema>;
export type UserTrades = z.infer<typeof UserTradesSchema>;
export type UserTradesWsMessage = z.infer<typeof UserTradesWsMessageSchema>;
