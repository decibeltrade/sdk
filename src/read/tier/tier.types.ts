import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface TierInfoRequestArgs extends BaseRequestArgs {
  /** The owner address to get tier info for */
  ownerAddr: string;
}

export const TierThresholdSchema = z.object({
  name: z.string(),
  hz_threshold: z.number(),
  progress: z.number(),
});

export const TierInfoSchema = z.object({
  owner: z.string(),
  total_amps: z.number(),
  rank: z.number().nullable(),
  current_tier: z.string().nullable(),
  tiers: z.array(TierThresholdSchema),
});

export type TierThreshold = z.infer<typeof TierThresholdSchema>;
export type TierInfo = z.infer<typeof TierInfoSchema>;
