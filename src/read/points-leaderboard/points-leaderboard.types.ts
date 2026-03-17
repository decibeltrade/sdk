import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PageParams, PaginatedResponseSchema, SearchTermParams, SortParams } from "../types";

export type PointsLeaderboardSortKey = "total_amps" | "realized_pnl";

export type PointsLeaderboardTierFilter = "top20" | "diamond" | "doublePlatinum" | "gold";

export interface PointsLeaderboardRequestArgs
  extends BaseRequestArgs,
    PageParams,
    SearchTermParams,
    SortParams<PointsLeaderboardSortKey> {
  tier?: PointsLeaderboardTierFilter;
}

export const PointsLeaderboardItemSchema = z.object({
  rank: z.number(),
  owner: z.string(),
  total_amps: z.number(),
  realized_pnl: z.number(),
  referral_amps: z.number(),
  vault_amps: z.number(),
  streak_amps: z.number(),
  bonus_amps: z.number().default(0),
});

export const PointsLeaderboardSchema = PaginatedResponseSchema(PointsLeaderboardItemSchema);

export type PointsLeaderboardItem = z.infer<typeof PointsLeaderboardItemSchema>;
export type PointsLeaderboard = z.infer<typeof PointsLeaderboardSchema>;
