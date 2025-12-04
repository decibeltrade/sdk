import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface UserPositionsRequestArgs extends BaseRequestArgs {
  subAddr: string;
  marketAddr?: string;
  includeDeleted?: boolean;
  limit?: number;
}

export const UserPositionSchema = z.object({
  market: z.string(),
  user: z.string(),
  size: z.number(),
  // margin: z.number(),
  max_allowed_leverage: z.number(),
  user_leverage: z.number(),
  entry_price: z.number(),
  is_isolated: z.boolean(),
  unrealized_funding: z.number(),
  estimated_liquidation_price: z.number(),
  tp_order_id: z.string().nullable(),
  tp_trigger_price: z.number().nullable(),
  tp_limit_price: z.number().nullable(),
  sl_order_id: z.string().nullable(),
  sl_trigger_price: z.number().nullable(),
  sl_limit_price: z.number().nullable(),
  has_fixed_sized_tpsls: z.boolean(),
});

export const UserPositionsSchema = z.array(UserPositionSchema);

export const UserPositionWsMessageSchema = z.object(UserPositionSchema);

export const UserPositionsWsMessageSchema = z.object({
  positions: UserPositionsSchema,
});

export type UserPosition = z.infer<typeof UserPositionSchema>;
export type UserPositions = z.infer<typeof UserPositionsSchema>;
export type UserPositionWsMessage = z.infer<typeof UserPositionWsMessageSchema>;
export type UserPositionsWsMessage = z.infer<typeof UserPositionsWsMessageSchema>;
