import z from "zod/v4";

import { UINT_STRING_PATTERN } from "../../u64";

/** Unsigned decimal integer string: amounts, shares, timestamps and rays (1e27 exceeds u64). Parsed with `BigInt` downstream, so malformed values must fail here. */
export const uintString = z.string().regex(UINT_STRING_PATTERN);

/** Signed decimal integer string, for deltas such as activity shares (negative on redemption). */
export const intString = z.string().regex(/^-?\d+$/);

/** Basis points: a non-negative integer. */
export const bps = z.number().int().min(0);

/** Token decimals: a u8. */
export const decimals = z.number().int().min(0).max(255);

/** `null` means no borrower record; the chain default (true) applies. Drop `.nullable()` once every deployed trading-api sends a boolean. */
export const rescueEnabled = z
  .boolean()
  .nullable()
  .transform((v) => v ?? true);
