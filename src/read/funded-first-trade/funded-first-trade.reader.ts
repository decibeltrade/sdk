import { PayoutAnchors, TierSlateTier } from "../../protected-amount";
import { BaseReader } from "../base-reader";
import {
  ChainFallbackDeps,
  findActiveLockFromChain,
  getActiveTrialFromChain,
  getTrialHistoryFromChain,
} from "./funded-first-trade.chain-fallback";
import { computeEligibility } from "./funded-first-trade.eligibility";
import {
  CampaignLocksResponse,
  CampaignLocksResponseSchema,
  Eligibility,
  GetActiveTrialArgs,
  GetCampaignLocksArgs,
  GetEligibilityArgs,
  GetTrialHistoryArgs,
  ProtectedTrialsResponseSchema,
  ProtectedTrialUpdate,
  ProtectedTrialUpdateSchema,
  TrialDto,
  TrialHistoryPage,
} from "./funded-first-trade.types";

const RECENT_SETTLE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Reader for Funded First Trade (FFT): composes the on-chain campaign views
 * into `Eligibility` and serves trials via `/api/v1/protected_trials` + the
 * `protected_trial_update:{addr}` WS topic.
 */
export class FundedFirstTradeReader extends BaseReader {
  /** Module address — where the `funded_first_trade` family of modules lives. */
  private get campaignPackage(): string {
    return this.deps.config.deployment.campaignPackage;
  }

  /**
   * Campaign OBJECT address (the `create_campaign` result) — what every
   * `campaign_addr` argument takes. Distinct from the package address; falls
   * back to it only for configs that predate the split.
   */
  private get campaignAddr(): string {
    return this.deps.config.deployment.fftCampaignAddr ?? this.campaignPackage;
  }

  private get chainFallbackDeps(): ChainFallbackDeps {
    return {
      aptos: this.deps.aptos,
      campaignAddr: this.campaignAddr,
      campaignPackage: this.campaignPackage,
      getTrialStateConfig: () => this.viewTrialStateConfig(this.campaignAddr),
    };
  }

  private warnedFallbacks = new Set<string>();

  /**
   * The rebuild otherwise masks API regressions — a 200 with a drifted wire
   * shape fails Zod and lands here just like an outage. Latched per method:
   * the settling poll retries every 5s and would flood logs/Sentry.
   */
  private noteChainFallback(method: string, error: unknown) {
    if (this.warnedFallbacks.has(method)) return;
    this.warnedFallbacks.add(method);
    console.warn("FFT: trading-api request failed, rebuilding from chain views", {
      method,
      error,
    });
    this.deps.onChainFallback?.({ method, error });
  }

  /**
   * Gating here is UX sugar — the authoritative rules fire in the `open_trial`
   * entry fn; rely on `onError` invalidation for races.
   */
  async getEligibility({ account }: GetEligibilityArgs): Promise<Eligibility> {
    const campaign = this.campaignAddr;
    const [
      lockTotals,
      creditAccount,
      trialsPaused,
      locksPaused,
      allTrialsFrozen,
      trialConfig,
      tierSlate,
      burn,
      oi,
      campaignTitle,
      hasActiveTrial,
    ] = await Promise.all([
      this.viewOwnerLockTotals(campaign, account),
      this.viewCreditAccount(campaign, account),
      this.viewBool("protected_trial", "trials_paused", campaign),
      this.viewBool("campaign_lock", "locks_paused", campaign),
      this.viewBool("protected_trial", "all_trials_frozen", campaign),
      this.viewTrialStateConfig(campaign),
      this.viewTierSlate(campaign),
      this.viewDailyBurn(campaign),
      this.viewOiState(campaign),
      this.viewCampaignTitle(campaign),
      this.viewHasActiveTrial(campaign, account),
    ]);

    const [activeLock, marketOpen] = await Promise.all([
      lockTotals.activeLockCount > 0 ? this.findActiveLock(account) : null,
      this.viewIsMarketOpen(trialConfig.marketAddr),
    ]);

    return computeEligibility({
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
    });
  }

