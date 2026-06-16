import { BaseReader } from "../base-reader";
import {
  MaxSynchronousRedemptionRequestArgs,
  PublicVaultsRequestArgs,
  UserOwnedVaultsRequestArgs,
  UserOwnedVaultsResponseSchema,
  UserPerformancesOnVaultsRequestArgs,
  UserPerformancesOnVaultsResponseSchema,
  VaultNetAssetValueRequestArgs,
  VaultNumSharesRequestArgs,
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
    if (args.sortKey) queryParams.set("sort_key", args.sortKey);
    if (args.sortDir) queryParams.set("sort_dir", args.sortDir);

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
      account: args.ownerAddr,
    });

    if (args.limit) queryParams.set("limit", args.limit.toString());

    if (args.offset) queryParams.set("offset", args.offset.toString());

    const response = await this.getRequest({
      schema: UserOwnedVaultsResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/account_owned_vaults`,
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
      account: args.ownerAddr,
    });

    const response = await this.getRequest({
      schema: UserPerformancesOnVaultsResponseSchema,
      url: `${this.deps.config.tradingHttpUrl}/api/v1/account_vault_performance`,
      queryParams,
      options: fetchOptions,
    });

    return response.data;
  }

  /**
   * Get the vault's net asset value (NAV) in raw chain units.
   *
   * Wraps the on-chain `vault::get_vault_net_asset_value` view function. NAV is
   * denominated in the protocol's primary collateral asset (USDC); divide the
   * return value by `10 ** USDC_DECIMALS` for human-readable units.
   *
   * @param args The arguments containing the vault address
   * @returns The vault NAV as raw u64 chain units
   */
  async getVaultNetAssetValue({ vaultAddress }: VaultNetAssetValueRequestArgs) {
    const [result] = await this.deps.aptos.view<[string]>({
      payload: {
        function: `${this.deps.config.deployment.package}::vault::get_vault_net_asset_value`,
        typeArguments: [],
        functionArguments: [vaultAddress],
      },
    });

    return Number(BigInt(result));
  }

  /**
   * Get the total number of shares outstanding for the vault, in raw chain units.
   *
   * Wraps the on-chain `vault::get_vault_num_shares` view function. Vault shares
   * are minted at the same precision as the contribution asset (USDC); divide the
   * return value by `10 ** USDC_DECIMALS` for human-readable units.
   *
   * @param args The arguments containing the vault address
   * @returns The total number of shares outstanding as raw u64 chain units
   */
  async getVaultNumShares({ vaultAddress }: VaultNumSharesRequestArgs) {
    const [result] = await this.deps.aptos.view<[string]>({
      payload: {
        function: `${this.deps.config.deployment.package}::vault::get_vault_num_shares`,
        typeArguments: [],
        functionArguments: [vaultAddress],
      },
    });

    return Number(BigInt(result));
  }

  /**
   * Get vault share price by calculating NAV / num_shares.
   *
   * Returns 1 when the vault has zero shares outstanding (no depositors yet).
   * Both NAV and num_shares share the same precision so the ratio is unitless
   * and requires no decimal normalization.
   *
   * @param args The arguments containing the vault address
   * @returns The share price of the vault
   */
  async getVaultSharePrice({ vaultAddress }: VaultSharePriceRequestArgs) {
    const [nav, numShares] = await Promise.all([
      this.getVaultNetAssetValue({ vaultAddress }),
      this.getVaultNumShares({ vaultAddress }),
    ]);

    if (numShares === 0) {
      return 1;
    }

    return nav / numShares;
  }

  /**
   * Get the maximum amount that can be synchronously (instantly) redeemed from a vault.
   * Returns 0 if async redemptions are pending (sync not allowed).
   * @param args The arguments containing the vault address
   * @returns The max instant redemption amount in USDC (converted from chain units)
   */
  async getMaxSynchronousRedemption({ vaultAddress }: MaxSynchronousRedemptionRequestArgs) {
    const [result] = await this.deps.aptos.view<[string]>({
      payload: {
        function: `${this.deps.config.deployment.package}::vault_api::get_max_synchronous_redemption`,
        typeArguments: [],
        functionArguments: [vaultAddress],
      },
    });

    return Number(BigInt(result)) / 1e6;
  }
}
