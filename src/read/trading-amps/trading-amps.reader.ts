import { BaseReader } from "../base-reader";
import { OwnerTradingAmpsRequestArgs, OwnerTradingAmpsSchema } from "./trading-amps.types";

export class TradingAmpsReader extends BaseReader {
  /**
   * Get aggregated trading Hz (Amps) for an owner across all their active subaccounts
   * @param ownerAddr The owner address to get trading Hz for
   * @returns The aggregated trading Hz with per-subaccount breakdown
   */
  async getByOwner({ ownerAddr, season, days, fetchOptions }: OwnerTradingAmpsRequestArgs) {
    const queryParams = new URLSearchParams({ owner: ownerAddr });
    if (season) queryParams.set("season", season);
    if (days) queryParams.set("days", days.toString());

    const response = await this.getRequest({
      schema: OwnerTradingAmpsSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/points/trading/amps`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }
}
