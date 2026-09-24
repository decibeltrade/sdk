import { AccountAddress } from "@aptos-labs/ts-sdk";
import { describe, expect, it } from "vitest";

import { addressesEqual } from "./utils";

const LONG = "0x00000000000000000000000000000000000000000000000000000000000000ab";

describe("addressesEqual", () => {
  it("treats forms that differ only in zero-padding or case as equal", () => {
    expect(addressesEqual("0xab", LONG)).toBe(true);
    expect(addressesEqual("0xAB", LONG)).toBe(true);
  });

  it("distinguishes different addresses", () => {
    expect(addressesEqual("0xab", "0xac")).toBe(false);
  });

  it("compares an AccountAddress instance against a string", () => {
    expect(addressesEqual(AccountAddress.from(LONG), "0xab")).toBe(true);
    expect(addressesEqual("0xac", AccountAddress.from(LONG))).toBe(false);
  });
});
