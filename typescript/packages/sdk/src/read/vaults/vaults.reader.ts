import { BaseReader } from "../base-reader";
import {
  PublicVaultsRequestArgs,
  UserOwnedVaultsRequestArgs,
  UserOwnedVaultsResponseSchema,
  UserPerformancesOnVaultsRequestArgs,
  UserPerformancesOnVaultsResponseSchema,
  VaultsResponseSchema,
} from "./vaults.types";

export class VaultsReader extends BaseReader {
  /**
   * Get all vaults
   * @returns  All vaults
   */
  async getVaults({ fetchOptions, ...args }: PublicVaultsRequestArgs = {}) {
    const queryParams = new URLSearchParams();

    if (args.vaultType) queryParams.set("vault_type", args.vaultType);
    if (args.limit) queryParams.set("limit", args.limit.toString());
    if (args.offset) queryParams.set("offset", args.offset.toString());

    const response = await this.getRequest({
      schema: VaultsResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/vaults`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Get vaults by owner address
   * @param user The user address to filter vaults by
   * @returns The vaults for the given owner address
   */
  async getUserOwnedVaults({ fetchOptions, ...args }: UserOwnedVaultsRequestArgs) {
    const queryParams = new URLSearchParams({
      user: args.ownerAddr,
    });

    if (args.limit) queryParams.set("limit", args.limit.toString());

    if (args.offset) queryParams.set("offset", args.offset.toString());

    const response = await this.getRequest({
      schema: UserOwnedVaultsResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/user_owned_vaults`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Get user performance
   * @param args The arguments for the user performance
   * @returns The user performance
   */
  async getUserPerformancesOnVaults({
    fetchOptions,
    ...args
  }: UserPerformancesOnVaultsRequestArgs) {
    const queryParams = new URLSearchParams({
      user_address: args.ownerAddr,
    });

    const response = await this.getRequest({
      schema: UserPerformancesOnVaultsResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/user_vault_performance`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }
}
