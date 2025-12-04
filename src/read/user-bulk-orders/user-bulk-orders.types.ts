import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface UserBulkOrdersRequestArgs extends BaseRequestArgs {
  subAddr: string;
  market?: string;
}

export const UserBulkOrderSchema = z.object({
  market: z.string(),
  sequence_number: z.number(),
  previous_seq_num: z.number(),
  bid_prices: z.array(z.number()),
  bid_sizes: z.array(z.number()),
  ask_prices: z.array(z.number()),
  ask_sizes: z.array(z.number()),
  cancelled_bid_prices: z.array(z.number()),
  cancelled_bid_sizes: z.array(z.number()),
  cancelled_ask_prices: z.array(z.number()),
  cancelled_ask_sizes: z.array(z.number()),
});

export const UserBulkOrdersSchema = z.array(UserBulkOrderSchema);

export const UserBulkOrdersWsMessageSchema = z.object({
  bulk_orders: z.array(UserBulkOrderSchema),
});

export type UserBulkOrder = z.infer<typeof UserBulkOrderSchema>;
export type UserBulkOrders = z.infer<typeof UserBulkOrdersSchema>;
export type UserBulkOrdersWsMessage = z.infer<typeof UserBulkOrdersWsMessageSchema>;
