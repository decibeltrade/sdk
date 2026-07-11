import { AccountAddress, Aptos } from "@aptos-labs/ts-sdk";

import { TrialDto } from "./funded-first-trade.types";

export interface ChainFallbackDeps {
  aptos: Aptos;
  /** Campaign OBJECT address — what every `campaign_addr` view argument takes. */
  campaignAddr: string;
  /** Module address — where the `funded_first_trade` family of modules lives. */
  campaignPackage: string;
  getTrialStateConfig: () => Promise<{ marketAddr: string; sizeDecimalsPow10: number }>;
}

/** Scan ceiling for `findActiveLockFromChain` — no per-owner lock-id view on-chain, so it walks `0..next_lock_id`. */
const LOCK_SCAN_CAP = 200;

async function view<T extends unknown[]>(
  deps: ChainFallbackDeps,
  module: string,
  fn: string,
  args: unknown[],
): Promise<T> {
  return deps.aptos.view<T>({
    payload: {
      function: `${deps.campaignPackage}::${module}::${fn}`,
      typeArguments: [],
      functionArguments: args as never,
    },
  });
}

function toTrialDto(
  d: Record<string, unknown>,
  common: {
    user: string;
    campaignAddr: string;
    market: string;
    sizeScale: number;
    status: TrialDto["status"];
  },
): TrialDto {
  const protectedAmount = Number(d.protected_amount);
  const markAtOpen = Number(d.mark_at_open);
  return {
    trial_id: Number(d.trial_id),
    user: common.user,
    campaign_addr: common.campaignAddr,
    market: common.market,
    side: d.side_is_buy === true ? "Buy" : "Sell",
    protected_amount: protectedAmount,
    protected_amount_usd: protectedAmount / 1_000_000,
    size: Number(d.size) * common.sizeScale,
    mark_at_open: markAtOpen,
    mark_at_open_usd: markAtOpen / 1_000_000,
    trial_subaccount: d.trial_subaccount as string,
    opened_at_ms: Number(d.opened_at_ms),
    expires_at_ms: Number(d.expires_at_ms),
    status: common.status,
  };
}

// Dev-only fallback until the trading-api FFT endpoint ships: rebuilds history from TrialClosed events at 1 indexer query + ≤25 fullnode fetches per call — too heavy under FE polling on real networks.
export async function getTrialHistoryFromChain(
  deps: ChainFallbackDeps,
  account: string,
  limit: number,
): Promise<TrialDto[]> {
  const campaign = deps.campaignAddr;
  const closedEventType = `${deps.campaignPackage}::protected_trial::TrialClosed`;

  const [indexerResult, config] = await Promise.all([
    deps.aptos.queryIndexer<{
      account_transactions: Array<{ transaction_version: number }>;
    }>({
      query: {
        query: `query TrialHistoryTxns($account: String!) {
          account_transactions(
            where: { account_address: { _eq: $account } }
            order_by: { transaction_version: desc }
            limit: 50
          ) { transaction_version }
        }`,
        variables: { account },
      },
    }),
    deps.getTrialStateConfig(),
  ]);

  const versions = indexerResult.account_transactions
    .map((row) => row.transaction_version)
    .slice(0, 25);
  const transactions = await Promise.all(
    versions.map((ledgerVersion) =>
      deps.aptos.getTransactionByVersion({ ledgerVersion }).catch(() => null),
    ),
  );

  const sizeScale = 1 / config.sizeDecimalsPow10;
  const settleReasons: Record<number, TrialDto["settle_reason"]> = {
    0: "ExpiredClean",
    1: "LiquidatedEmpty",
    2: "PartialLoss",
    3: "NeverFilled",
    4: "AdminForced",
    5: "SweptAfterStall",
  };

  const rows: TrialDto[] = [];
  for (const tx of transactions) {
    if (tx === null || !("events" in tx)) continue;
    for (const event of tx.events) {
      if (event.type !== closedEventType) continue;
      const d = event.data as Record<string, unknown>;
      if (d.user !== account || d.campaign_addr !== campaign) continue;
      const userPayout = Number(d.user_payout);
      const reason = Number(d.settle_reason);
      rows.push({
        ...toTrialDto(d, {
          user: account,
          campaignAddr: campaign,
          market: (d.market as { inner: string }).inner,
          sizeScale,
          status: reason === 1 ? "SettledLiquidated" : "Settled",
        }),
        closed_at_ms: Number(d.closed_at_ms),
        user_payout: userPayout,
        user_payout_usd: userPayout / 1_000_000,
        vault_returned: Number(d.vault_returned),
        vault_returned_usd: Number(d.vault_returned) / 1_000_000,
        settle_reason: settleReasons[reason],
      });
    }
  }
  return rows.sort((a, b) => (b.closed_at_ms ?? 0) - (a.closed_at_ms ?? 0)).slice(0, limit);
}

