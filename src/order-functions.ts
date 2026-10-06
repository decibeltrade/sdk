export type TxKind = "order_place" | "order_modify" | "order_cancel" | "other";

/** Why an encryption-requested transaction was submitted plaintext. */
export type EncryptionFallbackReason =
  | "node_unsupported"
  | "probe_failed"
  | "gas_station_unconfigured";

/**
 * Order entry functions keyed by `module::function` (package address omitted so
 * the map holds on every network). These are exactly the writes routed through
 * the encrypted path.
 */
export const ORDER_FUNCTION_KINDS: Readonly<Record<string, Exclude<TxKind, "other">>> = {
  "dex_accounts_entry::place_order_to_subaccount": "order_place",
  "dex_accounts_entry::place_twap_order_to_subaccount_v2": "order_place",
  "dex_accounts_entry::place_tp_sl_order_for_position": "order_place",
  "dex_accounts_spot_entry::place_spot_order_to_subaccount": "order_place",
  "dex_accounts_spot_entry::place_spot_bulk_order_to_subaccount": "order_place",
  "dex_accounts_entry::update_order_to_subaccount": "order_modify",
  "dex_accounts_entry::update_tp_order_for_position": "order_modify",
  "dex_accounts_entry::update_sl_order_for_position": "order_modify",
  "dex_accounts_entry::cancel_order_to_subaccount": "order_cancel",
  "dex_accounts_entry::cancel_client_order_to_subaccount": "order_cancel",
  "dex_accounts_entry::cancel_bulk_order_to_subaccount": "order_cancel",
  "dex_accounts_entry::cancel_twap_orders_to_subaccount": "order_cancel",
  "dex_accounts_entry::cancel_tp_sl_order_for_position": "order_cancel",
  "dex_accounts_spot_entry::cancel_spot_order_to_subaccount": "order_cancel",
  "dex_accounts_spot_entry::cancel_spot_bulk_order_to_subaccount": "order_cancel",
  "dex_accounts_spot_entry::cancel_spot_bulk_order_at_price_level_to_subaccount": "order_cancel",
};

export function classifyTxKind(functionId: string | undefined): TxKind {
  const parts = functionId?.split("::") ?? [];
  if (parts.length !== 3) return "other";
  return ORDER_FUNCTION_KINDS[`${parts[1]}::${parts[2]}`] ?? "other";
}
