import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PaginatedResponseSchema } from "../pagination.types";
import { UserActiveTwapSchema } from "../user-active-twaps/user-active-twaps.types";

export interface UserTwapHistoryRequestArgs extends BaseRequestArgs {
  subAddr: string;
  limit?: number;
  offset?: number;
}

// Reuse the same schema as active TWAPs since the response structure is identical
export const UserTwapHistorySchema = PaginatedResponseSchema(UserActiveTwapSchema);

export type UserTwapHistory = z.infer<typeof UserTwapHistorySchema>;
