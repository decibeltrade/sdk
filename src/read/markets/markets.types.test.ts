import { describe, expect, it } from "vitest";

import { PerpMarketSchema } from "./markets.types";

const row = {
  asset_type: "perp",
  market_addr: "0xabc",
  market_name: "UNI/USD",
  sz_decimals: 8,
  px_decimals: 6,
  max_leverage: 10,
  tick_size: 100,
  min_size: 1_000_000,
  lot_size: 10_000,
  max_open_interest: 1_000_000,
  mode: "Open",
};

describe("PerpMarketSchema.category", () => {
  it.each(["crypto", "equity", "commodity"] as const)("keeps %s", (category) => {
    expect(PerpMarketSchema.parse({ ...row, category }).category).toBe(category);
  });

  it("is undefined when the API omits it", () => {
    expect(PerpMarketSchema.parse(row).category).toBeUndefined();
  });

  it("degrades an unknown value to undefined instead of rejecting the row", () => {
    const parsed = PerpMarketSchema.parse({ ...row, category: "forex" });
    expect(parsed.market_name).toBe("UNI/USD");
    expect(parsed.category).toBeUndefined();
  });
});