  async getActiveTrial({ account, fetchOptions }: GetActiveTrialArgs): Promise<TrialDto | null> {
    try {
      const response = await this.getRequest({
        schema: ProtectedTrialsResponseSchema,
        url: `${this.deps.config.tradingHttpUrl}/api/v1/protected_trials`,
        queryParams: { account, campaign_addr: this.campaignAddr, limit: "1", offset: "0" },
        options: fetchOptions,
      });
      if (response.data.active_trial) return response.data.active_trial;
      const recent = response.data.history.find((t) => t.campaign_addr === this.campaignAddr);
      if (
        recent != null &&
        recent.status !== "Active" &&
        recent.closed_at_ms != null &&
        Date.now() - recent.closed_at_ms < RECENT_SETTLE_WINDOW_MS
      ) {
        return recent;
      }
      return null;
    } catch (error) {
      // No FFT endpoints on the testnet trading-api yet — rebuild the active
      // trial from on-chain views so throwaway deploys work end to end.
      this.noteChainFallback("getActiveTrial", error);
      return getActiveTrialFromChain(this.chainFallbackDeps, account);
    }
  }

  async getTrialHistory({
    account,
    limit,
    offset,
    fetchOptions,
  }: GetTrialHistoryArgs): Promise<TrialHistoryPage> {
    const queryParams: Record<string, string> = { account };
    if (limit !== undefined) queryParams.limit = limit.toString();
    if (offset !== undefined) queryParams.offset = offset.toString();
    try {
      const response = await this.getRequest({
        schema: ProtectedTrialsResponseSchema,
        url: `${this.deps.config.tradingHttpUrl}/api/v1/protected_trials`,
        queryParams,
        options: fetchOptions,
      });
      return {
        history: response.data.history,
        historyTotalCount: response.data.history_total_count,
      };
    } catch (error) {
      // Settled trials leave the on-chain map, so without the trading-api the
      // history is rebuilt from TrialClosed events. Never throws — empty
      // beats erroring the whole dashboard. The count is best-effort (bounded
      // event scan), dev-only.
      this.noteChainFallback("getTrialHistory", error);
      const history = await getTrialHistoryFromChain(
        this.chainFallbackDeps,
        account,
        limit ?? 20,
      ).catch((): TrialDto[] => []);
      return { history, historyTotalCount: history.length };
    }
  }

