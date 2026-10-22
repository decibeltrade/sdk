import { describe, expect, it } from "vitest";

import type { PerpMarket } from "../markets/markets.types";
import { marketSettingsFromPosition } from "./market-settings";
import type { UserPosition } from "./user-positions.types";

const market: PerpMarket = {
  market_addr: "0xabc",
  market_name: "BTC/USD",
  sz_decimals: 8,
  px_decimals: 6,
  max_leverage: 40,
  tick_size: 100,
  min_size: 1_000_000,
  lot_size: 10_000,
  max_open_interest: 1_000_000,
  mode: "Open",
};

const position: UserPosition = {
  market: "0xabc",
  user: "0xuser",
  size: 0,
  user_leverage: 5,
  entry_price: 0,
  is_isolated: true,
  unrealized_funding: 0,
  estimated_liquidation_price: 0,
  tp_order_id: null,
  tp_trigger_price: null,
  tp_limit_price: null,
  sl_order_id: null,
  sl_trigger_price: null,
  sl_limit_price: null,
  has_fixed_sized_tpsls: false,
  transaction_version: 1,
};

describe("marketSettingsFromPosition", () => {
  it("reads mode and leverage off the row, even a closed one", () => {
    expect(marketSettingsFromPosition(position, market)).toEqual({
      isCross: false,
      userLeverage: 5,
    });
    expect(
      marketSettingsFromPosition({ ...position, is_isolated: false, user_leverage: 12 }, market),
    ).toEqual({ isCross: true, userLeverage: 12 });
  });

  it("falls back to cross at the market max with no row", () => {
    expect(marketSettingsFromPosition(undefined, market)).toEqual({
      isCross: true,
      userLeverage: 40,
    });
    expect(marketSettingsFromPosition(undefined, { ...market, is_isolated_only: false })).toEqual({
      isCross: true,
      userLeverage: 40,
    });
  });

  it("falls back to isolated on an isolated-only market with no row", () => {
    expect(marketSettingsFromPosition(undefined, { ...market, is_isolated_only: true })).toEqual({
      isCross: false,
      userLeverage: 40,
    });
  });
});
