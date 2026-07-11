/**
 * Mirror of Move `payout_math` / `funded_first_trade` / `campaign_lock`
 * defaults; pinned value-for-value by `protected-amount.test.ts`.
 * Raw USDC (×10⁶) bigints (u64 parity); `BigInt(...)` over `n` literals — ES2017.
 */

/** Mirror of `campaign_lock::DEFAULT_MIN_DURATION_DAYS` / `DEFAULT_MAX_DURATION_DAYS`. */
export const MIN_DURATION_DAYS = 1;
export const MAX_DURATION_DAYS = 49;

/**
 * Mirror of `funded_first_trade::DEFAULT_TIER_{DURATIONS_DAYS,CREDITS_PER_TIER,RANKS,LEVERAGES}`.
 * A lock qualifies for the highest tier with `durationDays <= lock duration`.
 */
export const TIER_SLATE = [
  { durationDays: 1, credits: 1, tierRank: 1, leverage: 10 },
  { durationDays: 4, credits: 1, tierRank: 2, leverage: 20 },
  { durationDays: 7, credits: 1, tierRank: 3, leverage: 40 },
] as const;

/** Tier thresholds, used as the UI's duration presets. */
export const DURATION_DAYS_RAW = [1, 4, 7] as const;
export type LockDurationDays = (typeof DURATION_DAYS_RAW)[number];

/** Mirror of `payout_math`'s `DEFAULT_{LOW,HIGH}_{LOCK,PROTECTED}` anchors. */
const PAYOUT_LOW_LOCK = BigInt(250_000_000);
const PAYOUT_LOW_PROTECTED = BigInt(10_000_000);
const PAYOUT_HIGH_LOCK = BigInt(5_000_000_000);
const PAYOUT_HIGH_PROTECTED = BigInt(220_000_000);

export const MIN_LOCK_AMOUNT_RAW = PAYOUT_LOW_LOCK;
export const MAX_LOCK_AMOUNT_RAW = PAYOUT_HIGH_LOCK;

export interface PayoutAnchors {
  lowLock: bigint;
  lowProtected: bigint;
  highLock: bigint;
  highProtected: bigint;
}

export const DEFAULT_ANCHORS: PayoutAnchors = {
  lowLock: PAYOUT_LOW_LOCK,
  lowProtected: PAYOUT_LOW_PROTECTED,
  highLock: PAYOUT_HIGH_LOCK,
  highProtected: PAYOUT_HIGH_PROTECTED,
};

export class InvalidDurationError extends Error {
  constructor(durationDays: number) {
    super(`duration_days ${durationDays} outside [${MIN_DURATION_DAYS}, ${MAX_DURATION_DAYS}]`);
    this.name = "InvalidDurationError";
  }
}

/**
 * Mirror of `campaign_lock::assert_valid_duration` at default bounds.
 * Throws `InvalidDurationError` for non-integer or out-of-range days.
 */
export function validateLockDuration(days: number): void {
  if (!Number.isInteger(days) || days < MIN_DURATION_DAYS || days > MAX_DURATION_DAYS) {
    throw new InvalidDurationError(days);
  }
}

/** Mirror of `payout_math::compute`; evaluated on the user's TOTAL active locked principal, not per-lock. */
export function protectedAmountFor(
  activeLocked: bigint,
  anchors: PayoutAnchors = DEFAULT_ANCHORS,
): bigint {
  if (activeLocked < anchors.lowLock) {
    return BigInt(0);
  }
  if (activeLocked >= anchors.highLock) {
    return anchors.highProtected;
  }
  const span = anchors.highLock - anchors.lowLock;
  const range = anchors.highProtected - anchors.lowProtected;
  const delta = activeLocked - anchors.lowLock;
  return anchors.lowProtected + (range * delta) / span;
}

export interface CreditSlate {
  credits: number;
  tierRank: number;
  leverage: number;
}

/**
 * Mirror of `user_credits::credit_slate_for_duration_days` over the default
 * slate: highest tier whose `durationDays <= days`, zeros below the first tier.
 */
export function creditSlateForDurationDays(days: number): CreditSlate {
  let result: CreditSlate = { credits: 0, tierRank: 0, leverage: 0 };
  for (const tier of TIER_SLATE) {
    if (days >= tier.durationDays) {
      result = {
        credits: tier.credits,
        tierRank: tier.tierRank,
        leverage: tier.leverage,
      };
    }
  }
  return result;
}

/**
 * Per-credit trial position: `protected_amount × leverage_at_grant`, the
 * notional `funded_first_trade::open_trial` reserves per trial. Raw USDC.
 */
export function trialSizeFor(activeLocked: bigint, durationDays: number): bigint {
  validateLockDuration(durationDays);
  const { leverage } = creditSlateForDurationDays(durationDays);
  return protectedAmountFor(activeLocked) * BigInt(leverage);
}
