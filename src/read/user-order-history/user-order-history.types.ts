import z from "zod/v4";

import { AssetType, AssetTypeSchema } from "../asset-type.types";
import { BaseRequestArgs } from "../base-reader";
import { HistoryFilterParams, PaginatedResponseSchema } from "../pagination.types";

export interface UserOrderHistoryRequestArgs extends BaseRequestArgs, HistoryFilterParams {
  subAddr: string;
  limit?: number;
  offset?: number;
  /**
   * Server-side product filter. Omit to receive perp and spot merged
   * (each row carries `asset_type`); pass `"perp"` or `"spot"` to scope
   * the response (and its pagination) to one product. Only send this against
   * a trading-api version with spot support: older servers reject requests
   * carrying unknown parameters.
   */
  assetType?: AssetType;
}

export const UserOrderSchema = z.object({
  /** Absent on API versions that predate spot support (treat as "perp"). */
  asset_type: AssetTypeSchema.optional(),
  /** Spot orders carry the explicit time-in-force ("GTC"/"IOC"/"POST_ONLY"). */
  time_in_force: z.string().optional(),
  parent: z.string(),
  market: z.string(),
  client_order_id: z.string(),
  order_id: z.string(),
  status: z.string(),
  order_type: z.string(),
  trigger_condition: z.string(),
  order_direction: z.string(),
  orig_size: z.number().nullable(),
  remaining_size: z.number().nullable(),
  size_delta: z.number().nullable(),
  price: z.number().nullable(),
  is_buy: z.boolean(),
  is_reduce_only: z.boolean(),
  details: z.string(),
  is_tpsl: z.boolean(),
  tp_trigger_price: z.number().nullable(),
  tp_limit_price: z.number().nullable(),
  sl_trigger_price: z.number().nullable(),
  sl_limit_price: z.number().nullable(),
  cancellation_reason: z.string().default(""),
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
