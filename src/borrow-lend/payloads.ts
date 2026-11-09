import { InputEntryFunctionData } from "@aptos-labs/ts-sdk";

import { toU64String, U64Input } from "../u64";

// Builders reject zero: the UI never submits a zero amount.
const POSITIVE = { allowZero: false };

export interface BuildSupplyToLenderPoolPayloadArgs {
  /** Address the perp package is published at. */
  packageAddress: string;
  /** Base units of the pool's primary asset; the caller owns the decimals. */
  amount: U64Input;
}

/**
 * Supplies the primary asset from the signing wallet's own primary store. The signer is the
 * wallet, not a subaccount, so shares land in the wallet's store.
 */
export function buildSupplyToLenderPoolPayload({
  packageAddress,
  amount,
}: BuildSupplyToLenderPoolPayloadArgs): InputEntryFunctionData {
  return {
    function: `${packageAddress}::account_management_apis::supply_to_lender_pool`,
    typeArguments: [],
    functionArguments: [toU64String(amount, "amount", POSITIVE)],
  };
}

export interface BuildRedeemFromLenderPoolPayloadArgs {
  packageAddress: string;
  /** Account credited with the redeemed asset; must already have a perp account. */
  subaccountAddr: string;
  /** Raw share base units; shares are not a decimal-denominated asset. */
  shares: U64Input;
}

/**
 * Redeems dLEND shares held by the signer. The asset is credited to `subaccountAddr`'s cross
 * collateral, so `subaccountAddr` must already have a perp account or the transaction aborts.
 */
export function buildRedeemFromLenderPoolPayload({
  packageAddress,
  subaccountAddr,
  shares,
}: BuildRedeemFromLenderPoolPayloadArgs): InputEntryFunctionData {
  return {
    function: `${packageAddress}::account_management_apis::redeem_from_lender_pool_entry`,
    typeArguments: [],
    functionArguments: [subaccountAddr, toU64String(shares, "shares", POSITIVE)],
  };
}

export interface BuildRepayUsdcPayloadArgs {
  packageAddress: string;
  /** Subaccount whose debt is repaid, from its own cross margin. */
  subaccountAddr: string;
  /** Base units of the pool's primary asset; the contract clamps to the outstanding debt. */
  amount: U64Input;
}

/**
 * Same entry as `DecibelWriteDex.repayUsdc`. Spends the subaccount's cross margin, not the
 * wallet's primary store, so repaying from wallet balance needs a deposit first.
 */
export function buildRepayUsdcPayload({
  packageAddress,
  subaccountAddr,
  amount,
}: BuildRepayUsdcPayloadArgs): InputEntryFunctionData {
  return {
    function: `${packageAddress}::dex_accounts_entry::repay_usdc_from_subaccount`,
    typeArguments: [],
    functionArguments: [subaccountAddr, toU64String(amount, "amount", POSITIVE)],
  };
}

export interface BuildSetBorrowRescueEnabledPayloadArgs {
  packageAddress: string;
  /** The rescue flag is keyed on the position-holding subaccount; owner-only. */
  subaccountAddr: string;
  enabled: boolean;
}

/** Toggles the automatic borrow-lend rescue attempted on margin call (on by default). */
export function buildSetBorrowRescueEnabledPayload({
  packageAddress,
  subaccountAddr,
  enabled,
}: BuildSetBorrowRescueEnabledPayloadArgs): InputEntryFunctionData {
  return {
    function: `${packageAddress}::dex_accounts_entry::set_borrow_rescue_enabled_from_subaccount`,
    typeArguments: [],
    functionArguments: [subaccountAddr, enabled],
  };
}

export interface BuildDepositToSubaccountPayloadArgs {
  packageAddress: string;
  subaccountAddr: string;
  /** Registered borrow-lend assets are pledged as collateral. */
  assetAddr: string;
  /** Base units of `assetAddr`. */
  amount: U64Input;
}

export function buildDepositToSubaccountPayload({
  packageAddress,
  subaccountAddr,
  assetAddr,
  amount,
}: BuildDepositToSubaccountPayloadArgs): InputEntryFunctionData {
  return {
    function: `${packageAddress}::dex_accounts_entry::deposit_to_subaccount_at`,
    typeArguments: [],
    functionArguments: [subaccountAddr, assetAddr, toU64String(amount, "amount", POSITIVE)],
  };
}

export type BuildWithdrawFromCrossCollateralPayloadArgs = BuildDepositToSubaccountPayloadArgs;

export function buildWithdrawFromCrossCollateralPayload({
  packageAddress,
  subaccountAddr,
  assetAddr,
  amount,
}: BuildWithdrawFromCrossCollateralPayloadArgs): InputEntryFunctionData {
  return {
    function: `${packageAddress}::dex_accounts_entry::withdraw_from_cross_collateral`,
    typeArguments: [],
    functionArguments: [subaccountAddr, assetAddr, toU64String(amount, "amount", POSITIVE)],
  };
}
