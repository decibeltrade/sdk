import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface UserActiveTwapsRequestArgs extends BaseRequestArgs {
  subAddr: string;
}

export const UserActiveTwapSchema = z.object({
  market: z.string(),
  is_buy: z.boolean(),
  order_id: z.string(),
  client_order_id: z.string().nullable().optional(),
  is_reduce_only: z.boolean(),
  start_unix_ms: z.number(),
  frequency_s: z.number(),
  duration_s: z.number(),
  orig_size: z.number(),
  remaining_size: z.number(),
  status: z.string(),
  transaction_unix_ms: z.number(),
  transaction_version: z.number(),
});

export const UserActiveTwapsSchema = z.array(UserActiveTwapSchema);

export const UserActiveTwapsWsMessageSchema = z.object({
  twaps: z.array(UserActiveTwapSchema),
});

export type UserActiveTwap = z.infer<typeof UserActiveTwapSchema>;
export type UserActiveTwaps = z.infer<typeof UserActiveTwapsSchema>;
export type UserActiveTwapsWsMessage = z.infer<typeof UserActiveTwapsWsMessageSchema>;
