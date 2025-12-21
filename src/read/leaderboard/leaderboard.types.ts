import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PageParams, PaginatedResponseSchema, SearchTermParams, SortParams } from "../types";

export type LeaderboardSortKey = "volume" | "realized_pnl" | "roi" | "account_value";

export interface LeaderboardRequestArgs
  extends BaseRequestArgs,
    PageParams,
    SearchTermParams,
    SortParams<LeaderboardSortKey> {}

export const LeaderboardItemSchema = z.object({
  rank: z.number(),
  account: z.string(),
  account_value: z.number(),
  realized_pnl: z.number(),
  roi: z.number(),
  volume: z.number(),
});

export const LeaderboardSchema = PaginatedResponseSchema(LeaderboardItemSchema);

export type LeaderboardItem = z.infer<typeof LeaderboardItemSchema>;
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
