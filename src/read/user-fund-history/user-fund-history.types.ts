import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PageParams } from "../pagination.types";

export interface UserFundHistoryRequestArgs extends BaseRequestArgs, PageParams {
  subAddr: string;
}

export const FundMovementTypeSchema = z.enum(["deposit", "withdrawal"]);

export const UserFundSchema = z.object({
  movement_type: FundMovementTypeSchema,
  amount: z.number(),
  balance_after: z.number(),
  timestamp: z.number(),
  transaction_version: z.number(),
});

export const UserFundHistoryResponseSchema = z.object({
  funds: z.array(UserFundSchema),
  total: z.number(),
});

export type FundMovementType = z.infer<typeof FundMovementTypeSchema>;
export type UserFund = z.infer<typeof UserFundSchema>;
export type UserFundHistoryResponse = z.infer<typeof UserFundHistoryResponseSchema>;
