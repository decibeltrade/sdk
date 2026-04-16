import z from "zod/v4";

import { BaseRequestArgs } from "../base-reader";
import { PageParams, PaginatedResponseSchema } from "../pagination.types";

/**
 * On-chain view function response shape (used for liveness-check fallback polling).
 *
 * This is NOT the primary data source — use {@link WithdrawQueueEntry} from the indexed
 * HTTP/WS API instead. The on-chain view only returns currently-Queued items and uses
 * raw chain units (not normalized amounts).
 *
 * To correlate between on-chain and indexed data, use `request_id` as the shared key.
 */
export const PendingWithdrawRequestSchema = z.object({
  request_id: z.string(),
  user: z.string(),
  recipient: z.string(),
  /** Move `Option<T>` decoded: `null` when the withdrawal is not market-specific. */
  market: z.object({ vec: z.array(z.string()).max(1) }).transform((v) => v.vec[0] ?? null),
  metadata: z.string(),
  /**
   * Raw chain units (u64 as string). Divide by `10^collateral_decimals` for display.
   * Use `DecibelReadDex.collateralBalanceDecimals()` to obtain the divisor.
   *
   * **Warning:** This is NOT comparable to `WithdrawQueueEntry.fungible_amount`, which is
   * a normalized `number` (already divided by decimals). Do not compare across schemas.
   */
  fungible_amount: z.string(),
  created_at: z.string(),
});

export type PendingWithdrawRequest = z.infer<typeof PendingWithdrawRequestSchema>;

export const WithdrawQueueStatusSchema = z.enum(["Queued", "Processed", "Cancelled"]);

export type WithdrawQueueStatus = z.infer<typeof WithdrawQueueStatusSchema>;

export const KnownWithdrawCancelReasonSchema = z.enum([
  "CancelledByUser",
  "InsufficientWithdrawableBalance",
  "DepositCheckFailed",
]);

export type KnownWithdrawCancelReason = z.infer<typeof KnownWithdrawCancelReasonSchema>;

export const WithdrawCancelReasonSchema = z.union([KnownWithdrawCancelReasonSchema, z.string()]);

export type WithdrawCancelReason = z.infer<typeof WithdrawCancelReasonSchema>;

/** Indexed entry from the trading API (normalized amounts, all statuses). */
export const WithdrawQueueEntrySchema = z.object({
  user: z.string(),
  recipient: z.string().nullish(),
  market: z.string().nullish(),
  fungible_amount: z
    .number()
    .nonnegative()
    .refine(Number.isFinite, "fungible_amount must be finite"),
  /**
   * Equals `fungible_amount` when `status` is `"Processed"`; always `0` for
   * `"Queued"` and `"Cancelled"`. Partial fills are not supported.
   */
  processed_amount: z
    .number()
    .nonnegative()
    .refine(Number.isFinite, "processed_amount must be finite"),
  request_id: z.string(),
  status: WithdrawQueueStatusSchema,
  /**
   * Only meaningful when `status === "Cancelled"`. Always null/undefined for Queued and
   * Processed entries — check `status` before reading. A null value on a Cancelled entry
   * means the reason is unknown (forward-compat for new cancel reasons).
   */
  cancel_reason: WithdrawCancelReasonSchema.nullish(),
  /** Timestamp of the latest event for this entry (ms since epoch). */
  timestamp_ms: z.number().int(),
  /**
   * Timestamp when the withdrawal was originally queued (ms since epoch).
   * Null when: (1) WS delta where the Queued event was in a different batch,
   * (2) indexer replay ordering where Processed/Cancelled was re-indexed before
   * its Queued counterpart, or (3) HTTP backfill query timed out.
   * Re-fetch via `getByAddr` when this field is needed for display (e.g. "time in queue");
   * note that even HTTP responses may return null on backfill timeout.
   * When using `mergeWithdrawQueueEntries`, sort order is handled automatically
   * (Queued entries fall back to `timestamp_ms`; terminal entries sink to the bottom).
   * For manual display of elapsed time (e.g. "submitted X ago"), do not fall back to
   * `timestamp_ms` — it reflects the terminal event time, not the original queue
   * submission time. Show a placeholder (e.g. "—") instead.
   */
  queued_at_ms: z.number().int().nullish(),
  /**
   * Aptos ledger version of the transaction that produced this event.
   *
   * **JS precision caveat:** This refine catches programmer mistakes (passing a float)
   * but cannot detect precision loss from JSON.parse on values > 2^53-1 — the number
   * is already rounded before Zod sees it. Aptos versions are well within safe-integer
   * range today (~10^9), so this is acceptable. If the chain ever approaches 2^53,
   * the field must switch to string-based parsing.
   */
  transaction_version: z
    .number()
    .int()
    .nonnegative()
    .refine((v) => Number.isSafeInteger(v), "transaction_version exceeds Number.MAX_SAFE_INTEGER"),
});

