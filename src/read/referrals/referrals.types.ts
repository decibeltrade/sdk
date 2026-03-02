import { z } from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PageParams } from "../pagination.types";

export interface UserReferralsRequestArgs extends BaseRequestArgs, PageParams {
  referrerAccount: string;
}

// GET /api/v1/referrals/code/{code}
export const ReferralCodeValidationSchema = z.object({
  referral_code: z.string(),
  is_valid: z.boolean(),
  is_active: z.boolean(),
});

// POST /api/v1/referrals/redeem
export const RedeemReferralResponseSchema = z.object({
  referral_code: z.string(),
  account: z.string(),
});

// GET /api/v1/referrals/account/{account}
export const AccountReferralSchema = z.object({
  account: z.string(),
  referrer_account: z.string(),
  referral_code: z.string(),
  is_affiliate_referral: z.boolean(),
  referred_at_ms: z.number(),
  is_active: z.boolean(),
});

// GET /api/v1/referrals/stats/{account}
export const ReferrerStatsSchema = z.object({
  referrer_account: z.string(),
  total_referrals: z.number(),
  total_codes_created: z.number(),
  is_affiliate: z.boolean(),
  codes: z.array(z.string()),
  volume_threshold_met: z.boolean(),
});

// GET /api/v1/affiliates/codes/{account}
const ReferralCodeSourceSchema = z.enum(["admin", "auto", "predeposit", "unknown"]);

// GET /api/v1/referrals/users
export const UserReferralSchema = z.object({
  account: z.string(),
  referrer_account: z.string(),
  referral_code: z.string(),
  is_affiliate_referral: z.boolean(),
  referred_at_ms: z.number(),
});

// GET /api/v1/referrals/users
export const UserReferralsResponseSchema = z.array(UserReferralSchema);

// GET /api/v1/affiliates/codes/{account}
export const AffiliateCodeSchema = z.object({
  referral_code: z.string(),
  owner_account: z.string(),
  max_usage: z.number(),
  usage_count: z.number(),
  is_active: z.boolean(),
  is_affiliate: z.boolean(),
  source: ReferralCodeSourceSchema,
  created_at_ms: z.number(),
});

// GET /api/v1/affiliates/codes/{account}
export const AffiliateCodesResponseSchema = z.object({
  owner_account: z.string(),
  codes: z.array(AffiliateCodeSchema),
  volume_threshold_met: z.boolean(),
});

// GET /api/v1/affiliates/earnings/{account}
export const AffiliateReferredUserSchema = z.object({
  account: z.string(),
  level: z.enum(["L1", "L2"]),
  referred_by: z.string().nullable(),
  total_amps: z.number(),
  affiliate_amps_earned: z.number(),
  total_volume: z.number(),
  active: z.boolean(),
});

export const AffiliateEarningsBreakdownSchema = z.object({
  l1_amps: z.number(),
  l2_amps: z.number(),
  total_amps: z.number(),
  l1_count: z.number(),
  l2_count: z.number(),
});

export const AffiliateEarningsResponseSchema = z.object({
  affiliate_account: z.string(),
  is_affiliate: z.boolean(),
  earnings: AffiliateEarningsBreakdownSchema,
  users: z.object({
    items: z.array(AffiliateReferredUserSchema),
    total_count: z.number(),
  }),
});

export type ReferralCodeValidation = z.infer<typeof ReferralCodeValidationSchema>;
export type RedeemReferralResponse = z.infer<typeof RedeemReferralResponseSchema>;
export type AccountReferral = z.infer<typeof AccountReferralSchema>;
export type ReferrerStats = z.infer<typeof ReferrerStatsSchema>;
export type UserReferral = z.infer<typeof UserReferralSchema>;
export type UserReferralsResponse = z.infer<typeof UserReferralsResponseSchema>;
export type AffiliateCode = z.infer<typeof AffiliateCodeSchema>;
export type AffiliateCodesResponse = z.infer<typeof AffiliateCodesResponseSchema>;
export type AffiliateReferredUser = z.infer<typeof AffiliateReferredUserSchema>;
export type AffiliateEarningsBreakdown = z.infer<typeof AffiliateEarningsBreakdownSchema>;
export type AffiliateEarningsResponse = z.infer<typeof AffiliateEarningsResponseSchema>;
