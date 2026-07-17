import { PayoutAnchors, protectedAmountFor, TierSlateTier } from "../../protected-amount";
import { Eligibility, FftBlockerCode } from "./funded-first-trade.types";

/** Warn before the daily-burn hard cap: FE shows a banner once projected burn exceeds this fraction of the cap. */
export const SOFT_BURN_WARN_RATIO = 0.7;
const SOFT_BURN_WARN_NUMERATOR = BigInt(7);
const SOFT_BURN_WARN_DENOMINATOR = BigInt(10);

export interface EligibilityInputs {
  lockTotals: {
    activeLockedAmount: bigint;
    minActiveDurationDays: number;
    activeLockCount: number;
  };
  creditAccount: { granted: number; used: number };
  trialsPaused: boolean;
  locksPaused: boolean;
  allTrialsFrozen: boolean;
  /** Best-effort: mode views are cache — a market can read Open with a dead oracle until first match contact. */
  marketOpen: boolean;
  trialConfig: {
    marketAddr: string;
    minLockAmount: bigint;
    expiryMs: number;
    payoutAnchors: PayoutAnchors;
  };
  tierSlate: TierSlateTier[];
  burn: { cap: bigint; windowTotal: bigint; liveReservationCount: number };
  oi: { totalNotional: bigint; cap: bigint };
  campaignTitle: string | null;
  activeLock: { lockId: bigint; unlocksAtMs: number; lockSubaccount: string } | null;
  hasActiveTrial: boolean;
}

export function computeEligibility({
  lockTotals,
  creditAccount,
  trialsPaused,
  locksPaused,
  allTrialsFrozen,
  marketOpen,
  trialConfig,
  tierSlate,
  burn,
  oi,
  campaignTitle,
  activeLock,
  hasActiveTrial,
}: EligibilityInputs): Eligibility {
  // payout_math.compute gates on total active locked principal alone; no active lock → 0.
  const projectedTrialAmount = protectedAmountFor(
    lockTotals.activeLockedAmount,
    trialConfig.payoutAnchors,
  );
  const projectedAfterTrial = burn.windowTotal + projectedTrialAmount;

  const blockers: string[] = [];
  const blockerCodes: FftBlockerCode[] = [];
  const block = (code: FftBlockerCode, message: string) => {
    blockers.push(message);
    blockerCodes.push(code);
  };
  if (trialsPaused) block("trials_paused", "Trials are paused");
  if (allTrialsFrozen) block("trials_frozen", "Trials are temporarily frozen by ops");
  // Opening on a closed market never aborts on-chain — the IOC is engine-cancelled,
  // the credit burns, and the trial settles NeverFilled. This gate is the only defense.
  if (!marketOpen)
    block("market_not_open", "The trial market is temporarily closed — try again later");
  if (hasActiveTrial)
    block("trial_already_active", "Finish your active trial before opening another");
  const creditsRemaining = creditAccount.granted - creditAccount.used;
  if (creditsRemaining <= 0)
    block("no_credits", "No trial credits available — lock more USDC to earn credits");
  if (lockTotals.activeLockedAmount < trialConfig.minLockAmount) {
    block("below_min_lock", "Lock amount is below the minimum required to open a trial");
  }
  if (projectedAfterTrial > burn.cap) {
    block("daily_budget_exhausted", "Daily campaign budget is exhausted — try again tomorrow");
  }
  if (oi.totalNotional >= oi.cap) {
    block("oi_cap_reached", "Open-interest cap reached — come back later");
  }

  const softCap = (SOFT_BURN_WARN_NUMERATOR * burn.cap) / SOFT_BURN_WARN_DENOMINATOR;
  const dailyBurnNearCap = projectedAfterTrial > softCap;

  return {
    activeLockedAmount: lockTotals.activeLockedAmount,
    // Single-lock cap on-chain: the owner's min active duration IS the lock's duration.
    maxActiveDurationDays: lockTotals.minActiveDurationDays,
    creditsGranted: creditAccount.granted,
    creditsUsed: creditAccount.used,
    activeLockCount: lockTotals.activeLockCount,
    activeLockUnlockAtMs: activeLock?.unlocksAtMs ?? null,
    activeLockId: activeLock?.lockId ?? null,
    activeLockSubaccount: activeLock?.lockSubaccount ?? null,
    campaignTitle,
    marketAddr: trialConfig.marketAddr,
    minLockAmount: trialConfig.minLockAmount,
    expiryMs: trialConfig.expiryMs,
    payoutAnchors: trialConfig.payoutAnchors,
    tierSlate,
    trialsPaused,
    locksPaused,
    allTrialsFrozen,
    dailyBurn: {
      windowTotal: burn.windowTotal,
      cap: burn.cap,
      liveReservationCount: burn.liveReservationCount,
      projectedAfterTrial,
    },
    oiState: oi,
    canOpenTrial: blockers.length === 0,
    blockers,
    blockerCodes,
    softWarnings: { dailyBurnNearCap },
  };
}
