import z from "zod/v4";

import { AssetType, AssetTypeSchema } from "../asset-type.types";
import { BaseRequestArgs } from "../base-reader";
import { PaginatedResponseSchema } from "../pagination.types";

export interface UserOpenOrdersRequestArgs extends BaseRequestArgs {
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

export const UserOpenOrderSchema = z.object({
  /** Absent on API versions that predate spot support (treat as "perp"). */
  asset_type: AssetTypeSchema.optional(),
  /** Spot orders carry the explicit time-in-force ("GTC"/"IOC"/"POST_ONLY"). */
  time_in_force: z.string().optional(),
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
  is_tpsl: z.boolean(),
  tp_trigger_price: z.number().nullable(),
  tp_limit_price: z.number().nullable(),
  sl_trigger_price: z.number().nullable(),
  sl_limit_price: z.number().nullable(),
  order_type: z.string().optional(),
  trigger_condition: z.string().optional(),
  order_direction: z.string().optional(),
  is_reduce_only: z.boolean().optional(),
});

export const UserOpenOrdersSchema = PaginatedResponseSchema(UserOpenOrderSchema);

export const UserOpenOrdersWsMessageSchema = z.object({
  orders: z.array(UserOpenOrderSchema),
});

export type UserOpenOrder = z.infer<typeof UserOpenOrderSchema>;
export type UserOpenOrdersResponse = z.infer<typeof UserOpenOrdersSchema>;
/** @deprecated Use UserOpenOrder[] instead */
export type UserOpenOrders = UserOpenOrder[];
export type UserOpenOrdersWsMessage = z.infer<typeof UserOpenOrdersWsMessageSchema>;
