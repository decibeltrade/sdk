import { Account, AccountAddress, CommittedTransactionResponse } from "@aptos-labs/ts-sdk";

import { BaseSDK, Options } from "./base";
import { DecibelConfig, getDexApiModule } from "./constants";
import { OrderEvent, PlaceOrderResult, TwapEvent } from "./order-event.types";
import { OrderStatusClient } from "./order-status";
import {
  ActivateVaultArgs,
  CreateVaultArgs,
  DepositToVaultArgs,
  WithdrawFromVaultArgs,
} from "./read";
import { RenameSubaccountArgs, RenameSubaccountSchema } from "./subaccount-types";
import { getMarketAddr, getPrimarySubaccountAddr, postRequest } from "./utils";

export const TimeInForce = {
  GoodTillCanceled: 0,
  PostOnly: 1,
  ImmediateOrCancel: 2,
} as const;
export type TimeInForce = (typeof TimeInForce)[keyof typeof TimeInForce];

interface Cache {
  usdcDecimals?: number;
}

type WithSignerAddress<T> = T & {
  signerAddress: AccountAddress;
};

/**
 * Rounds price to the nearest tick size multiple
 * @param price The price to round
 * @param tickSize The market's tick size
 * @returns Price rounded to nearest tick size multiple
 */
function roundToTickSize(price: number, tickSize: number): number {
  if (price === 0 || tickSize === 0) return 0;
  return Math.round(price / tickSize) * tickSize;
}

export class DecibelWriteDex extends BaseSDK {
  readonly cache: Cache;
  readonly orderStatusClient: OrderStatusClient;

  constructor(config: DecibelConfig, account: Account, opts?: Options) {
    super(config, account, opts);
    this.cache = {};
    this.orderStatusClient = new OrderStatusClient(config);
  }

