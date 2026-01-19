import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface UserOpenOrdersRequestArgs extends BaseRequestArgs {
  subAddr: string;
}

export const UserOpenOrderSchema = z.object({
  parent: z.string(),
  market: z.string(),
  order_id: z.string(),
  client_order_id: z.string().nullable(),
  orig_size: z.number().nullable(),
  remaining_size: z.number().nullable(),
  size_delta: z.number().nullable(),
  price: z.number().nullable(),
  is_buy: z.boolean(),
  details: z.string(),
  transaction_version: z.number(),
  unix_ms: z.number(),
  tp_order_id: z.string().nullable(),
  tp_trigger_price: z.number().nullable(),
  tp_limit_price: z.number().nullable(),
  sl_order_id: z.string().nullable(),
  sl_trigger_price: z.number().nullable(),
  sl_limit_price: z.number().nullable(),
  order_type: z.string().optional(),
  trigger_condition: z.string().optional(),
  order_direction: z.string().optional(),
  is_reduce_only: z.boolean().optional(),
});

export const UserOpenOrdersSchema = z.object({
  items: z.array(UserOpenOrderSchema),
  total_count: z.number(),
});

export const UserOpenOrdersWsMessageSchema = z.object({
  orders: z.array(UserOpenOrderSchema),
});

export type UserOpenOrder = z.infer<typeof UserOpenOrderSchema>;
export type UserOpenOrdersResponse = z.infer<typeof UserOpenOrdersSchema>;
/** @deprecated Use UserOpenOrder[] instead */
export type UserOpenOrders = UserOpenOrder[];
export type UserOpenOrdersWsMessage = z.infer<typeof UserOpenOrdersWsMessageSchema>;
