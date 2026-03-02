import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export type GlobalPointsStatsRequestArgs = BaseRequestArgs;

export const GlobalPointsStatsSchema = z.object({
  total_users: z.number(),
  total_amps_distributed: z.number(),
});

export type GlobalPointsStats = z.infer<typeof GlobalPointsStatsSchema>;