  /**
   * Extract order_id from OrderEvent in transaction response
   */
  private extractOrderIdFromTransaction(
    txResponse: CommittedTransactionResponse,
    subaccountAddr?: string,
  ): string | null {
    const orderEvents = ["market_types::OrderEvent", "async_matching_engine::TwapEvent"];
    try {
      // Check if the response is a UserTransactionResponse with events
      if ("events" in txResponse && Array.isArray(txResponse.events)) {
        for (const event of txResponse.events) {
          // Check if this is an OrderEvent from the market module
          for (const orderEvent of orderEvents) {
            if (event.type.includes(orderEvent)) {
              const orderEvent = event.data as OrderEvent | TwapEvent;
              // Verify the event's user field matches the subaccount placing the order
              const userAddress = subaccountAddr ?? this.account.accountAddress;
              const orderUserAddress = (orderEvent as OrderEvent).user;
              const twapUserAddress = (orderEvent as TwapEvent).account;
              if (orderUserAddress === userAddress || twapUserAddress === userAddress) {
                return typeof orderEvent.order_id === "string"
                  ? orderEvent.order_id
                  : orderEvent.order_id.order_id;
              }
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Error extracting order_id from transaction:", error);
      return null;
    }
  }

  async renameSubaccount({ subaccountAddress, newName }: RenameSubaccountArgs) {
    return await postRequest({
      schema: RenameSubaccountSchema,
      url: `${this.config.tradingHttpUrl}/api/v1/subaccounts/${subaccountAddress}`,
      body: { name: newName },
    });
  }

  async createSubaccount() {
    const dexApiModule = getDexApiModule(this.config.compatVersion);
    return await this.sendTx({
      function: `${this.config.deployment.package}::${dexApiModule}::create_new_subaccount`,
      typeArguments: [],
      functionArguments: [],
    });
  }

  async sendSubaccountTx(
    sendTx: (subaccountAddr: string) => Promise<CommittedTransactionResponse>,
    subaccountAddr?: string,
  ) {
    if (!subaccountAddr) {
      subaccountAddr = getPrimarySubaccountAddr(
        this.account.accountAddress,
        this.config.compatVersion,
        this.config.deployment.package,
      );
    }
    return await sendTx(subaccountAddr);
  }

  async withSubaccount<T>(fn: (subaccountAddr: string) => Promise<T>, subaccountAddr?: string) {
    if (!subaccountAddr) {
      subaccountAddr = getPrimarySubaccountAddr(
        this.account.accountAddress,
        this.config.compatVersion,
        this.config.deployment.package,
      );
    }
    return await fn(subaccountAddr);
  }
  /**
   * @param amount u64 amount of collateral to deposit
   */
  async deposit(amount: number, subaccountAddr?: string) {
    if (!subaccountAddr) {
      subaccountAddr = getPrimarySubaccountAddr(
        this.account.accountAddress,
        this.config.compatVersion,
        this.config.deployment.package,
      );
    }
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx({
          function: `${this.config.deployment.package}::dex_accounts::deposit_to_subaccount_at`,
          typeArguments: [],
          functionArguments: [subaccountAddr, this.config.deployment.usdc, amount],
        }),
      subaccountAddr,
    );
  }

  /**
   * @param amount u64 amount of collateral to withdraw
   */
  async withdraw(amount: number, subaccountAddr?: string) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx({
          function: `${this.config.deployment.package}::dex_accounts::withdraw_from_subaccount`,
          typeArguments: [],
          functionArguments: [subaccountAddr, this.config.deployment.usdc, amount],
        }),
      subaccountAddr,
    );
  }

  async configureUserSettingsForMarket({
    marketAddr,
    subaccountAddr,
    isCross,
    userLeverage,
  }: {
    marketAddr: string;
    subaccountAddr: string;
    isCross: boolean;
    userLeverage: number;
  }) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx({
          function: `${this.config.deployment.package}::dex_accounts::configure_user_settings_for_market`,
          typeArguments: [],
          functionArguments: [subaccountAddr, marketAddr, isCross, userLeverage],
        }),
      subaccountAddr,
    );
  }

  async placeOrder({
    marketName,
    price,
    size,
    isBuy,
    timeInForce,
    isReduceOnly,
    clientOrderId,
    stopPrice,
    tpTriggerPrice,
    tpLimitPrice,
    slTriggerPrice,
    slLimitPrice,
    builderAddr,
    builderFee,
    subaccountAddr,
    accountOverride,
    tickSize,
  }: {
    marketName: string;
    price: number;
    size: number;
    isBuy: boolean;
    timeInForce: TimeInForce;
    isReduceOnly: boolean;
    clientOrderId?: string;
    stopPrice?: number;
    tpTriggerPrice?: number;
    tpLimitPrice?: number;
    slTriggerPrice?: number;
    slLimitPrice?: number;
    builderAddr?: string;
    builderFee?: number;
    subaccountAddr?: string;
    /**
     * Optional account to use for the transaction. Primarily set as the session
     * account.  If not provided, the default constructor account will be used
     */
    accountOverride?: Account;
    /**
     * Market tick size for price rounding. If not provided, no rounding is applied.
     */
    tickSize?: number;
  }): Promise<PlaceOrderResult> {
    try {
      const marketAddr = getMarketAddr(marketName, this.config.deployment.perpEngineGlobal);

      // Apply tick size rounding if tickSize is provided
      const roundedPrice = tickSize ? roundToTickSize(price, tickSize) : price;
      const roundedStopPrice =
        stopPrice !== undefined && tickSize ? roundToTickSize(stopPrice, tickSize) : stopPrice;
      const roundedTpTriggerPrice =
        tpTriggerPrice !== undefined && tickSize
          ? roundToTickSize(tpTriggerPrice, tickSize)
          : tpTriggerPrice;
      const roundedTpLimitPrice =
        tpLimitPrice !== undefined && tickSize
          ? roundToTickSize(tpLimitPrice, tickSize)
          : tpLimitPrice;
      const roundedSlTriggerPrice =
        slTriggerPrice !== undefined && tickSize
          ? roundToTickSize(slTriggerPrice, tickSize)
          : slTriggerPrice;
      const roundedSlLimitPrice =
        slLimitPrice !== undefined && tickSize
          ? roundToTickSize(slLimitPrice, tickSize)
          : slLimitPrice;

      const txResponse = await this.sendSubaccountTx(
        (subaccountAddr) =>
          this.sendTx(
            {
              function: `${this.config.deployment.package}::dex_accounts::place_order_to_subaccount`,
              typeArguments: [],
              functionArguments: [
                subaccountAddr,
                marketAddr.toString(),
                roundedPrice,
                size,
                isBuy,
                timeInForce,
                isReduceOnly,
                clientOrderId,
                roundedStopPrice,
                roundedTpTriggerPrice,
                roundedTpLimitPrice,
                roundedSlTriggerPrice,
                roundedSlLimitPrice,
                builderAddr,
                builderFee,
              ],
            },
            accountOverride,
          ),
        subaccountAddr,
      );

      // Extract order_id from the transaction events
      const orderId = this.extractOrderIdFromTransaction(txResponse, subaccountAddr);

      return {
        success: true,
        orderId: orderId || undefined,
        transactionHash: txResponse.hash,
      };
    } catch (error) {
      console.error("Error placing order:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async triggerMatching({ marketAddr, maxWorkUnit }: { marketAddr: string; maxWorkUnit: number }) {
    const txResponse = await this.sendTx({
      function: `${this.config.deployment.package}::public_apis::trigger_matching`,
      typeArguments: [],
      functionArguments: [marketAddr, maxWorkUnit],
    });
    return {
      success: true,
      transactionHash: txResponse.hash,
    };
  }

  async placeTwapOrder({
    marketName,
    size,
    isBuy,
    isReduceOnly,
    // clientOrderId,
    twapFrequencySeconds,
    twapDurationSeconds,
    builderAddress,
    builderFees,
    subaccountAddr,
    accountOverride,
  }: {
    marketName: string;
    size: number;
    isBuy: boolean;
    isReduceOnly: boolean;
    // clientOrderId?: string;
    twapFrequencySeconds: number;
    twapDurationSeconds: number;
    builderAddress?: string;
    builderFees?: number;
    subaccountAddr?: string;
    /**
     * Optional account to use for the transaction. Primarily set as the session
     * account.  If not provided, the default constructor account will be used
     */
    accountOverride?: Account;
  }) {
    const marketAddr = getMarketAddr(marketName, this.config.deployment.perpEngineGlobal);
    const txResponse = await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx(
          {
            // TODO: update to place_twap_order_to_subaccount_v2 once available
            function: `${this.config.deployment.package}::dex_accounts::place_twap_order_to_subaccount`,
            typeArguments: [],
            functionArguments: [
              subaccountAddr,
              marketAddr.toString(),
              size,
              isBuy,
              isReduceOnly,
              // clientOrderId, // TODO: include once v2 is available
              twapFrequencySeconds,
              twapDurationSeconds,
              builderAddress,
              builderFees,
            ],
          },
          accountOverride,
        ),
      subaccountAddr,
    );

    const orderId = this.extractOrderIdFromTransaction(txResponse, subaccountAddr);

    return {
      success: true,
      orderId: orderId || undefined,
      transactionHash: txResponse.hash,
    };
  }

  /**
   * Cancel an order on the exchange
   * @param orderId The id of the order to cancel
   * @param marketId The id of the market the order is in
   * @param subaccountAddr Optional subaccount address, will use primary if not provided
   * @returns Transaction response
   */
  async cancelOrder({
    orderId,
    subaccountAddr,
    accountOverride,
    ...args
  }: {
    orderId: number | string;

    subaccountAddr?: string;
    /**
     * Optional account to use for the transaction. Primarily set as the session
     * account.  If not provided, the default constructor account will be used
     */
    accountOverride?: Account;
  } & ({ marketName: string } | { marketAddr: string })) {
    // Either marketName or marketAddr must be provided
    const marketAddr =
      "marketName" in args
        ? getMarketAddr(args.marketName, this.config.deployment.perpEngineGlobal)
        : args.marketAddr;

    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx(
          {
            function: `${this.config.deployment.package}::dex_accounts::cancel_order_to_subaccount`,
            typeArguments: [],
            functionArguments: [subaccountAddr, BigInt(orderId.toString()), marketAddr.toString()],
          },
          accountOverride,
        ),
      subaccountAddr,
    );
  }

  async cancelClientOrder({
    clientOrderId,
    marketName,
    subaccountAddr,
    accountOverride,
  }: {
    clientOrderId: string;
    marketName: string;
    subaccountAddr?: string;
    /**
     * Optional account to use for the transaction. Primarily set as the session
     * account.  If not provided, the default constructor account will be used
     */
    accountOverride?: Account;
  }) {
    const marketAddr = getMarketAddr(marketName, this.config.deployment.perpEngineGlobal);
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx(
          {
            function: `${this.config.deployment.package}::dex_accounts::cancel_client_order_to_subaccount`,
            typeArguments: [],
            functionArguments: [subaccountAddr, clientOrderId, marketAddr.toString()],
          },
          accountOverride,
        ),
      subaccountAddr,
    );
  }

  async delegateTradingToForSubaccount({
    subaccountAddr,
    accountToDelegateTo,
    expirationTimestampSecs,
  }: {
    subaccountAddr: string;
    accountToDelegateTo: string;
    expirationTimestampSecs?: number;
  }) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx({
          function: `${this.config.deployment.package}::dex_accounts::delegate_trading_to_for_subaccount`,
          typeArguments: [],
          functionArguments: [subaccountAddr, accountToDelegateTo, expirationTimestampSecs ?? null],
        }),
      subaccountAddr,
    );
  }

  async revokeDelegation({
    subaccountAddr,
    accountToRevoke,
  }: {
    subaccountAddr?: string;
    accountToRevoke: string;
  }) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx({
          function: `${this.config.deployment.package}::dex_accounts::revoke_delegation`,
          typeArguments: [],
          functionArguments: [subaccountAddr, accountToRevoke],
        }),
      subaccountAddr,
    );
  }

  /**
   * Place a TP/SL order for a position
   */
  async placeTpSlOrderForPosition({
    marketAddr,
    tpTriggerPrice,
    tpLimitPrice,
    tpSize,
    slTriggerPrice,
    slLimitPrice,
    slSize,
    subaccountAddr,
    accountOverride,
    tickSize,
  }: {
    marketAddr: string;
    tpTriggerPrice?: number;
    tpLimitPrice?: number;
    tpSize?: number;
    slTriggerPrice?: number;
    slLimitPrice?: number;
    slSize?: number;
    subaccountAddr?: string;
    accountOverride?: Account;
    tickSize?: number;
  }) {
    const roundedTpTriggerPrice =
      tpTriggerPrice !== undefined && tickSize
        ? roundToTickSize(tpTriggerPrice, tickSize)
        : tpTriggerPrice;
    const roundedTpLimitPrice =
      tpLimitPrice !== undefined && tickSize
        ? roundToTickSize(tpLimitPrice, tickSize)
        : tpLimitPrice;
    const roundedSlTriggerPrice =
      slTriggerPrice !== undefined && tickSize
        ? roundToTickSize(slTriggerPrice, tickSize)
        : slTriggerPrice;
    const roundedSlLimitPrice =
      slLimitPrice !== undefined && tickSize
        ? roundToTickSize(slLimitPrice, tickSize)
        : slLimitPrice;

    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx(
          {
            function: `${this.config.deployment.package}::dex_accounts::place_tp_sl_order_for_position`,
            typeArguments: [],
            functionArguments: [
              subaccountAddr,
              marketAddr,
              roundedTpTriggerPrice,
              roundedTpLimitPrice,
              tpSize,
              roundedSlTriggerPrice,
              roundedSlLimitPrice,
              slSize,
              undefined, // builderAddr
              undefined, // builderFees
            ],
          },
          accountOverride,
        ),
      subaccountAddr,
    );
  }

  /**
   * Update TP for a position
   */
  async updateTpOrderForPosition({
    marketAddr,
    prevOrderId,
    tpTriggerPrice,
    tpLimitPrice,
    tpSize,
    subaccountAddr,
    accountOverride,
  }: {
    marketAddr: string;
    prevOrderId: number | string;
    tpTriggerPrice?: number;
    tpLimitPrice?: number;
    tpSize?: number;
    subaccountAddr?: string;
    accountOverride?: Account;
  }) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx(
          {
            function: `${this.config.deployment.package}::dex_accounts::update_tp_order_for_position`,
            typeArguments: [],
            functionArguments: [
              subaccountAddr,
              BigInt(prevOrderId.toString()),
              marketAddr,
              tpTriggerPrice,
              tpLimitPrice,
              tpSize,
            ],
          },
          accountOverride,
        ),
      subaccountAddr,
    );
  }

  /**
   * Update SL for a position
   */
  async updateSlOrderForPosition({
    marketAddr,
    prevOrderId,
    slTriggerPrice,
    slLimitPrice,
    slSize,
    subaccountAddr,
    accountOverride,
  }: {
    marketAddr: string;
    prevOrderId: number | string;
    slTriggerPrice?: number;
    slLimitPrice?: number;
    slSize?: number;
    subaccountAddr?: string;
    accountOverride?: Account;
  }) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx(
          {
            function: `${this.config.deployment.package}::dex_accounts::update_sl_order_for_position`,
            typeArguments: [],
            functionArguments: [
              subaccountAddr,
              BigInt(prevOrderId.toString()),
              marketAddr,
              slTriggerPrice,
              slLimitPrice,
              slSize,
            ],
          },
          accountOverride,
        ),
      subaccountAddr,
    );
  }

  /**
   * Cancel a TP/SL order for a position
   */
  async cancelTpSlOrderForPosition({
    marketAddr,
    orderId,
    subaccountAddr,
    accountOverride,
  }: {
    marketAddr: string;
    orderId: number | string;
    subaccountAddr?: string;
    accountOverride?: Account;
  }) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx(
          {
            function: `${this.config.deployment.package}::dex_accounts::cancel_tp_sl_order_for_position`,
            typeArguments: [],
            functionArguments: [subaccountAddr, marketAddr, BigInt(orderId.toString())],
          },
          accountOverride,
        ),
      subaccountAddr,
    );
  }

  async cancelTwapOrder({
    orderId,
    marketAddr,
    subaccountAddr,
    accountOverride,
  }: {
    orderId: string;
    marketAddr: string;
    subaccountAddr?: string;
    /**
     * Optional account to use for the transaction. Primarily set as the session
     * account.  If not provided, the default constructor account will be used
     */
    accountOverride?: Account;
  }) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx(
          {
            function: `${this.config.deployment.package}::dex_accounts::cancel_twap_orders_to_subaccount`,
            typeArguments: [],
            functionArguments: [subaccountAddr, marketAddr, orderId],
          },
          accountOverride,
        ),
      subaccountAddr,
    );
  }

  async buildDeactiveSubaccountTx({
    subaccountAddr,
    revokeAllDelegations = true,
    signerAddress,
  }: WithSignerAddress<{
    subaccountAddr: string;
    revokeAllDelegations: boolean;
  }>) {
    const transaction = await this.buildTx(
      {
        function: `${this.config.deployment.package}::dex_accounts::deactivate_subaccount`,
        typeArguments: [],
        functionArguments: [subaccountAddr, revokeAllDelegations],
      },
      signerAddress,
    );
    return transaction;
  }

  // ======= VAULT FUNCTIONS =======

  // @Todo: We can move this to another Class and this doesnt requires subaccount so dont belong in here
  /**
   * Create a new vault with optional initial funding
   */
  async buildCreateVaultTx({
    contributionAssetType,
    vaultName,
    vaultShareSymbol,
    vaultShareIconUri = "",
    vaultShareProjectUri = "",
    feeBps,
    feeIntervalS,
    contributionLockupDurationS,
    initialFunding = 0,
    acceptsContributions = false,
    delegateToCreator = false,
    signerAddress,
    vaultDescription,
    vaultSocialLinks,
  }: WithSignerAddress<CreateVaultArgs>) {
    const transaction = await this.buildTx(
      {
        function: `${this.config.deployment.package}::vault_api::create_and_fund_vault`,
        typeArguments: [],
        functionArguments: [
          null,
          contributionAssetType,
          vaultName,
          vaultDescription,
          vaultSocialLinks,
          vaultShareSymbol,
          vaultShareIconUri,
          vaultShareProjectUri,
          feeBps,
          feeIntervalS,
          contributionLockupDurationS,
          initialFunding,
          acceptsContributions,
          delegateToCreator,
        ],
      },
      signerAddress,
    );

    return transaction;
  }

  async createVault(
    args: CreateVaultArgs & {
      /**
       * Optional account to use for the transaction. Primarily set as the session
       * account.  If not provided, the default constructor account will be used
       */
      accountOverride?: Account;
      subaccountAddr?: string;
    },
  ) {
    const txResponse = await this.sendSubaccountTx(
      () =>
        this.sendTx(
          {
            function: `${this.config.deployment.package}::vault_api::create_and_fund_vault`,
            typeArguments: [],
            functionArguments: [
              args.subaccountAddr ?? null,
              args.contributionAssetType,
              args.vaultName,
              args.vaultDescription,
              args.vaultSocialLinks,
              args.vaultShareSymbol,
              args.vaultShareIconUri,
              args.vaultShareProjectUri,
              args.feeBps,
              args.feeIntervalS,
              args.contributionLockupDurationS,
              args.initialFunding,
              args.acceptsContributions,
              args.delegateToCreator,
            ],
          },
          args.accountOverride,
        ),
      args.subaccountAddr,
    );

    return txResponse;
  }

  /**
   * Activate a vault to accept contributions
   */
  async buildActivateVaultTx({
    vaultAddress,
    additionalFunding = 0,
    signerAddress,
  }: WithSignerAddress<ActivateVaultArgs>) {
    return await this.buildTx(
      {
        function: `${this.config.deployment.package}::vault_api::activate_vault`,
        typeArguments: [],
        functionArguments: [vaultAddress, additionalFunding],
      },
      signerAddress,
    );
  }

  /**
   * Contribute funds to a vault in exchange for shares
   */
  async buildDepositToVaultTx({
    vaultAddress,
    amount,
    signerAddress,
  }: WithSignerAddress<DepositToVaultArgs>) {
    return await this.buildTx(
      {
        function: `${this.config.deployment.package}::vault_api::contribute`,
        typeArguments: [],
        functionArguments: [vaultAddress, amount],
      },
      signerAddress,
    );
  }

  async depositToVault(
    args: DepositToVaultArgs & {
      subaccountAddr: string;
    },
  ) {
    const txResponse = await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx({
          function: `${this.config.deployment.package}::dex_accounts_vault_extension::contribute_to_vault`,
          typeArguments: [],
          functionArguments: [
            subaccountAddr,
            args.vaultAddress,
            this.config.deployment.usdc,
            args.amount,
          ],
        }),
      args.subaccountAddr,
    );

    return txResponse;
  }

  /**
   * Redeem shares from a vault for underlying assets
   */
  async buildWithdrawFromVaultTx({
    vaultAddress,
    shares,
    signerAddress,
  }: WithSignerAddress<WithdrawFromVaultArgs>) {
    return await this.buildTx(
      {
        function: `${this.config.deployment.package}::vault_api::redeem`,
        typeArguments: [],
        functionArguments: [vaultAddress, shares],
      },
      signerAddress,
    );
  }

  async withdrawFromVault(
    args: WithdrawFromVaultArgs & {
      /**
       * Optional account to use for the transaction. Primarily set as the session
       * account.  If not provided, the default constructor account will be used
       */
      accountOverride?: Account;
      subaccountAddr?: string;
    },
  ) {
    const txResponse = await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx(
          {
            function: `${this.config.deployment.package}::dex_accounts_vault_extension::redeem_from_vault`,
            typeArguments: [],
            functionArguments: [subaccountAddr, args.vaultAddress, args.shares],
          },
          args.accountOverride,
        ),
      args.subaccountAddr,
    );

    return txResponse;
  }
  /**
   * Delegate trading to another account for a vault
   */
  async buildDelegateDexActionsToTx({
    vaultAddress,
    accountToDelegateTo,
    signerAddress,
    expirationTimestampSecs,
  }: WithSignerAddress<{
    vaultAddress: string;
    accountToDelegateTo: string;
    expirationTimestampSecs?: number;
  }>) {
    return await this.buildTx(
      {
        function: `${this.config.deployment.package}::vault::delegate_dex_actions_to`,
        typeArguments: [],
        functionArguments: [vaultAddress, accountToDelegateTo, expirationTimestampSecs],
      },
      signerAddress,
    );
  }

  /**
   * Approve max builder fee for a subaccount
   * @param builderAddr The address of the builder
   * @param maxFee The maximum fee in basis points (e.g., 100 = 0.01%)
   * @param subaccountAddr Optional subaccount address, will use primary if not provided
   */
  async approveMaxBuilderFee({
    builderAddr,
    maxFee,
    subaccountAddr,
  }: {
    builderAddr: string;
    maxFee: number;
    subaccountAddr?: string;
  }) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx({
          function: `${this.config.deployment.package}::dex_accounts::approve_max_builder_fee_for_subaccount`,
          typeArguments: [],
          functionArguments: [subaccountAddr, builderAddr, maxFee],
        }),
      subaccountAddr,
    );
  }

  /**
   * Revoke max builder fee for a subaccount
   * @param builderAddr The address of the builder
   * @param subaccountAddr Optional subaccount address, will use primary if not provided
   */
  async revokeMaxBuilderFee({
    builderAddr,
    subaccountAddr,
  }: {
    builderAddr: string;
    subaccountAddr?: string;
  }) {
    return await this.sendSubaccountTx(
      (subaccountAddr) =>
        this.sendTx({
          function: `${this.config.deployment.package}::dex_accounts::revoke_max_builder_fee_for_subaccount`,
          typeArguments: [],
          functionArguments: [subaccountAddr, builderAddr],
        }),
      subaccountAddr,
    );
  }
}
