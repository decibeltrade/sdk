import { AccountAddress } from "@aptos-labs/ts-sdk";

/**
 * Comparison key for an address that may arrive in either form. Aptos JSON-RPC
 * trims leading zero bytes, so an address read off an event and the same address
 * derived locally disagree textually. Accepts any short form; unparseable input
 * falls back to case-folding so callers get a key rather than an exception.
 */
export function addressComparisonKey(address: AccountAddress | string): string {
  try {
    if (typeof address !== "string") return address.toString();
    return AccountAddress.from(address, { maxMissingChars: 63 }).toString();
  } catch {
    return String(address).toLowerCase();
  }
}

/** Equality for two addresses that may disagree on zero-padding or case. */
export function addressesEqual(a: AccountAddress | string, b: AccountAddress | string): boolean {
  return addressComparisonKey(a) === addressComparisonKey(b);
}
