import { BaseReader } from "../base-reader";
import {
  PublicVaultsRequestArgs,
  UserOwnedVaultsRequestArgs,
  UserOwnedVaultsResponseSchema,
  UserPerformancesOnVaultsRequestArgs,
  UserPerformancesOnVaultsResponseSchema,
  VaultSharePriceRequestArgs,
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
    if (args.address) queryParams.set("vault_address", args.address);
    if (args.search) queryParams.set("search", args.search);

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

  /**
   * Get vault share price by calculating NAV / num_shares
   * @param args The arguments containing the vault address
   * @returns The share price of the vault
   */
  async getVaultSharePrice({ ...args }: VaultSharePriceRequestArgs) {
    const [nav, numShares] = await Promise.all([
      this.deps.aptos.view<[string]>({
        payload: {
          function: `${this.deps.config.deployment.package}::vault::get_vault_net_asset_value`,
          typeArguments: [],
          functionArguments: [args.vaultAddress],
        },
      }),
      this.deps.aptos.view<[string]>({
        payload: {
          function: `${this.deps.config.deployment.package}::vault::get_vault_num_shares`,
          typeArguments: [],
          functionArguments: [args.vaultAddress],
        },
      }),
    ]);

    const navValue = BigInt(nav[0]);
    const sharesValue = BigInt(numShares[0]);

    if (Number(sharesValue) === 0) {
      return 1;
    }

    // Calculate share price: NAV / num_shares
    // Using BigInt for precision, then converting to number
    // Note: This may lose precision for very large numbers
    return Number(navValue) / Number(sharesValue);
  }
}