export type WithdrawQueueEntry = z.infer<typeof WithdrawQueueEntrySchema>;

/**
 * Paginated response from the indexed HTTP API.
 *
 * **`total_count` counts event rows, not unique withdrawals.** Without a `status` filter,
 * each state transition is a separate row — a Queued→Processed withdrawal contributes
 * 2 rows to `total_count`. To get an accurate count of withdrawals in a given state,
 * always pass a `status` filter (e.g. `status: "Queued"`). Using the unfiltered
 * `total_count` for pagination display (e.g. "showing X of Y") will overcount.
 */
export const WithdrawQueueResponseSchema = PaginatedResponseSchema(WithdrawQueueEntrySchema);

export type WithdrawQueueResponse = z.infer<typeof WithdrawQueueResponseSchema>;

/**
 * WS payload shape (topic is stripped by ws-subscription before parsing).
 * Matches the `entries` field of the Rust `WithdrawQueueUpdateResponse`.
 */
export const WithdrawQueueUpdateSchema = z.object({
  entries: z.array(WithdrawQueueEntrySchema),
});

export type WithdrawQueueUpdate = z.infer<typeof WithdrawQueueUpdateSchema>;

const KNOWN_CANCEL_REASONS: ReadonlySet<string> = new Set(KnownWithdrawCancelReasonSchema.options);

export function isKnownCancelReason(
  reason: WithdrawCancelReason,
): reason is KnownWithdrawCancelReason {
  return KNOWN_CANCEL_REASONS.has(reason);
}

export interface WithdrawQueueRequestArgs extends BaseRequestArgs, PageParams {
  subAddr: string;
  status?: WithdrawQueueStatus;
}

/**
 * Merge incremental WS deltas into an existing entry list.
 *
 * For each delta entry, finds an existing entry by `request_id`:
 * - If found and `delta.transaction_version > existing.transaction_version`: applies a
 *   field-level merge, preserving non-null `recipient`, `market`, and `queued_at_ms`
 *   from the existing entry when the delta has null for those fields.
 * - If found but `delta.transaction_version <= existing.transaction_version`: ignored
 *   (duplicate or stale). Uses `<=` (not `<`) because the indexer uses at-least-once
 *   delivery — duplicate events with the same `transaction_version` can arrive, and
 *   accepting `>=` would re-overwrite field-level merged values with null from the dup.
 * - If not found: appended.
 *
 * **Argument order matters on WS reconnect re-seed.** Pass
 * `{ existing: wsCache, delta: httpSnapshot }` so that fresher WS state is not
 * overwritten by stale HTTP data. The function only applies a delta entry when its
 * `transaction_version` is strictly greater than the existing entry's, so passing
 * the HTTP snapshot as `delta` ensures it cannot regress entries that the WS already
 * advanced.
 *
 * **Sorts the output by queue time descending (newest first).** For `Queued` entries
 * with null `queued_at_ms`, `timestamp_ms` is used as the fallback because it IS the
 * queue time for that status. For terminal entries (`Processed`/`Cancelled`) with null
 * `queued_at_ms`, a `0` sentinel sinks them to the bottom — using `timestamp_ms` would
 * be incorrect because it reflects the completion time, not the submission time, which
 * would cause recently-processed withdrawals to sort above older still-queued ones.
 *
 * **Deduplicates `existing` internally.** If the `existing` array contains multiple
 * entries for the same `request_id` (e.g. an unfiltered HTTP snapshot), the entry with
 * the highest `transaction_version` wins before delta processing begins.
 *
 * Returns a new array (does not mutate inputs).
 */
