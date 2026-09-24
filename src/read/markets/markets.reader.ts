import { stringStructTag, TypeTagAddress, TypeTagStruct, TypeTagVector } from "@aptos-labs/ts-sdk";

import { addressComparisonKey, getMarketAddr } from "../../utils";
import { BaseReader, BaseRequestArgs } from "../base-reader";
import {
  isSpotMarket,
  Market,
  PerpMarket,
  PerpMarketConfig,
  PerpMarketConfigSchema,
  PerpMarketsSchema,
  SpotMarket,
} from "./markets.types";

export interface MarketsGetAllArgs extends BaseRequestArgs {
  /** Include spot markets in the result (default false = perp only). */
  includeSpot?: boolean;
}

export class MarketsReader extends BaseReader {
  private static readonly stringTypeTag = new TypeTagStruct(stringStructTag());
  private static readonly listMarketAddressesAbi = {
    typeParameters: [],
    parameters: [],
    returnTypes: [new TypeTagVector(MarketsReader.stringTypeTag)],
  };

  private static readonly marketNameByAddressAbi = {
    typeParameters: [],
    parameters: [new TypeTagAddress()],
    returnTypes: [MarketsReader.stringTypeTag],
  };

  /**
   * Get all of the available markets.
   *
   * `/api/v1/markets` returns perp and spot rows in one list, discriminated
   * by `asset_type`. Spot rows are filtered out by default so existing perp
   * consumers don't see spot markets masquerading as 0-leverage perps; pass
   * `includeSpot: true` to get the full list and demux with `isSpotMarket` /
   * `isPerpMarket` (or on `asset_type` directly).
   * @returns The list of available markets
   */
  async getAll(args?: BaseRequestArgs & { includeSpot?: false }): Promise<PerpMarket[]>;
  // `boolean` (not just `true`) so dynamic-flag callers (e.g. a UI toggle)
  // match an overload; the union return is honest since the result may
  // contain spot rows. Literal `false`/omitted still hits the first overload
  // and keeps the narrow PerpMarket[] type.
  async getAll(args: BaseRequestArgs & { includeSpot: boolean }): Promise<Market[]>;
  // Widening fallback so pre-spot call shapes still compile: an argument
  // typed as MarketsGetAllArgs (includeSpot?: boolean, possibly undefined)
  // matches neither overload above. Union return is the honest supertype.
  async getAll(args?: MarketsGetAllArgs): Promise<Market[]>;
  async getAll({ includeSpot = false, fetchOptions }: MarketsGetAllArgs = {}): Promise<
    PerpMarket[]
  > {
    const response = await this.getRequest({
      schema: PerpMarketsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/markets`,
      options: fetchOptions,
    });

    // TODO: Remove once API is fixed and doesn't return duplicate markets
    const seen = new Set<string>();
    const uniqueMarkets = response.data.filter((market) => {
      if (!includeSpot && market.asset_type === "spot") {
        return false;
      }
      const key = addressComparisonKey(market.market_addr);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    // The overload signatures carry the includeSpot-dependent row type.
    return uniqueMarkets as PerpMarket[];
  }

  /**
   * Get all of the available spot markets. Client-side filter of `/markets`
   * (the endpoint has no server-side product filter).
   * @returns The list of available spot markets
   */
  async getAllSpot(args: BaseRequestArgs = {}): Promise<SpotMarket[]> {
    const markets = await this.getAll({ ...args, includeSpot: true });
    return markets.filter(isSpotMarket);
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
        abi: MarketsReader.listMarketAddressesAbi,
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
        abi: MarketsReader.marketNameByAddressAbi,
      },
    });
    return name[0];
  }
}
