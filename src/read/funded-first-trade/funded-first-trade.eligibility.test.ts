import { describe, expect, it } from "vitest";

import { DEFAULT_ANCHORS, protectedAmountFor } from "../../protected-amount";
import { computeEligibility, EligibilityInputs } from "./funded-first-trade.eligibility";

const USDC = (n: number) => BigInt(Math.round(n * 1_000_000));

function baseInputs(overrides: Partial<EligibilityInputs> = {}): EligibilityInputs {
  return {
    lockTotals: { activeLockedAmount: USDC(1000), minActiveDurationDays: 7, activeLockCount: 1 },
    creditAccount: { granted: 1, used: 0 },
    trialsPaused: false,
    locksPaused: false,
    allTrialsFrozen: false,
    marketOpen: true,
    trialConfig: {
      marketAddr: "0xmarket",
      minLockAmount: USDC(250),
      expiryMs: 3_600_000,
      payoutAnchors: DEFAULT_ANCHORS,
    },
    burn: { cap: USDC(1000), windowTotal: BigInt(0), liveReservationCount: 0 },
    oi: { totalNotional: BigInt(0), cap: USDC(1_000_000) },
    campaignTitle: "FFT",
    activeLock: { lockId: BigInt(3), unlocksAtMs: 1_700_000_000_000, lockSubaccount: "0xsub" },
    hasActiveTrial: false,
    ...overrides,
  };
}

describe("computeEligibility — blockers", () => {
  it("no blockers when every gate passes", () => {
    const result = computeEligibility(baseInputs());
    expect(result.canOpenTrial).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.blockerCodes).toEqual([]);
  });

  it("trialsPaused", () => {
    const result = computeEligibility(baseInputs({ trialsPaused: true }));
    expect(result.canOpenTrial).toBe(false);
    expect(result.blockers).toEqual(["Trials are paused"]);
    expect(result.blockerCodes).toEqual(["trials_paused"]);
  });

  it("allTrialsFrozen", () => {
    const result = computeEligibility(baseInputs({ allTrialsFrozen: true }));
    expect(result.blockers).toEqual(["Trials are temporarily frozen by ops"]);
    expect(result.blockerCodes).toEqual(["trials_frozen"]);
  });

  it("market not open", () => {
    const result = computeEligibility(baseInputs({ marketOpen: false }));
    expect(result.canOpenTrial).toBe(false);
    expect(result.blockers).toEqual(["The trial market is temporarily closed — try again later"]);
    expect(result.blockerCodes).toEqual(["market_not_open"]);
  });

  it("no credits remaining", () => {
    const result = computeEligibility(baseInputs({ creditAccount: { granted: 1, used: 1 } }));
    expect(result.blockers).toEqual([
      "No trial credits available — lock more USDC to earn credits",
    ]);
    expect(result.blockerCodes).toEqual(["no_credits"]);
  });

  it("locked amount below minimum", () => {
    const result = computeEligibility(
      baseInputs({
        lockTotals: { activeLockedAmount: USDC(100), minActiveDurationDays: 1, activeLockCount: 1 },
      }),
    );
    expect(result.blockers).toEqual(["Lock amount is below the minimum required to open a trial"]);
    expect(result.blockerCodes).toEqual(["below_min_lock"]);
  });

  it("daily budget exhausted when projected burn exceeds cap", () => {
    const projected = protectedAmountFor(USDC(1000));
    const result = computeEligibility(
      baseInputs({
        burn: { cap: USDC(1000), windowTotal: USDC(1000) - projected, liveReservationCount: 0 },
      }),
    );
    expect(result.blockers).toEqual([]);
    const overCap = computeEligibility(
      baseInputs({
        burn: {
          cap: USDC(1000),
          windowTotal: USDC(1000) - projected + BigInt(1),
          liveReservationCount: 0,
        },
      }),
    );
    expect(overCap.blockers).toEqual(["Daily campaign budget is exhausted — try again tomorrow"]);
    expect(overCap.blockerCodes).toEqual(["daily_budget_exhausted"]);
  });

  it("active trial blocks a second open", () => {
    const result = computeEligibility(baseInputs({ hasActiveTrial: true }));
    expect(result.canOpenTrial).toBe(false);
    expect(result.blockers).toEqual(["Finish your active trial before opening another"]);
    expect(result.blockerCodes).toEqual(["trial_already_active"]);
  });

  it("open-interest cap reached", () => {
    const result = computeEligibility(
      baseInputs({ oi: { totalNotional: USDC(1_000_000), cap: USDC(1_000_000) } }),
    );
    expect(result.blockers).toEqual(["Open-interest cap reached — come back later"]);
    expect(result.blockerCodes).toEqual(["oi_cap_reached"]);
  });

  it("blockerCodes stays parallel to blockers when several gates fail", () => {
    const result = computeEligibility(
      baseInputs({ trialsPaused: true, creditAccount: { granted: 1, used: 1 } }),
    );
    expect(result.blockers).toHaveLength(2);
    expect(result.blockerCodes).toEqual(["trials_paused", "no_credits"]);
  });
});

describe("computeEligibility — soft-cap boundary", () => {
  // lowLock lock → projected exactly lowProtected ($10); cap $100 → softCap $70.
  const withWindow = (windowTotal: bigint) =>
    computeEligibility(
      baseInputs({
        lockTotals: { activeLockedAmount: USDC(250), minActiveDurationDays: 7, activeLockCount: 1 },
        burn: { cap: USDC(100), windowTotal, liveReservationCount: 0 },
      }),
    );

  it("below softCap → no warning", () => {
    expect(withWindow(USDC(50)).softWarnings.dailyBurnNearCap).toBe(false);
  });

  it("exactly at softCap → no warning (strict >)", () => {
    expect(withWindow(USDC(60)).softWarnings.dailyBurnNearCap).toBe(false);
  });

  it("one raw unit above softCap → warning", () => {
    expect(withWindow(USDC(60) + BigInt(1)).softWarnings.dailyBurnNearCap).toBe(true);
  });
});

describe("computeEligibility — anchors-driven projection", () => {
  it("projectedAfterTrial uses the config's payout anchors", () => {
    const payoutAnchors = {
      lowLock: USDC(100),
      lowProtected: USDC(5),
      highLock: USDC(1100),
      highProtected: USDC(105),
    };
    const result = computeEligibility(
      baseInputs({
        lockTotals: { activeLockedAmount: USDC(600), minActiveDurationDays: 7, activeLockCount: 1 },
        trialConfig: {
          marketAddr: "0xmarket",
          minLockAmount: USDC(100),
          expiryMs: 3_600_000,
          payoutAnchors,
        },
        burn: { cap: USDC(1000), windowTotal: USDC(7), liveReservationCount: 0 },
      }),
    );
    // interp(600) = 5 + 100 * 500/1000 = $55; + $7 window
    expect(result.dailyBurn.projectedAfterTrial).toBe(USDC(62));
    expect(result.dailyBurn.projectedAfterTrial).toBe(
      USDC(7) + protectedAmountFor(USDC(600), payoutAnchors),
    );
  });
});