  /** No chain fallback — the endpoint ships with the feature. */
  async getCampaignLocks({
    account,
    campaignAddr,
    status,
    limit,
    offset,
    fetchOptions,
  }: GetCampaignLocksArgs): Promise<CampaignLocksResponse> {
    const queryParams: Record<string, string> = { account };
    if (campaignAddr !== undefined) queryParams.campaign_addr = campaignAddr;
    if (status !== undefined) queryParams.status = status;
    if (limit !== undefined) queryParams.limit = limit.toString();
    if (offset !== undefined) queryParams.offset = offset.toString();
    const response = await this.getRequest({
      schema: CampaignLocksResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/campaign_locks`,
      queryParams,
      options: fetchOptions,
    });
    return response.data;
  }

  /**
   * Subscribe to `protected_trial_update:{userAddr}`. Streaming-only — fires on
   * TrialOpened / TrialClosed / TrialResetByAdmin. Merge into HTTP-seeded list
   * by `trial_id`.
   *
   * Terminal pushes (TrialClosed, TrialResetByAdmin) may omit open-sourced
   * fields (`mark_at_open`, `market`, …) — see TrialDtoSchema docblock.
   */
  subscribeByAddr(account: string, onData: (data: ProtectedTrialUpdate) => void) {
    const topic = `protected_trial_update:${account}`;
    return this.deps.ws.subscribe(topic, ProtectedTrialUpdateSchema, onData);
  }

  /** Active lock via `/campaign_locks`; chain-scan fallback for missing endpoints (throwaway deploys) or indexer lag on a just-created lock. */
  private async findActiveLock(account: string) {
    try {
      const { locks } = await this.getCampaignLocks({
        account,
        campaignAddr: this.campaignAddr,
        status: "Active",
        limit: 1,
      });
      const lock = locks.at(0);
      if (lock !== undefined) {
        return {
          lockId: BigInt(lock.lock_id),
          unlocksAtMs: lock.unlocks_at_ms,
          lockSubaccount: lock.lock_subaccount,
        };
      }
    } catch (error) {
      // fall through to the chain scan
      this.noteChainFallback("findActiveLock", error);
    }
    return findActiveLockFromChain(this.chainFallbackDeps, account);
  }

  // ─── View-fn helpers ───────────────────────────────────────────────────────

  private campaignView<T extends unknown[]>(
    module: string,
    fn: string,
    args: unknown[],
  ): Promise<T> {
    return this.view<T>(`${this.campaignPackage}::${module}::${fn}`, args);
  }

  private async viewBool(module: string, fn: string, campaign: string): Promise<boolean> {
    const [value] = await this.campaignView<[boolean]>(module, fn, [campaign]);
    return value;
  }

  private async viewHasActiveTrial(campaign: string, user: string): Promise<boolean> {
    const [idOpt] = await this.campaignView<[{ vec: string[] }]>(
      "protected_trial",
      "active_trial_id_for",
      [campaign, user],
    );
    return idOpt.vec.length > 0;
  }

  private async viewCampaignTitle(campaign: string): Promise<string | null> {
    try {
      const [view] = await this.campaignView<[Record<string, unknown>]>(
        "campaign_manager",
        "get_campaign",
        [campaign],
      );
      const title = view.title;
      return typeof title === "string" && title.length > 0 ? title : null;
    } catch {
      return null;
    }
  }

  private async viewOwnerLockTotals(campaign: string, user: string) {
    // (active_locked_amount: u64, min_active_duration_days: u16, active_lock_count: u64)
    const result = await this.campaignView<[string, number, string]>(
      "campaign_lock",
      "get_owner_lock_totals",
      [campaign, user],
    );
    return {
      activeLockedAmount: BigInt(result[0]),
      minActiveDurationDays: result[1],
      activeLockCount: Number(result[2]),
    };
  }

  private async viewCreditAccount(campaign: string, user: string) {
    // (granted: u8, used: u8, tier_rank: u8, slate_version: u32)
    const result = await this.campaignView<[number, number, number, number]>(
      "user_credits",
      "get_credit_account",
      [campaign, user],
    );
    return { granted: result[0], used: result[1] };
  }

  private async viewTrialStateConfig(campaign: string) {
    const [config] = await this.campaignView<[Record<string, unknown>]>(
      "protected_trial",
      "trial_state_config",
      [campaign],
    );
    const payoutAnchors: PayoutAnchors = {
      lowLock: BigInt(config.payout_low_lock as string),
      lowProtected: BigInt(config.payout_low_protected as string),
      highLock: BigInt(config.payout_high_lock as string),
      highProtected: BigInt(config.payout_high_protected as string),
    };
    return {
      marketAddr: (config.market as { inner: string }).inner,
      expiryMs: Number(config.expiry_ms),
      minLockAmount: BigInt(config.min_lock_amount as string),
      sizeDecimalsPow10: Number(config.size_decimals_pow10),
      payoutAnchors,
    };
  }

  private async viewTierSlate(campaign: string): Promise<TierSlateTier[]> {
    const [config] = await this.campaignView<[Record<string, unknown>]>(
      "funded_first_trade",
      "get_tier_config",
      [campaign],
    );
    // Enum view: `{ __variant__: "V1", tier_config_version, tiers: [...] }`; u64 leverage arrives as string.
    const tiers = config.tiers as Array<Record<string, unknown>>;
    return tiers.map((tier) => ({
      durationDays: Number(tier.duration_days),
      credits: Number(tier.credits),
      tierRank: Number(tier.tier_rank),
      leverage: Number(tier.leverage),
    }));
  }

  /**
   * `perp_engine` view — the dex package, not the campaign package. Fails
   * open: the probe is UX gating; the engine's own order cancel is the
   * authoritative rejection.
   */
  private async viewIsMarketOpen(marketAddr: string): Promise<boolean> {
    try {
      const [open] = await this.view<[boolean]>(
        `${this.deps.config.deployment.package}::perp_engine::is_market_open`,
        [marketAddr],
      );
      return open;
    } catch {
      return true;
    }
  }

  private async viewDailyBurn(campaign: string) {
    const [burn] = await this.campaignView<[Record<string, unknown>]>(
      "protected_trial",
      "daily_burn_view",
      [campaign],
    );
    return {
      cap: BigInt(burn.cap_usd as string),
      windowTotal: BigInt(burn.window_total_usd as string),
      liveReservationCount: Number(burn.live_reservation_count),
    };
  }

  private async viewOiState(campaign: string) {
    const [oi] = await this.campaignView<[Record<string, unknown>]>("protected_trial", "oi_state", [
      campaign,
    ]);
    return {
      totalNotional: BigInt(oi.total_notional as string),
      cap: BigInt(oi.cap as string),
    };
  }
}