export function mergeWithdrawQueueEntries({
  existing,
  delta,
}: {
  existing: WithdrawQueueEntry[];
  delta: WithdrawQueueEntry[];
}): WithdrawQueueEntry[] {
  // Two-pass dedup for `existing`: collect all rows per request_id, pick the
  // highest transaction_version as the base, then fill nullish enrichment
  // fields (recipient, market, queued_at_ms) from any lower-version row that
  // has them. This prevents HTTP responses containing both a Queued row
  // (enriched) and a Processed row (nulls for those fields) from losing the
  // enriched data when the Processed row wins on version.
  const grouped = new Map<string, WithdrawQueueEntry[]>();
  for (const entry of existing) {
    let group = grouped.get(entry.request_id);
    if (!group) {
      group = [];
      grouped.set(entry.request_id, group);
    }
    group.push(entry);
  }

  const map = new Map<string, WithdrawQueueEntry>();
  for (const [requestId, rows] of grouped) {
    // Find the entry with the highest transaction_version as the base,
    // then fill nullish enrichment fields from any lower-version row.
    // Invariant: recipient, market, and queued_at_ms are write-once (set on Queued event, never changed).
    const best = rows.reduce((a, b) => (b.transaction_version > a.transaction_version ? b : a));
    let recipient = best.recipient;
    let market = best.market;
    let queued_at_ms = best.queued_at_ms;
    for (const row of rows) {
      if (recipient == null && row.recipient != null) recipient = row.recipient;
      if (market == null && row.market != null) market = row.market;
      if (queued_at_ms == null && row.queued_at_ms != null) queued_at_ms = row.queued_at_ms;
    }
    map.set(requestId, Object.assign({}, best, { recipient, market, queued_at_ms }));
  }

  for (const update of delta) {
    const prev = map.get(update.request_id);
    if (!prev) {
      map.set(update.request_id, update);
      continue;
    }
    if (update.transaction_version <= prev.transaction_version) {
      continue;
    }
    map.set(update.request_id, {
      ...update,
      recipient: update.recipient ?? prev.recipient,
      market: update.market ?? prev.market,
      queued_at_ms: update.queued_at_ms ?? prev.queued_at_ms,
      // Only preserve cancel_reason for Cancelled entries; clear it for Queued/Processed
      // to prevent logically inconsistent state (e.g. Queued entry with a stale cancel_reason).
      // Guard prev.status too: only inherit cancel_reason from a previously-Cancelled entry
      // to avoid propagating semantically undefined null from a Queued/Processed predecessor.
      cancel_reason:
        update.status === "Cancelled"
          ? (update.cancel_reason ?? (prev.status === "Cancelled" ? prev.cancel_reason : null))
          : null,
    });
  }

  const result = Array.from(map.values());
  // Sort by queue time descending (newest first).
  // For Queued entries, timestamp_ms IS the queue time, so it's a safe fallback.
  // For terminal entries (Processed/Cancelled), timestamp_ms is the completion time —
  // using it would sort them as if newly queued, so we use 0 to sink them to the bottom.
  result.sort((a, b) => {
    const aTime = a.queued_at_ms ?? (a.status === "Queued" ? a.timestamp_ms : 0);
    const bTime = b.queued_at_ms ?? (b.status === "Queued" ? b.timestamp_ms : 0);
    return bTime - aTime;
  });
  return result;
}
