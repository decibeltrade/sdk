import { describe, expect, it } from "vitest";

import { isUintString, toU64String, U64_MAX } from "./u64";

describe("toU64String", () => {
  it.each([
    ["string", U64_MAX.toString()],
    ["bigint", U64_MAX],
  ])("keeps a %s at u64::MAX exact", (_kind, value) => {
    expect(toU64String(value, "x")).toBe("18446744073709551615");
  });

  it("accepts the largest safe-integer number", () => {
    expect(toU64String(Number.MAX_SAFE_INTEGER, "x")).toBe("9007199254740991");
  });

  it.each([2 ** 53, 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects the number %s",
    (value) => {
      expect(() => toU64String(value, "x")).toThrow();
    },
  );

  it.each(["", "-1", "1.5", "1e3", "0x10", " 5 "])("rejects the string %j", (value) => {
    expect(() => toU64String(value, "x")).toThrow();
  });

  it.each([BigInt(-1), U64_MAX + BigInt(1)])("rejects the bigint %s", (value) => {
    expect(() => toU64String(value, "x")).toThrow();
  });

  it("accepts zero unless told otherwise", () => {
    expect(toU64String(0, "x")).toBe("0");
    expect(() => toU64String("0", "x", { allowZero: false })).toThrow();
  });
});

describe("toU64String string edge cases", () => {
  it("normalises leading zeros", () => {
    expect(toU64String("007", "x")).toBe("7");
    expect(toU64String("0000", "x")).toBe("0");
  });

  it.each(["١٢", "１２", "-0", "+7", " 7", "7 ", "7n"])("rejects %j", (value) => {
    expect(() => toU64String(value, "x")).toThrow("must be a non-negative integer string");
  });

  it("treats the number -0 as zero", () => {
    expect(toU64String(-0, "x")).toBe("0");
  });
});

describe("isUintString", () => {
  it.each(["0", "7", "18446744073709551616", "1000000000000000000000000000"])("accepts %j", (v) => {
    expect(isUintString(v)).toBe(true);
  });

  it.each(["", "-1", "1.5", "1e3", " 5 ", "0x10", 5, 5n, null, undefined])("rejects %s", (v) => {
    expect(isUintString(v)).toBe(false);
  });
});
