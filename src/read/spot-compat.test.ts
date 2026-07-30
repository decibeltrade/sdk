import { describe, expect, it } from "vitest";

import { PerpMarketSchema } from "./markets/markets.types";
import { UserOpenOrderSchema } from "./user-open-orders/user-open-orders.types";
import { UserTradeSchema } from "./user-trade-history/user-trade-history.types";

// Rows the trading API emits once spot ships: same endpoints, per-row
// asset_type discriminator. These pin that (1) spot rows parse instead of
// throwing (a ZodError on a WS topic kills the subscription), and (2) the
// discriminator survives parsing (z.object strips undeclared keys, so a
// missing schema field would silently hide it from consumers).

const spotMarketRow = {
  asset_type: "spot",
  market_addr: "0xabc",
  market_name: "APT/USDC",
  sz_decimals: 8,
  px_decimals: 6,
  max_leverage: 0,
  tick_size: 100,
  min_size: 1_000_000_000,
  lot_size: 10_000_000,
  max_open_interest: 0,
  mode: "Open",
};

const spotTradeRow = {
  asset_type: "spot",
  account: "0xdef",
  market: "0xabc",
  action: "Buy",
  source: "OrderFill",
  trade_id: "1",
  size: 100,
  price: 5,
  is_profit: false,
  realized_pnl_amount: 0,
  realized_funding_amount: 0,
  is_rebate: false,
  fee_amount: 0,
  order_id: "42",
  transaction_unix_ms: 1_700_000_000_000,
  transaction_version: 10,
};

describe("spot compatibility", () => {
  it("parses a spot market row and keeps the discriminator", () => {
    const parsed = PerpMarketSchema.parse(spotMarketRow);
    expect(parsed.asset_type).toBe("spot");
  });

  it("parses a perp market row without asset_type (pre-spot API)", () => {
    const preSpotRow = { ...spotMarketRow, asset_type: undefined };
    const parsed = PerpMarketSchema.parse(preSpotRow);
    expect(parsed.asset_type).toBeUndefined();
  });

  it.each(["Buy", "Sell"])("parses a spot user trade with action=%s", (action) => {
    const parsed = UserTradeSchema.parse({ ...spotTradeRow, action });
    expect(parsed.action).toBe(action);
    expect(parsed.asset_type).toBe("spot");
  });

  it("still rejects unknown trade actions", () => {
    expect(() => UserTradeSchema.parse({ ...spotTradeRow, action: "Hold" })).toThrow();
  });

  it("keeps fee_asset on spot trades and tolerates its absence on perp", () => {
    const spot = UserTradeSchema.parse({
      ...spotTradeRow,
      fee_amount: 0.01,
      fee_asset: "0xbase",
    });
    expect(spot.fee_asset).toBe("0xbase");
    const perp = UserTradeSchema.parse({ ...spotTradeRow, action: "OpenLong" });
    expect(perp.fee_asset).toBeUndefined();
  });

  it("keeps asset_type and time_in_force on spot open orders", () => {
    const parsed = UserOpenOrderSchema.parse({
      asset_type: "spot",
      time_in_force: "GTC",
      parent: "",
      market: "0xabc",
      order_id: "42",
      client_order_id: null,
      orig_size: 100,
      remaining_size: 40,
      size_delta: 0,
      price: 5,
      is_buy: true,
      details: "",
      transaction_version: 10,
      unix_ms: 1_700_000_000_000,
      is_tpsl: false,
      tp_trigger_price: null,
      tp_limit_price: null,
      sl_trigger_price: null,
      sl_limit_price: null,
    });
    expect(parsed.asset_type).toBe("spot");
    expect(parsed.time_in_force).toBe("GTC");
  });
});
