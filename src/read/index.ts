import { AccountAddress, Aptos, AptosConfig, createObjectAddress } from "@aptos-labs/ts-sdk";
import { ErrorEvent } from "isomorphic-ws";

import { DecibelConfig, DecibelReaderDeps } from "../constants";
import { AccountOverviewReader } from "./account-overview/account-overview.reader";
import { CandlesticksReader } from "./candlesticks/candlesticks.reader";
import { DelegationsReader } from "./delegations/delegations.reader";
import { LeaderboardReader } from "./leaderboard/leaderboard.reader";
import { MarketContextsReader } from "./market-contexts/market-contexts.reader";
import { MarketDepthReader } from "./market-depth/market-depth.reader";
import { MarketPricesReader } from "./market-prices/market-prices.reader";
import { MarketTradesReader } from "./market-trades/market-trades.reader";
import { MarketsReader } from "./markets/markets.reader";
import { PortfolioChartReader } from "./portfolio-chart/portfolio-chart.reader";
import { CrossedPosition } from "./types";
import { UserActiveTwapsReader } from "./user-active-twaps/user-active-twaps.reader";
import { UserBulkOrdersReader } from "./user-bulk-orders/user-bulk-orders.reader";
import { UserFundHistoryReader } from "./user-fund-history/user-fund-history.reader";
import { UserFundingHistoryReader } from "./user-funding-history/user-funding-history.reader";
import { UserNotificationsReader } from "./user-notifications/user-notifications.reader";
import { UserOpenOrdersReader } from "./user-open-orders/user-open-orders.reader";
import { UserOrderHistoryReader } from "./user-order-history/user-order-history.reader";
import { UserPositionsReader } from "./user-positions/user-positions.reader";
import { UserSubaccountsReader } from "./user-subaccounts/user-subaccounts.reader";
import { UserTradeHistoryReader } from "./user-trade-history/user-trade-history.reader";
import { VaultsReader } from "./vaults/vaults.reader";
import { DecibelWsSubscription } from "./ws-subscription";

export * from "./types";

interface Cache {
  usdcDecimals?: number;
}

export class DecibelReadDex {
  readonly cache: Cache;
  readonly deps: DecibelReaderDeps;
  readonly accountOverview: AccountOverviewReader;
  readonly markets: MarketsReader;
  readonly marketContexts: MarketContextsReader;
  readonly marketDepth: MarketDepthReader;
  readonly marketPrices: MarketPricesReader;
  readonly marketTrades: MarketTradesReader;
  readonly userFundHistory: UserFundHistoryReader;
  readonly userFundingHistory: UserFundingHistoryReader;
  readonly userTradeHistory: UserTradeHistoryReader;
  readonly candlesticks: CandlesticksReader;
  readonly userSubaccounts: UserSubaccountsReader;
  readonly userPositions: UserPositionsReader;
  readonly userOrderHistory: UserOrderHistoryReader;
  readonly userOpenOrders: UserOpenOrdersReader;
  readonly userBulkOrders: UserBulkOrdersReader;
  readonly userActiveTwaps: UserActiveTwapsReader;
  readonly portfolioChart: PortfolioChartReader;
  readonly leaderboard: LeaderboardReader;
  readonly vaults: VaultsReader;
  readonly delegations: DelegationsReader;
  readonly userNotifications: UserNotificationsReader;

  constructor(
    readonly config: DecibelConfig,
    opts?: {
      nodeApiKey?: string;
      onWsError?: (error: ErrorEvent) => void;
    },
  ) {
    const aptosConfig = new AptosConfig({
      network: config.network,
      fullnode: config.fullnodeUrl,
      clientConfig: { API_KEY: opts?.nodeApiKey },
    });

    this.deps = {
      aptos: new Aptos(aptosConfig),
      ws: new DecibelWsSubscription(config, opts?.onWsError),
      config: this.config,
      apiKey: opts?.nodeApiKey,
    };

    this.cache = {};
    this.accountOverview = new AccountOverviewReader(this.deps);
    this.markets = new MarketsReader(this.deps);
    this.marketContexts = new MarketContextsReader(this.deps);
    this.marketDepth = new MarketDepthReader(this.deps);
    this.marketPrices = new MarketPricesReader(this.deps);
    this.marketTrades = new MarketTradesReader(this.deps);
    this.userPositions = new UserPositionsReader(this.deps);
    this.userOrderHistory = new UserOrderHistoryReader(this.deps);
    this.userSubaccounts = new UserSubaccountsReader(this.deps);
    this.userOpenOrders = new UserOpenOrdersReader(this.deps);
    this.userBulkOrders = new UserBulkOrdersReader(this.deps);
    this.userFundHistory = new UserFundHistoryReader(this.deps);
    this.userFundingHistory = new UserFundingHistoryReader(this.deps);
    this.userTradeHistory = new UserTradeHistoryReader(this.deps);
    this.userActiveTwaps = new UserActiveTwapsReader(this.deps);
    this.candlesticks = new CandlesticksReader(this.deps);
    this.portfolioChart = new PortfolioChartReader(this.deps);
    this.leaderboard = new LeaderboardReader(this.deps);
    this.vaults = new VaultsReader(this.deps);
    this.delegations = new DelegationsReader(this.deps);
    this.userNotifications = new UserNotificationsReader(this.deps);
  }

  async globalPerpEngineState() {
    try {
      // Attempt to get the global perp engine state resource
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, custom/no-get-account-resource
      return await this.deps.aptos.getAccountResource({
        accountAddress: this.config.deployment.package,
        resourceType: `${this.config.deployment.package}::perp_engine::Global`,
      });
    } catch {
      return false;
    }
  }

