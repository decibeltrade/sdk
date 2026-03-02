import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PaginatedResponseSchema } from "../pagination.types";

export interface UserTradeHistoryRequestArgs extends BaseRequestArgs {
  subAddr: string;
  limit?: number;
  offset?: number;
}

export const UserTradeSchema = z.object({
  account: z.string(),
  market: z.string(),
  action: z.enum(["OpenLong", "CloseLong", "OpenShort", "CloseShort", "Net"]),
  source: z.enum(["OrderFill", "MarginCall", "BackStopLiquidation", "ADL", "MarketDelisted"]),
  trade_id: z.string(),
  size: z.number(),
  price: z.number(),
  is_profit: z.boolean(),
  realized_pnl_amount: z.number(),
  realized_funding_amount: z.number(),
  is_rebate: z.boolean(),
  fee_amount: z.number(),
  order_id: z.string(),
  client_order_id: z.string().optional(),
  transaction_unix_ms: z.number(),
  transaction_version: z.number(),
});

export const UserTradesSchema = PaginatedResponseSchema(UserTradeSchema);
export const UserTradesWsMessageSchema = z.object({
  trades: z.array(UserTradeSchema),
});

export type UserTrade = z.infer<typeof UserTradeSchema>;
export type UserTrades = z.infer<typeof UserTradesSchema>;
export type UserTradesWsMessage = z.infer<typeof UserTradesWsMessageSchema>;
