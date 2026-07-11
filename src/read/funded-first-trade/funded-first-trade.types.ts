import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";

// ─── Wire-shape enums (Rust serde default: PascalCase) ───

export const TradeSideSchema = z.enum(["Buy", "Sell"]);
export type TradeSide = z.infer<typeof TradeSideSchema>;

export const TrialStatusSchema = z.enum(["Active", "Settled", "SettledLiquidated"]);
export type TrialStatus = z.infer<typeof TrialStatusSchema>;

export const SettleReasonSchema = z.enum([
  "ExpiredClean",
  "LiquidatedEmpty",
  "PartialLoss",
  "NeverFilled",
  "AdminForced",
  "SweptAfterStall",
  "AdminReset",
]);
export type SettleReason = z.infer<typeof SettleReasonSchema>;

/** Resets are only allowed from on-chain Opening/Open, both of which collapse to `Active`. */
export const TrialPriorStatusSchema = z.enum(["Active"]);
export type TrialPriorStatus = z.infer<typeof TrialPriorStatusSchema>;

// ─── TrialDto (mirrors rust/trading-api-dto/src/protected_trial.rs::TrialDto) ────────

const SafeU64 = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger, "value exceeds Number.MAX_SAFE_INTEGER");

const TimestampMs = z
  .number()
  .int()
  .refine(Number.isSafeInteger, "timestamp exceeds Number.MAX_SAFE_INTEGER");

const FiniteNumber = (label: string) =>
  z.number().refine(Number.isFinite, `${label} must be finite`);

/**
 * Trial row from `/api/v1/protected_trials` (HTTP) and `protected_trial_update:{addr}` (WS).
 * Presence matrix: open-sourced fields are absent only on degraded reset rows
 * (enrichment miss — HTTP or WS); terminal fields appear on closed/reset rows only.
 */
export const TrialDtoSchema = z.object({
  trial_id: SafeU64,
  user: z.string(),
  campaign_addr: z.string(),
  status: TrialStatusSchema,
  /** Normalized size (`market.normalize_size` float). Always serialized; null on unknown market. */
  size: z.number().nonnegative().refine(Number.isFinite, "size must be finite").nullable(),

  market: z.string().optional(),
  trial_subaccount: z.string().optional(),
  side: TradeSideSchema.optional(),
  protected_amount: SafeU64.optional(),
  protected_amount_usd: FiniteNumber("protected_amount_usd").optional(),
  mark_at_open: SafeU64.optional(),
  mark_at_open_usd: FiniteNumber("mark_at_open_usd").optional(),
  leverage_at_open: SafeU64.optional(),
  mark_at_close: SafeU64.optional(),
  mark_at_close_usd: FiniteNumber("mark_at_close_usd").optional(),
  opened_at_ms: TimestampMs.optional(),
  expires_at_ms: TimestampMs.optional(),

  closed_at_ms: TimestampMs.optional(),
  vault_returned: SafeU64.optional(),
  vault_returned_usd: FiniteNumber("vault_returned_usd").optional(),
  user_payout: SafeU64.optional(),
  user_payout_usd: FiniteNumber("user_payout_usd").optional(),
  settle_reason: SettleReasonSchema.optional(),
  closed_by: z.string().optional(),
  prior_status: TrialPriorStatusSchema.optional(),
});

export type TrialDto = z.infer<typeof TrialDtoSchema>;

export const ProtectedTrialsResponseSchema = z.object({
  account: z.string(),
  active_trial: TrialDtoSchema.nullable(),
  active_trials: z.array(TrialDtoSchema),
  history: z.array(TrialDtoSchema),
  /** SQL-level count — server-skipped rows still count, so never assert `history.length === this` on the last page. */
  history_total_count: z.number().int().nonnegative(),
});

export type ProtectedTrialsResponse = z.infer<typeof ProtectedTrialsResponseSchema>;

// ─── Campaign locks (`/api/v1/campaign_locks`) ───────────────────────────────

export const LockStatusSchema = z.enum(["Active", "Claimed"]);
export type LockStatus = z.infer<typeof LockStatusSchema>;

