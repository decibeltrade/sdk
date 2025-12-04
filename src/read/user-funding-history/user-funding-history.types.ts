import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface UserFundingHistoryRequestArgs extends BaseRequestArgs {
  subAddr: string;
  limit?: number;
}

export const UserFundingSchema = z.object({
  market: z.string(),
  action: z.string(),
  size: z.number(),
  is_funding_positive: z.boolean(),
  realized_funding_amount: z.number(),
  is_rebate: z.boolean(),
  fee_amount: z.number(),
  transaction_unix_ms: z.number(),
});

export const UserFundingHistorySchema = z.array(UserFundingSchema);

export const UserFundingHistoryWsMessageSchema = z.object({
  funding_history: UserFundingHistorySchema,
});

export type UserFunding = z.infer<typeof UserFundingSchema>;
export type UserFundingHistory = z.infer<typeof UserFundingHistorySchema>;
export type UserFundingHistoryWsMessage = z.infer<typeof UserFundingHistoryWsMessageSchema>;
