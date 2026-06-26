import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

export interface UserFeesRequestArgs extends BaseRequestArgs {
  /** The subaccount address to get fees and fee schedule for */
  subAddr: string;
}

/** Per-day trading volume entry for the current on-chain fee window. */
export const DailyUserVolumeSchema = z.object({
  /** Date in YYYY-MM-DD format (UTC) */
  date: z.string(),
  /** Total volume (USD, whole-dollar integer string) */
  volume: z.string(),
  /** Maker-side volume (USD, whole-dollar integer string) */
  maker_volume: z.string(),
  /** Taker-side volume (USD, whole-dollar integer string) */
  taker_volume: z.string(),
});

/**
 * A single VIP (volume-based) fee tier. Users qualify once their on-chain
 * fee-window volume reaches `volume_threshold` USD (inclusive, matches on-chain `>=`).
 */
export const VipTierSchema = z.object({
  /** Minimum fee-window USD volume (inclusive) to reach this tier, whole-dollar integer string */
  volume_threshold: z.string(),
  /** Taker fee rate at this tier (decimal, e.g. 0.000300 = 0.03%) */
  taker: z.number(),
  /** Maker fee rate at this tier (decimal, e.g. 0.000090 = 0.009%) */
  maker: z.number(),
});

/** A single market-maker rebate tier (empty when rebates are disabled). */
export const MarketMakerTierSchema = z.object({
  /** Fraction of global volume the user must provide as maker (decimal string, e.g. "0.005") */
  maker_fraction_threshold: z.string(),
  /** Maker rebate rate (negative decimal, e.g. -0.000010) */
  maker: z.number(),
});

/** Grouped fee tier schedules. */
export const FeeTiersSchema = z.object({
  /** Volume-based VIP tiers above the base (tier 0 rates live on the parent schedule) */
  vip: z.array(VipTierSchema),
  /** Market-maker rebate tiers (empty when rebates are disabled) */
  market_maker: z.array(MarketMakerTierSchema),
});

/** Fee schedule mirroring the current on-chain default tiers. Account-independent. */
export const FeeScheduleSchema = z.object({
  /** Base taker fee (tier 0, no volume requirement), decimal e.g. 0.000340 */
  taker: z.number(),
  /** Base maker fee (tier 0, no volume requirement), decimal e.g. 0.000110 */
  maker: z.number(),
  /** All fee tiers above the base */
  tiers: FeeTiersSchema,
  /** Referral discount fraction applied to referred users (0.0 when disabled) */
  referral_discount: z.number(),
});

/** Response for `GET /api/v1/user_fee_rates?account=<address>`. */
export const UserFeesSchema = z.object({
  /** The queried account address */
  account: z.string(),
  /** Daily volume breakdown for the current on-chain fee window (ascending date order) */
  daily_user_volume: z.array(DailyUserVolumeSchema),
  /** Fee schedule mirroring the current on-chain default tiers (all tiers) */
  fee_schedule: FeeScheduleSchema,
  /** User's effective taker rate after referral discount (decimal) */
  user_taker_rate: z.number(),
  /** User's effective maker rate after referral discount (decimal) */
  user_maker_rate: z.number(),
  /** User's current fee tier index (0 = base tier) */
  fee_tier: z.number(),
  /** Active referral discount fraction (0.0 if no referral or referrals disabled) */
  active_referral_discount: z.number(),
});

export type DailyUserVolume = z.infer<typeof DailyUserVolumeSchema>;
export type VipTier = z.infer<typeof VipTierSchema>;
export type MarketMakerTier = z.infer<typeof MarketMakerTierSchema>;
export type FeeTiers = z.infer<typeof FeeTiersSchema>;
export type FeeSchedule = z.infer<typeof FeeScheduleSchema>;
export type UserFees = z.infer<typeof UserFeesSchema>;
