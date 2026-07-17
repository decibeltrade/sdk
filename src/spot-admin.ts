import { BaseSDK } from "./base";

/**
 * Admin operations for the Spot DEX (`decibel_dex::spot_admin_apis`), separate
 * from perp's `DecibelAdminDex`. Entries require the deployer / owner of the
 * `@decibel_dex` code object.
 */
export class DecibelSpotAdminDex extends BaseSDK {
  /**
   * Bind the canonical USDC quote metadata. Required before {@link registerMarket}
   * (which aborts with `EUSDC_QUOTE_NOT_BOUND` otherwise). Idempotent.
   */
  async setUsdcQuoteMetadata(usdcMetadataAddr: string) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::spot_admin_apis::set_usdc_quote_metadata`,
      typeArguments: [],
      functionArguments: [usdcMetadataAddr],
    });
  }

  /**
   * Register a base/quote spot market. `price` is raw quote units per whole base
   * unit; `size` is raw base units. On-chain requires
   * `(tickSize * lotSize) % 10^baseDecimals == 0` and `minSize % lotSize == 0`.
   */
  async registerMarket(
    name: string,
    baseAsset: string,
    quoteAsset: string,
    tickSize: number | bigint,
    lotSize: number | bigint,
    minSize: number | bigint,
    asyncMatchingEnabled: boolean,
    minPrice: number | bigint,
    maxPrice: number | bigint,
  ) {
    return await this.sendTx({
      function: `${this.config.deployment.package}::spot_admin_apis::register_market`,
      typeArguments: [],
      functionArguments: [
        name,
        baseAsset,
        quoteAsset,
        tickSize.toString(),
        lotSize.toString(),
        minSize.toString(),
        asyncMatchingEnabled,
        minPrice.toString(),
        maxPrice.toString(),
      ],
    });
  }

  /** Addresses of all registered spot markets. */
  async listMarketAddresses(): Promise<string[]> {
    const [addresses] = await this.aptos.view<[string[]]>({
      payload: {
        function: `${this.config.deployment.package}::spot_engine::list_markets`,
        typeArguments: [],
        functionArguments: [],
      },
    });
    return addresses;
  }
}
