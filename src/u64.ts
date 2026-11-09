export const U64_MAX = BigInt(2) ** BigInt(64) - BigInt(1);

/** A u64 amount in raw base units. Use `string` or `bigint` above `Number.MAX_SAFE_INTEGER`. */
export type U64Input = string | bigint | number;

export const UINT_STRING_PATTERN = /^\d+$/;

/** True for an unsigned decimal integer string of any length; u64 range is not checked. */
export function isUintString(value: unknown): value is string {
  return typeof value === "string" && UINT_STRING_PATTERN.test(value);
}

/**
 * Validates a u64 and returns it as a decimal string, which is exact for any u64 and survives
 * wallets that JSON-serialise the payload (a bigint does not). Numbers must be safe integers:
 * past 2^53 they have already lost precision, so they are rejected rather than sent.
 */
export function toU64String(
  value: U64Input,
  label: string,
  { allowZero = true }: { allowZero?: boolean } = {},
): string {
  let parsed: bigint;
  if (typeof value === "bigint") {
    parsed = value;
  } else if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${label} must be a safe integer; pass a string or bigint above 2^53`);
    }
    parsed = BigInt(value);
  } else {
    if (!isUintString(value)) {
      throw new Error(`${label} must be a non-negative integer string`);
    }
    parsed = BigInt(value);
  }
  if (parsed < BigInt(0)) throw new Error(`${label} must be non-negative`);
  if (!allowZero && parsed === BigInt(0)) throw new Error(`${label} must be greater than zero`);
  if (parsed > U64_MAX) throw new Error(`${label} exceeds u64::MAX`);
  return parsed.toString();
}
