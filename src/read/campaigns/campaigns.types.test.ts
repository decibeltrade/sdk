import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import {
  ActiveCampaignsSchema,
  CampaignClaimSchema,
  CampaignMetadataHttpSchema,
  CampaignStatusNameSchema,
  CampaignSummarySchema,
  CampaignTypeNameSchema,
  isKnownCampaignStatus,
  isKnownCampaignType,
  KnownCampaignStatusNameSchema,
  KnownCampaignTypeNameSchema,
  TypeBreakdownSchema,
} from "./campaigns.types";

const affiliateCampaign = {
  campaign_id: "5",
  campaign_type: "affiliate",
  status: "active",
  title: "Week 1 Affiliate Rewards",
  reward_asset: "0x123",
  start_ts_sec: "1700000000",
  end_ts_sec: "1703196800",
  claim_start_ts_sec: "1700604800",
  claim_end_ts_sec: "1703196800",
  total_funded: "100000000",
  description: null,
};

const feeRebateCampaign = {
  ...affiliateCampaign,
  campaign_id: 6,
  campaign_type: "fee_rebate",
  title: "Fee Rebate Rewards",
};

const affiliateClaim = {
  ...affiliateCampaign,
  has_allocation: true,
  claimable_amount: "25000000",
  claimed_amount: "0",
  ready_to_claim: "25000000",
  claimed_at_ts_sec: null,
  claim_tx_hash: null,
};

const feeRebateClaim = {
  ...affiliateClaim,
  ...feeRebateCampaign,
  claimable_amount: 10000000,
  claimed_amount: 10000000,
  ready_to_claim: 0,
  claimed_at_ts_sec: 1700604801,
  claim_tx_hash: "0xabc",
};

const breakdown = [
  {
    campaign_type: "affiliate",
    lifetime_earned: "25000000",
    ready_to_claim: "25000000",
    total_claimed: "0",
  },
  {
    campaign_type: "fee_rebate",
    lifetime_earned: 10000000,
    ready_to_claim: 0,
    total_claimed: 10000000,
  },
];

const summary = {
  lifetime_earned: "35000000",
  ready_to_claim: "25000000",
  total_claimed: "10000000",
  breakdown_by_type: breakdown,
  claims: [affiliateClaim, feeRebateClaim],
  year_to_date: "10000000",
  weekly_wow_bps: 0,
  weekly_breakdown: [{ week_start_ts_sec: "1700000000", reward_amount: "10000000" }],
  total_claims: "2",
};

describe("campaign response schemas", () => {
  it.each([
    "fee_rebate",
    "maker_incentive",
    "liquidation_rebate",
    "volume_milestone",
    "first_funded_trial",
    "affiliate",
    "discretionary",
  ])("accepts the %s campaign type", (campaignType) => {
    expect(CampaignTypeNameSchema.parse(campaignType)).toBe(campaignType);
  });

  it("parses an active list containing affiliate and existing campaigns", () => {
    const campaigns = ActiveCampaignsSchema.parse([affiliateCampaign, feeRebateCampaign]);

    expect(campaigns).toHaveLength(2);
    expect(campaigns[0]).toEqual({
      campaignId: 5,
      campaignType: "affiliate",
      status: "active",
      title: "Week 1 Affiliate Rewards",
      rewardAsset: "0x123",
      startTsSec: 1700000000,
      endTsSec: 1703196800,
      claimStartTsSec: 1700604800,
      claimEndTsSec: 1703196800,
      totalFunded: 100000000,
      description: undefined,
    });
    expect(campaigns[1]).toMatchObject({ campaignId: 6, campaignType: "fee_rebate" });
  });

  it("preserves allocation and claim details in mixed user claims", () => {
    const claims = z.array(CampaignClaimSchema).parse([affiliateClaim, feeRebateClaim]);

    expect(claims).toHaveLength(2);
    expect(claims[0]).toMatchObject({
      campaignId: 5,
      campaignType: "affiliate",
      hasAllocation: true,
      claimableAmount: 25000000,
      claimedAmount: 0,
      readyToClaim: 25000000,
      claimedAtTsSec: null,
      claimTxHash: null,
    });
    expect(claims[1]).toMatchObject({
      campaignId: 6,
      campaignType: "fee_rebate",
      claimedAmount: 10000000,
      readyToClaim: 0,
      claimedAtTsSec: 1700604801,
      claimTxHash: "0xabc",
    });
  });

  it("parses an earnings breakdown containing affiliate and existing types", () => {
    expect(z.array(TypeBreakdownSchema).parse(breakdown)).toEqual([
      {
        campaignType: "affiliate",
        lifetimeEarned: 25000000,
        readyToClaim: 25000000,
        totalClaimed: 0,
      },
      {
        campaignType: "fee_rebate",
        lifetimeEarned: 10000000,
        readyToClaim: 0,
        totalClaimed: 10000000,
      },
    ]);
  });

  it("parses a full summary with affiliate and existing campaign rewards", () => {
    const parsed = CampaignSummarySchema.parse(summary);

    expect(parsed).toMatchObject({
      lifetimeEarned: 35000000,
      readyToClaim: 25000000,
      totalClaimed: 10000000,
      yearToDate: 10000000,
      weeklyWowBps: 0,
      weeklyBreakdown: [{ weekStartTsSec: 1700000000, rewardAmount: 10000000 }],
      totalClaims: 2,
    });
    expect(parsed.claims.map((claim) => claim.campaignType)).toEqual(["affiliate", "fee_rebate"]);
    expect(parsed.breakdownByType.map((entry) => entry.campaignType)).toEqual([
      "affiliate",
      "fee_rebate",
    ]);
  });

  it("accepts the known campaign types as known", () => {
    for (const campaignType of KnownCampaignTypeNameSchema.options) {
      expect(isKnownCampaignType(campaignType)).toBe(true);
    }
    for (const status of KnownCampaignStatusNameSchema.options) {
      expect(isKnownCampaignStatus(status)).toBe(true);
    }
  });

  it("keeps the known schemas closed while the open schemas accept any string", () => {
    expect(KnownCampaignTypeNameSchema.safeParse("unknown").success).toBe(false);
    expect(KnownCampaignStatusNameSchema.safeParse("unknown").success).toBe(false);
    expect(CampaignTypeNameSchema.parse("unknown")).toBe("unknown");
    expect(CampaignStatusNameSchema.parse("unknown")).toBe("unknown");
  });
});

