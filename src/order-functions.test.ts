import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import mainnetAbis from "./abi/json/mainnet.json";
import testnetAbis from "./abi/json/testnet.json";
import { MAINNET_CONFIG, TESTNET_CONFIG } from "./constants";
import { classifyTxKind, ORDER_FUNCTION_KINDS } from "./order-functions";

const MOVE_ENTRY_MODULES = {
  dex_accounts_entry: "move/accounts/sources/dex_accounts_entry.move",
  dex_accounts_spot_entry: "move/accounts/sources/dex_accounts_spot_entry.move",
} as const;

/**
 * Order entry functions deliberately left out of `ORDER_FUNCTION_KINDS`: the SDK
 * never sends them through the encrypted subaccount path. Moving one into the map
 * means routing it through `submitSubaccountTx` too (enforced in write.test.ts).
 */
const UNROUTED_ORDER_FUNCTIONS: Readonly<Record<string, string>> = {
  "dex_accounts_entry::place_bulk_orders_to_subaccount": "not called by the SDK",
  "dex_accounts_entry::place_bulk_orders_to_subaccount_with_repricing": "not called by the SDK",
  "dex_accounts_entry::place_market_order_to_subaccount": "not called by the SDK",
  "dex_accounts_entry::place_twap_order_to_subaccount": "superseded by _v2",
  "dex_accounts_entry::update_client_order_to_subaccount": "not called by the SDK",
  "dex_accounts_entry::update_tp_order_for_position_v2": "not deployed yet",
  "dex_accounts_entry::update_sl_order_for_position_v2": "not deployed yet",
  "dex_accounts_spot_entry::place_spot_order_to_subaccount_v2": "not deployed yet",
  "dex_accounts_spot_entry::cancel_spot_client_order_to_subaccount": "not deployed yet",
  "dex_accounts_spot_entry::place_spot_twap_order_to_subaccount": "not deployed yet",
  "dex_accounts_spot_entry::cancel_spot_twap_order_to_subaccount": "not deployed yet",
  "dex_accounts_spot_entry::place_spot_order": "wallet-direct, no subaccount",
  "dex_accounts_spot_entry::place_spot_order_v2": "wallet-direct, no subaccount",
  "dex_accounts_spot_entry::cancel_spot_order": "wallet-direct, no subaccount",
  "dex_accounts_spot_entry::cancel_spot_client_order": "wallet-direct, no subaccount",
  "dex_accounts_spot_entry::place_spot_twap_order": "wallet-direct, no subaccount",
  "dex_accounts_spot_entry::cancel_spot_twap_order": "wallet-direct, no subaccount",
  "dex_accounts_spot_entry::place_spot_bulk_order": "wallet-direct, no subaccount",
  "dex_accounts_spot_entry::cancel_spot_bulk_order": "wallet-direct, no subaccount",
  "dex_accounts_spot_entry::cancel_spot_bulk_order_at_price_level": "wallet-direct, no subaccount",
};

function moveOrderEntryFunctions(): string[] {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  return Object.entries(MOVE_ENTRY_MODULES).flatMap(([module, file]) =>
    [
      ...readFileSync(resolve(repoRoot, file), "utf8").matchAll(
        /\bentry fun ((?:place|update|cancel)_\w+)/g,
      ),
    ].map((m) => `${module}::${m[1]}`),
  );
}

describe("ORDER_FUNCTION_KINDS drift", () => {
  const onChain = moveOrderEntryFunctions();

  it("finds order entry functions in the Move source", () => {
    expect(onChain.length).toBeGreaterThan(Object.keys(ORDER_FUNCTION_KINDS).length);
  });

  it("only maps functions that exist in the Move source", () => {
    const known = new Set(onChain);
    for (const fn of [
      ...Object.keys(ORDER_FUNCTION_KINDS),
      ...Object.keys(UNROUTED_ORDER_FUNCTIONS),
    ]) {
      expect(known.has(fn), `${fn} is not an entry function in Move`).toBe(true);
    }
  });

  it("classifies every Move order entry function", () => {
    const unclassified = onChain.filter(
      (fn) => !(fn in ORDER_FUNCTION_KINDS) && !(fn in UNROUTED_ORDER_FUNCTIONS),
    );
    expect(unclassified, "add to ORDER_FUNCTION_KINDS or UNROUTED_ORDER_FUNCTIONS").toEqual([]);
  });

  it.each([
    ["testnet", testnetAbis],
    ["mainnet", mainnetAbis],
  ])("maps only functions deployed on %s", (_, { packageAddress, abis }) => {
    const deployed: Record<string, { is_entry?: boolean } | undefined> = abis;
    for (const fn of Object.keys(ORDER_FUNCTION_KINDS)) {
      expect(deployed[`${packageAddress}::${fn}`]?.is_entry, fn).toBe(true);
    }
  });
});

describe("classifyTxKind", () => {
  const packages = [TESTNET_CONFIG.deployment.package, MAINNET_CONFIG.deployment.package];

  it.each(packages)("classifies every order function on %s", (pkg) => {
    for (const [fn, kind] of Object.entries(ORDER_FUNCTION_KINDS)) {
      expect(classifyTxKind(`${pkg}::${fn}`), fn).toBe(kind);
    }
  });

  it.each([
    "0x1::dex_accounts_entry::deposit_to_subaccount_at",
    "0x1::other_module::place_order_to_subaccount",
    "place_order_to_subaccount",
    "dex_accounts_entry::place_order_to_subaccount",
    "",
    undefined,
  ])("classifies %j as other", (fn) => {
    expect(classifyTxKind(fn)).toBe("other");
  });
});
