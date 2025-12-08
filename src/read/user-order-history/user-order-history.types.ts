import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PaginatedResponseSchema } from "../pagination.types";

export interface UserOrderHistoryRequestArgs extends BaseRequestArgs {
  subAddr: string;
}

export const UserOrderSchema = z.object({
  parent: z.string(),
  market: z.string(),
  client_order_id: z.string(),
  order_id: z.string(),
  status: z.string(),
  order_type: z.string(),
  trigger_condition: z.string(),
  order_direction: z.string(),
  orig_size: z.number(),
  remaining_size: z.number(),
  size_delta: z.number(),
  price: z.number(),
  is_buy: z.boolean(),
  is_reduce_only: z.boolean(),
  details: z.string(),
  tp_order_id: z.string().nullable(),
  tp_trigger_price: z.number().nullable(),
  tp_limit_price: z.number().nullable(),
  sl_order_id: z.string().nullable(),
  sl_trigger_price: z.number().nullable(),
  sl_limit_price: z.number().nullable(),
  transaction_version: z.number(),
  unix_ms: z.number(),
});

export const UserOrdersSchema = PaginatedResponseSchema(UserOrderSchema);

export const UserOrdersWsMessageSchema = z.object({
  order: z.object({
    details: z.string(),
    order: UserOrderSchema,
    status: z.string(),
  }),
});

export type UserOrder = z.infer<typeof UserOrderSchema>;
export type UserOrders = z.infer<typeof UserOrdersSchema>;
export type UserOrdersWsMessage = z.infer<typeof UserOrdersWsMessageSchema>;