/** Extension fields appear on extended locks only; returned/claimed fields on claimed locks only. */
export const LockDtoSchema = z.object({
  lock_id: SafeU64,
  campaign_addr: z.string(),
  trial_id: SafeU64,
  amount: SafeU64,
  amount_usd: FiniteNumber("amount_usd"),
  duration_days: z.number().int().nonnegative(),
  lock_subaccount: z.string(),
  locked_at_ms: TimestampMs,
  unlocks_at_ms: TimestampMs,
  status: LockStatusSchema,
  was_extended: z.boolean(),
  previous_unlocks_at_ms: TimestampMs.optional(),
  extended_at_ms: TimestampMs.optional(),
  /** Trading-PnL-adjusted; may differ from `amount`. */
  returned_amount: SafeU64.optional(),
  returned_amount_usd: FiniteNumber("returned_amount_usd").optional(),
  claimed_at_ms: TimestampMs.optional(),
});
export type LockDto = z.infer<typeof LockDtoSchema>;

export const CampaignLocksResponseSchema = z.object({
  account: z.string(),
  locks: z.array(LockDtoSchema),
  /** Skipped orphan rows still count and consume page slots — `hasNextPage = offset + limit < total_count`. */
  total_count: z.number().int().nonnegative(),
});
export type CampaignLocksResponse = z.infer<typeof CampaignLocksResponseSchema>;

/** WS payload; matches the `trials` field of Rust `ProtectedTrialUpdateResponse`. */
export const ProtectedTrialUpdateSchema = z.object({
  trials: z.array(TrialDtoSchema),
});

export type ProtectedTrialUpdate = z.infer<typeof ProtectedTrialUpdateSchema>;

// ─── Request args ────────────────────────────────────────────────────────────

export interface GetEligibilityArgs extends BaseRequestArgs {
  account: string;
}

export interface GetActiveTrialArgs extends BaseRequestArgs {
  account: string;
}

export interface GetTrialHistoryArgs extends BaseRequestArgs {
  account: string;
  limit?: number;
  offset?: number;
}

export interface GetCampaignLocksArgs extends BaseRequestArgs {
  account: string;
  campaignAddr?: string;
  status?: LockStatus;
  /** Server default: 10. */
  limit?: number;
  offset?: number;
}

export interface TrialHistoryPage {
  history: TrialDto[];
  /** SQL-level total for "X of N"; may exceed the rows returned across all pages (server-skipped rows). */
  historyTotalCount: number;
}

// ─── FE-synthesized Eligibility ──────────────────────────────────────────────

/** Stable machine codes for `Eligibility.blockers` — safe for analytics/segmentation (copy may change; codes may not). */
export type FftBlockerCode =
  | "trials_paused"
  | "trials_frozen"
  | "market_not_open"
  | "trial_already_active"
  | "no_credits"
  | "below_min_lock"
  | "daily_budget_exhausted"
  | "oi_cap_reached";

/** Composed on-chain view snapshot (not a wire shape). Side-agnostic: the trial side is chosen on-chain. */
export interface Eligibility {
  /** Raw USDC. */
  activeLockedAmount: bigint;
  /** The active lock's duration (single-lock cap on-chain). */
  maxActiveDurationDays: number;
  creditsGranted: number;
  creditsUsed: number;
  activeLockCount: number;

  /** null when no active lock or the bounded lock scan gave up. */
  activeLockUnlockAtMs: number | null;
  activeLockId: bigint | null;

  /** Campaign-owned subaccount holding the locked USDC; null when no active lock found. */
  activeLockSubaccount: string | null;

  /** On-chain campaign title, for labeling user-facing surfaces. */
  campaignTitle: string | null;

  /** Raw USDC. */
  minLockAmount: bigint;
  /** Milliseconds. */
  expiryMs: number;

  trialsPaused: boolean;
  locksPaused: boolean;
  allTrialsFrozen: boolean;

  dailyBurn: {
    windowTotal: bigint;
    cap: bigint;
    liveReservationCount: number;
    /** windowTotal + this user's projected protected amount if they open now. */
    projectedAfterTrial: bigint;
  };

  /** Single total OI meter. */
  oiState: {
    totalNotional: bigint;
    cap: bigint;
  };

  canOpenTrial: boolean;

  /** Human-readable reasons `canOpenTrial` is false; empty when openable. */
  blockers: string[];

  /** Parallel to `blockers`, same order. */
  blockerCodes: FftBlockerCode[];

  softWarnings: {
    /** Burn is past SOFT_BURN_WARN_RATIO of cap. */
    dailyBurnNearCap: boolean;
  };
}