describe("campaign enum values this SDK predates", () => {
  const futureType = "some_future_type";
  const futureStatus = "some_future_status";

  it("preserves future-type and future-status rows in the active list", () => {
    const campaigns = ActiveCampaignsSchema.parse([
      affiliateCampaign,
      { ...feeRebateCampaign, campaign_type: futureType },
      { ...feeRebateCampaign, campaign_id: 7, status: futureStatus },
    ]);

    expect(campaigns.map((c) => [c.campaignId, c.campaignType, c.status])).toEqual([
      [5, "affiliate", "active"],
      [6, futureType, "active"],
      [7, "fee_rebate", futureStatus],
    ]);
    expect(campaigns.map((c) => isKnownCampaignType(c.campaignType))).toEqual([true, false, true]);
    expect(campaigns.map((c) => isKnownCampaignStatus(c.status))).toEqual([true, true, false]);
  });

  it("preserves future-type claims and breakdown rows in the summary", () => {
    const parsed = CampaignSummarySchema.parse({
      ...summary,
      breakdown_by_type: [...breakdown, { ...breakdown[0], campaign_type: futureType }],
      claims: [affiliateClaim, { ...feeRebateClaim, campaign_type: futureType }],
    });

    expect(parsed.claims.map((c) => c.campaignType)).toEqual(["affiliate", futureType]);
    expect(parsed.breakdownByType.map((b) => b.campaignType)).toEqual([
      "affiliate",
      "fee_rebate",
      futureType,
    ]);
    expect(parsed.claims.map((c) => isKnownCampaignType(c.campaignType))).toEqual([true, false]);
  });

  it("still rejects a known-type row with a malformed field", () => {
    expect(ActiveCampaignsSchema.safeParse([{ ...affiliateCampaign, title: 5 }]).success).toBe(
      false,
    );
  });

  it("still rejects a row with no campaign type", () => {
    const { campaign_type: _, ...untyped } = affiliateCampaign;
    expect(ActiveCampaignsSchema.safeParse([untyped]).success).toBe(false);
  });

  it("still rejects a non-string campaign type", () => {
    expect(
      CampaignMetadataHttpSchema.safeParse({ ...affiliateCampaign, campaign_type: 3 }).success,
    ).toBe(false);
    expect(CampaignClaimSchema.safeParse({ ...affiliateClaim, status: null }).success).toBe(false);
    expect(TypeBreakdownSchema.safeParse({ ...breakdown[0], campaign_type: 3 }).success).toBe(
      false,
    );
  });
});