/** Rebuilds the active trial from views; every live status maps to "Active", `size` normalized to the DTO's float convention. */
export async function getActiveTrialFromChain(
  deps: ChainFallbackDeps,
  account: string,
): Promise<TrialDto | null> {
  const campaign = deps.campaignAddr;
  const [idOpt] = await view<[{ vec: string[] }]>(deps, "protected_trial", "active_trial_id_for", [
    campaign,
    account,
  ]);
  if (idOpt.vec.length === 0) return null;
  const trialId = idOpt.vec[0];

  const [[snap], config] = await Promise.all([
    view<[Record<string, unknown>]>(deps, "protected_trial", "trial_summary", [campaign, trialId]),
    deps.getTrialStateConfig(),
  ]);

  return toTrialDto(snap, {
    user: account,
    campaignAddr: campaign,
    market: config.marketAddr,
    sizeScale: 1 / config.sizeDecimalsPow10,
    status: "Active",
  });
}

/** Owner-lock scan fallback for deploys without `/campaign_locks` or indexer lag; null when past LOCK_SCAN_CAP. */
export async function findActiveLockFromChain(
  deps: ChainFallbackDeps,
  account: string,
): Promise<{ lockId: bigint; unlocksAtMs: number; lockSubaccount: string } | null> {
  const campaign = deps.campaignAddr;
  const [nextIdRaw] = await view<[string]>(deps, "campaign_lock", "next_lock_id", [campaign]);
  const nextId = Number(nextIdRaw);
  if (nextId < 1 || nextId > LOCK_SCAN_CAP) return null;

  const ids = Array.from({ length: nextId }, (_, i) => i);
  const activeFlags = await Promise.all(
    ids.map((id) => viewIsLockActive(deps, id).catch(() => false)),
  );
  const owner = AccountAddress.fromString(account);
  for (const id of ids.filter((_, i) => activeFlags[i])) {
    const lock = await viewGetLock(deps, id).catch(() => null);
    if (lock !== null && AccountAddress.fromString(lock.user).equals(owner)) {
      return {
        lockId: BigInt(id),
        unlocksAtMs: lock.unlocksAtMs,
        lockSubaccount: lock.lockSubaccount,
      };
    }
  }
  return null;
}

async function viewIsLockActive(deps: ChainFallbackDeps, lockId: number): Promise<boolean> {
  const [active] = await view<[boolean]>(deps, "campaign_lock", "is_lock_active", [
    deps.campaignAddr,
    lockId.toString(),
  ]);
  return active;
}

async function viewGetLock(deps: ChainFallbackDeps, lockId: number) {
  const [lock] = await view<[Record<string, unknown>]>(deps, "campaign_lock", "get_lock", [
    deps.campaignAddr,
    lockId.toString(),
  ]);
  return {
    user: lock.user as string,
    unlocksAtMs: Number(lock.unlocks_at_ms),
    lockSubaccount: (lock.lock_subaccount as { inner: string }).inner,
  };
}