  async collateralBalanceDecimals() {
    const decimals = await this.deps.aptos.view<[string]>({
      payload: {
        function: `${this.config.deployment.package}::perp_engine::collateral_balance_decimals`,
        typeArguments: [],
        functionArguments: [],
      },
    });
    return Number(decimals[0]);
  }

  async usdcDecimals() {
    if (this.cache.usdcDecimals) {
      return this.cache.usdcDecimals;
    }
    const decimals = await this.deps.aptos.view<[string]>({
      payload: {
        function: `0x1::fungible_asset::decimals`,
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [this.config.deployment.usdc],
      },
    });
    this.cache.usdcDecimals = Number(decimals[0]);
    return this.cache.usdcDecimals;
  }

  async usdcBalance(addr: string | AccountAddress) {
    const usdcDecimals = await this.usdcDecimals();
    const balance = await this.deps.aptos.view<[string]>({
      payload: {
        function: `0x1::primary_fungible_store::balance`,
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [addr, this.config.deployment.usdc],
      },
    });
    return Number(balance[0]) / 10 ** usdcDecimals;
  }

  /**
   * Get the number of restricted mints remaining for the day.
   * Global value. Not specific to an account.
   *
   * @remarks This method is temporary and only for use in testnet. The mints_remaining
   * view function is a testnet-only feature and should be removed before mainnet deployment.
   */
  async mintsRemaining(): Promise<number> {
    const result = await this.deps.aptos.view<[string]>({
      payload: {
        function: `${this.config.deployment.package}::usdc::mints_remaining`,
        typeArguments: [],
        functionArguments: [],
      },
    });
    return Number(result[0]);
  }

  /**
   * Get the available restricted mint amount for an account (account limit).
   * Returns the amount in chain units (raw u64).
   *
   * @remarks This method is temporary and only for use in testnet. The available_restricted_mint_for
   * view function is a testnet-only feature and should be removed before mainnet deployment.
   */
  async availableRestrictedMintFor(addr: string | AccountAddress): Promise<number> {
    const result = await this.deps.aptos.view<[string]>({
      payload: {
        function: `${this.config.deployment.package}::usdc::available_restricted_mint_for`,
        typeArguments: [],
        functionArguments: [addr],
      },
    });
    return Number(result[0]);
  }

  /**
   * Get the timestamp when the global restricted mint limits for NEW accounts reset (in seconds).
   *
   * @remarks This method is temporary and only for use in testnet. The restricted_mint_daily_reset_timestamp
   * view function is a testnet-only feature and should be removed before mainnet deployment.
   */
  async getTriggerResetMintTs(): Promise<number> {
    const result = await this.deps.aptos.view<[string]>({
      payload: {
        function: `${this.config.deployment.package}::usdc::restricted_mint_daily_reset_timestamp`,
        typeArguments: [],
        functionArguments: [],
      },
    });
    return Number(result[0]);
  }

  /**
   * Get the timestamp when the account-specific restricted mint limits reset (in seconds).
   *
   * @remarks This method is temporary and only for use in testnet. The restricted_mint_daily_reset_timestamp_for
   * view function is a testnet-only feature and should be removed before mainnet deployment.
   */
  async getAccountTriggerResetMintTs(addr: string | AccountAddress): Promise<number> {
    const result = await this.deps.aptos.view<[string]>({
      payload: {
        function: `${this.config.deployment.package}::usdc::restricted_mint_daily_reset_timestamp_for`,
        typeArguments: [],
        functionArguments: [addr],
      },
    });
    return Number(result[0]);
  }

  async tokenBalance(
    addr: string | AccountAddress,
    tokenAddr: string | AccountAddress,
    tokenDecimals: number,
  ) {
    const balance = await this.deps.aptos.view<[string]>({
      payload: {
        function: `0x1::primary_fungible_store::balance`,
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [addr, tokenAddr],
      },
    });
    return Number(balance[0]) / 10 ** tokenDecimals;
  }

  /**
   * Get the balance of the account
   * @returns The balance of the account
   */
  async accountBalance(addr: AccountAddress) {
    const balance = await this.deps.aptos.view<[number]>({
      payload: {
        function: `${this.config.deployment.package}::perp_engine::get_account_balance_fungible`,
        typeArguments: [],
        functionArguments: [addr],
      },
    });
    return balance[0];
  }

  /**
   * Get the size of the position for an account
   * @param addr The address of the account to get the position size for
   * @param marketAddr The name of the market to get the position size for
   * @returns The size of the position for the account
   */
  async positionSize(addr: AccountAddress, marketAddr: string) {
    return await this.deps.aptos.view<[number]>({
      payload: {
        function: `${this.config.deployment.package}::perp_engine::get_position_size`,
        typeArguments: [],
        functionArguments: [addr, marketAddr],
      },
    });
  }

  /**
   * Get the crossed position for an account
   * @param addr The address of the account to get the crossed position for
   * @returns The crossed position for the account
   */
  async getCrossedPosition(addr: AccountAddress) {
    const seed = new TextEncoder().encode("perp_position");
    const crossedPositionAddr = createObjectAddress(addr, seed);
    try {
      // TODO: Fix lint error
      // eslint-disable-next-line custom/no-get-account-resource
      const crossedPosition = await this.deps.aptos.getAccountResource<CrossedPosition>({
        accountAddress: crossedPositionAddr,
        resourceType: `${this.config.deployment.package}::perp_positions::CrossedPosition`,
      });
      return CrossedPosition.parse(crossedPosition);
    } catch {
      return null;
    }
  }
}
