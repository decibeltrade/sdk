import { AccountAddress, createObjectAddress } from "@aptos-labs/ts-sdk";

import { BaseSDK } from "./base";
import { getMarketAddr } from "./utils";

export class DecibelAdminDex extends BaseSDK {
  /**
   * Initialize the global vault system. Only callable by the admin account.
   */
  async initialize(collateralTokenAddr: string, backstopLiquidatorAddr: string) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::initialize`,
      typeArguments: [],
      functionArguments: [collateralTokenAddr, backstopLiquidatorAddr],
    });
  }

  getProtocolVaultAddress(): AccountAddress {
    const vaultConfigObjectAddr = createObjectAddress(
      AccountAddress.fromString(this.config.deployment.package),
      "GlobalVaultConfig",
    );
    const protocolVaultObjectAddr = createObjectAddress(
      vaultConfigObjectAddr,
      "Decibel Protocol Vault",
    );

    return protocolVaultObjectAddr;
  }

  async initializeProtocolVault(collateralTokenAddr: string, initialFunding: number) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::vault_api::create_and_fund_vault`,
      typeArguments: [],
      functionArguments: [
        null,
        collateralTokenAddr,
        "Decibel Protocol Vault",
        "(description)",
        [],
        "DPV",
        "",
        "",
        0, // fee_bps
        0, // fee_interval
        3 * 24 * 60 * 60, // contribution_lockup_duration_s
        initialFunding, // initial_funding
        true, // accepts_contributions
        false, // delegate_to_creator
      ],
    });
  }

  async delegateProtocolVaultTradingTo(vaultAddress: string, accountToDelegateTo: string) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::vault::delegate_dex_actions_to`,
      typeArguments: [],
      functionArguments: [vaultAddress, accountToDelegateTo, undefined],
    });
  }

  async updateVaultUseGlobalRedemptionSlippageAdjustment(
    vaultAddress: string,
    useGlobalRedemptionSlippageAdjustment: boolean,
  ) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::vault::update_vault_use_global_redemption_slippage_adjustment`,
      typeArguments: [],
      functionArguments: [vaultAddress, useGlobalRedemptionSlippageAdjustment],
    });
  }

  async authorizeOracleAndMarkUpdate(internalOracleUpdater: string) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::add_oracle_and_mark_update_permission`,
      typeArguments: [],
      functionArguments: [internalOracleUpdater],
    });
  }

  async addAccessControlAdmin(delegatedAdmin: string) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::add_access_control_admin`,
      typeArguments: [],
      functionArguments: [delegatedAdmin],
    });
  }

  async addMarketListAdmin(delegatedAdmin: string) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::add_market_list_admin`,
      typeArguments: [],
      functionArguments: [delegatedAdmin],
    });
  }

  async addMarketRiskGovernor(delegatedAdmin: string) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::add_market_risk_governor`,
      typeArguments: [],
      functionArguments: [delegatedAdmin],
    });
  }

  async registerMarketWithInternalOracle(
    name: string,
    szDecimals: number,
    minSize: number,
    lotSize: number,
    tickerSize: number,
    maxOpenInterest: number,
    maxLeverage: number,
    marginCallFeePct: number,
    taker_in_next_block = true,
    initial_oracle_price = 1,
    max_staleness_secs = 60,
  ) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::register_market_with_internal_oracle`,
      typeArguments: [],
      functionArguments: [
        name,
        szDecimals,
        minSize,
        lotSize,
        tickerSize,
        maxOpenInterest,
        maxLeverage,
        marginCallFeePct,
        taker_in_next_block,
        initial_oracle_price,
        max_staleness_secs,
      ],
    });
  }

  async registerMarketWithPythOracle(
    name: string,
    szDecimals: number,
    minSize: number,
    lotSize: number,
    tickerSize: number,
    maxOpenInterest: number,
    maxLeverage: number,
    marginCallFeePct: number,
    taker_in_next_block = true,
    pythIdentifierBytes: number[],
    pythMaxStalenessSecs: number,
    pythConfidenceIntervalThreshold: number,
    pythDecimals: number,
  ) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::register_market_with_pyth_oracle`,
      typeArguments: [],
      functionArguments: [
        name,
        szDecimals,
        minSize,
        lotSize,
        tickerSize,
        maxOpenInterest,
        maxLeverage,
        marginCallFeePct,
        taker_in_next_block,
        pythIdentifierBytes,
        pythMaxStalenessSecs,
        pythConfidenceIntervalThreshold,
        pythDecimals,
      ],
    });
  }

  async registerMarketWithCompositeOraclePrimaryPyth(
    name: string,
    szDecimals: number,
    minSize: number,
    lotSize: number,
    tickerSize: number,
    maxOpenInterest: number,
    maxLeverage: number,
    marginCallFeePct: number,
    taker_in_next_block = true,
    pythIdentifierBytes: number[],
    pythMaxStalenessSecs: number,
    pythConfidenceIntervalThreshold: number,
    pythDecimals: number,
    internalInitialPrice: number,
    internalMaxStalenessSecs: number,
    oraclesDeviationBps: number,
    consecutiveDeviationCount: number,
  ) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::register_market_with_composite_oracle_primary_pyth`,
      typeArguments: [],
      functionArguments: [
        name,
        szDecimals,
        minSize,
        lotSize,
        tickerSize,
        maxOpenInterest,
        maxLeverage,
        marginCallFeePct,
        taker_in_next_block,
        pythIdentifierBytes,
        pythMaxStalenessSecs,
        pythConfidenceIntervalThreshold,
        pythDecimals,
        internalInitialPrice,
        internalMaxStalenessSecs,
        oraclesDeviationBps,
        consecutiveDeviationCount,
      ],
    });
  }

  async registerMarketWithCompositeOraclePrimaryChainlink(
    name: string,
    szDecimals: number,
    minSize: number,
    lotSize: number,
    tickerSize: number,
    maxOpenInterest: number,
    maxLeverage: number,
    marginCallFeePct: number,
    taker_in_next_block = true,
    rescaleDecimals: number,
    chainlinkFeedIdBytes: number[],
    chainlinkMaxStalenessSecs: number,
    internalMaxStalenessSecs: number,
    internalInitialPrice: number,
    oraclesDeviationBps: number,
    consecutiveDeviationCount: number,
  ) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::register_market_with_composite_oracle_primary_chainlink`,
      typeArguments: [],
      functionArguments: [
        name,
        szDecimals,
        minSize,
        lotSize,
        tickerSize,
        maxOpenInterest,
        maxLeverage,
        marginCallFeePct,
        taker_in_next_block,
        chainlinkFeedIdBytes,
        chainlinkMaxStalenessSecs,
        rescaleDecimals,
        internalInitialPrice,
        internalMaxStalenessSecs,
        oraclesDeviationBps,
        consecutiveDeviationCount,
      ],
    });
  }

  async updateInternalOraclePrice(marketName: string, oraclePrice: number) {
    const marketAddr = getMarketAddr(marketName, this.config.deployment.perpEngineGlobal);
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::update_mark_for_internal_oracle`,
      typeArguments: [],
      functionArguments: [marketAddr, oraclePrice, [], [], true],
    });
  }

  async updatePythOraclePrice(marketName: string, vaa: number[]) {
    const marketAddr = getMarketAddr(marketName, this.config.deployment.perpEngineGlobal);
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::update_mark_for_pyth_oracle`,
      typeArguments: [],
      functionArguments: [marketAddr, vaa, [], [], true],
    });
  }

  async updatePriceToPythOnly(vaas: number[][]) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::pyth::update_price_feeds_with_funder`,
      typeArguments: [],
      functionArguments: [vaas],
    });
  }

  async updatePriceToChainlinkOnly(signedReport: number[]) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::chainlink_state::verify_and_store_single_price`,
      typeArguments: [],
      functionArguments: [signedReport],
    });
  }

  async mintUsdc(toAddr: AccountAddress, amount: number) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::usdc::mint`,
      typeArguments: [],
      functionArguments: [toAddr, amount],
    });
  }

  async setPublicMinting(allow: boolean) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::usdc::set_public_minting`,
      typeArguments: [],
      functionArguments: [allow],
    });
  }

  async setMarketAdlTriggerThreshold(marketName: string, threshold: number) {
    const marketAddr = getMarketAddr(marketName, this.config.deployment.perpEngineGlobal);
    return await this.sendTx({
      function: `${this.config.deployment.package}::admin_apis::set_market_adl_trigger_threshold`,
      typeArguments: [],
      functionArguments: [marketAddr, threshold],
    });
  }

  /**
   * Get the balance of USDC for an account
   * @param addr The account address to get the balance for
   * @returns The balance of USDC for the account
   */
  async usdcBalance(addr: AccountAddress) {
    const balance = await this.aptos.view<[number]>({
      payload: {
        function: `0x1::primary_fungible_store::balance`,
        typeArguments: [`0x1::fungible_asset::Metadata`],
        functionArguments: [addr, this.config.deployment.usdc],
      },
    });
    return balance[0];
  }
}
