import { z } from "zod/v4";

// Campaign type constants (matches Move u8 constants)
export const CampaignType = {
  FeeRebate: 0,
  MakerIncentive: 1,
  LiquidationRebate: 2,
  VolumeMilestone: 3,
} as const;
export type CampaignType = (typeof CampaignType)[keyof typeof CampaignType];

// Campaign status constants (matches Move u8 constants)
export const CampaignStatus = {
  Draft: 0,
  Funded: 1,
  Active: 2,
  Expired: 3,
  Reclaimed: 4,
  Cancelled: 5,
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

/**
 * Schema for CampaignView returned by get_campaign view function.
 * Fields match the Move CampaignView struct.
 */
export const CampaignViewSchema = z.object({
  campaign_id: z.coerce.string(),
  campaign_type: z.coerce.number(),
  title: z.string(),
  description: z.string(),
  reward_asset: z.object({ inner: z.string() }).transform((v) => v.inner),
  start_ts_sec: z.coerce.string(),
  end_ts_sec: z.coerce.string(),
  claim_start_ts_sec: z.coerce.string(),
  claim_end_ts_sec: z.coerce.string(),
  sponsor: z.string(),
  status: z.coerce.number(),
  total_funded: z.coerce.string(),
  total_allocated: z.coerce.string(),
  total_claimed: z.coerce.string(),
});
export type CampaignView = z.infer<typeof CampaignViewSchema>;

/**
 * Schema for ClaimView returned by get_user_campaign_claim view function.
 * Fields match the Move ClaimView struct.
 */
export const ClaimViewSchema = z.object({
  campaign_id: z.coerce.string(),
  campaign_type: z.coerce.number(),
  status: z.coerce.number(),
  reward_asset: z.object({ inner: z.string() }).transform((v) => v.inner),
  claimable_amount: z.coerce.string(),
  claimed_amount: z.coerce.string(),
  claim_window_open: z.boolean(),
  claim_expired: z.boolean(),
  metric_value: z.coerce.string(),
  title: z.string(),
  description: z.string(),
  has_allocation: z.boolean(),
});
export type ClaimView = z.infer<typeof ClaimViewSchema>;

export interface GetCampaignArgs {
  campaignAddress: string;
}

export interface GetUserCampaignClaimsArgs {
  userAddress: string;
  campaignIds: number[];
}
