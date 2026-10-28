import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PageParams, PaginatedResponseSchema, SearchTermParams, SortParams } from "../types";

export type LeaderboardSortKey = "volume" | "realized_pnl" | "roi" | "account_value";

/** A rolling window to rank realized PnL over; "all" is the all-time board. */
export type LeaderboardWindow = "24h" | "7d" | "30d" | "all";

export interface LeaderboardRequestArgs
  extends BaseRequestArgs, PageParams, SearchTermParams, SortParams<LeaderboardSortKey> {
  /** Ranks over a window instead of all time; the trading API takes it with realized_pnl only. */
  window?: LeaderboardWindow;
}

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
