import { getMarketAddr } from "../../utils";
import { BaseReader, BaseRequestArgs } from "../base-reader";
import { PerpMarketConfig, PerpMarketConfigSchema, PerpMarketsSchema } from "./markets.types";

export class MarketsReader extends BaseReader {
  /**
   * Get all of the available markets
   * @returns The list of available markets
   */
  async getAll({ fetchOptions }: BaseRequestArgs = {}) {
    const response = await this.getRequest({
      schema: PerpMarketsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/markets`,
      options: fetchOptions,
    });

    // TODO: Remove once API is fixed and doesn't return duplicate markets
    const seen = new Set<string>();
    const uniqueMarkets = response.data.filter((market) => {
      if (seen.has(market.market_addr)) {
        return false;
      }
      seen.add(market.market_addr);
      return true;
    });

    return uniqueMarkets;
  }

  /**
   * Get the market config for a given market name
   * @param marketName The name of the market to get
   * @returns The market config for the given name
   */
  async getByName(marketName: string): Promise<PerpMarketConfig | null> {
    const marketAddr = getMarketAddr(marketName, this.deps.config.deployment.perpEngineGlobal);
    try {
      // TODO: Fix lint error
      // eslint-disable-next-line custom/no-get-account-resource
      const market = await this.deps.aptos.getAccountResource<PerpMarketConfig>({
        accountAddress: marketAddr,
        resourceType: `${this.deps.config.deployment.package}::perp_market_config::PerpMarketConfig`,
      });
      // TODO: Handle different __variant__ values
      return PerpMarketConfigSchema.parse(market);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  /**
   * List all of the market addresses
   * @returns The list of market addresses
   */
  async listMarketAddresses() {
    const markets = await this.deps.aptos.view<[string[]]>({
      payload: {
        function: `${this.deps.config.deployment.package}::perp_engine::list_markets`,
        typeArguments: [],
        functionArguments: [],
      },
    });
    return markets[0];
  }

  /**
   * Get the name of a market by address
   * @param marketAddr The address of the market
   * @returns The name of the market
   */
  async marketNameByAddress(marketAddr: string) {
    const name = await this.deps.aptos.view<[string]>({
      payload: {
        function: `${this.deps.config.deployment.package}::perp_engine::market_name`,
        typeArguments: [],
        functionArguments: [marketAddr],
      },
    });
    return name[0];
  }
}
