import { describe, expect, it } from "vitest";

import {
  calculateLiquidationPrice,
  type LiquidationPriceInput,
} from "../../src/calculations/liquidation-price";

/** Helper to build a minimal valid input for a single-market scenario. */
function makeInput(overrides: Partial<LiquidationPriceInput> = {}): LiquidationPriceInput {
  return {
    accountEquity: 100,
    positions: [],
    markets: [{ marketAddr: "0xBTC", marketName: "BTC/USD", maxLeverage: 10 }],
    marketContexts: [{ marketName: "BTC/USD", markPrice: 100 }],
    targetMarketAddr: "0xBTC",
    orderSize: 1,
    executionPrice: 100,
    ...overrides,
  };
}

describe("calculateLiquidationPrice", () => {
  // --- Basic long/short ---

  it("returns liquidation price below mark price for a long position", () => {
    // equity=50, orderSize=5, mark=100, maxLev=10 → MM=25, buffer=25
    // leverageFactor=0.95, priceBuffer=floor(25/(5*0.95)*1e6)/1e6=5.263157
    // liq=100-5.263157=94.736843
    const result = calculateLiquidationPrice(makeInput({ accountEquity: 50, orderSize: 5 }));
    expect(result).toBeCloseTo(94.736843, 5);
  });

  it("returns liquidation price above mark price for a short position", () => {
    // equity=100, orderSize=-1, mark=100, maxLev=10 → MM=5, buffer=95
    // leverageFactor=1.05, priceBuffer=floor(95/(1*1.05)*1e6)/1e6=90.47619
    // liq=100+90.47619=190.47619
    const result = calculateLiquidationPrice(makeInput({ orderSize: -1 }));
    expect(result).toBeCloseTo(190.47619, 4);
  });

  it("resolves the target market when addresses differ only in zero-padding", () => {
    const result = calculateLiquidationPrice(
      makeInput({
        accountEquity: 50,
        markets: [{ marketAddr: "0xab", marketName: "BTC/USD", maxLeverage: 10 }],
        positions: [{ marketAddr: "0xab", size: 1, entryPrice: 100 }],
        targetMarketAddr: `0x${"ab".padStart(64, "0")}`,
        orderSize: 0,
      }),
    );
    expect(result).toBeCloseTo(52.631579, 5);
  });

  // --- Boundary conditions ---

  it("returns markPrice when margin buffer is zero (equity equals maintenance margin)", () => {
    // equity = 5, position size 1 at price 100, maxLev 10
    // MM = 1 * 100 * (1 / (10*2)) = 5
    // margin_buffer = 5 - 5 = 0 => return markPrice
    const result = calculateLiquidationPrice(makeInput({ accountEquity: 5 }));
    expect(result).toBe(100);
  });

  it("returns markPrice when margin buffer is negative (already liquidatable)", () => {
    const result = calculateLiquidationPrice(makeInput({ accountEquity: 1 }));
    expect(result).toBe(100);
  });

  it("returns 0 when position would be near-zero after order", () => {
    // Existing +1 position, order of -1 closes it
    const result = calculateLiquidationPrice(
      makeInput({
        positions: [{ marketAddr: "0xBTC", size: 1, entryPrice: 100 }],
        orderSize: -1,
      }),
    );
    expect(result).toBe(0);
  });

  it("clamps liquidation price to 0 (never negative)", () => {
    // Huge equity relative to position => price buffer > mark price
    const result = calculateLiquidationPrice(makeInput({ accountEquity: 100000 }));
    expect(result).toBe(0);
  });

  // --- Direction flips ---

  it("uses execution price as entry for direction flip (long to short)", () => {
    // Existing +3 @95, order -8 @105 → net -5 (short), newEntry=105 (flip)
    // closedSize=3, realizedPnl=3*(105-95)*1=30
    // oldPnl=3*(100-95)=15, newPnl=-5*(100-105)=25
    // pnlDiff=30+25-15=40, equityAdj=100+40=140, MM=25, buffer=115
    // leverageFactor=1.05, priceBuffer=floor(115/(5*1.05)*1e6)/1e6=21.904761
    // liq=100+21.904761=121.904761
    const result = calculateLiquidationPrice(
      makeInput({
        positions: [{ marketAddr: "0xBTC", size: 3, entryPrice: 95 }],
        orderSize: -8,
        executionPrice: 105,
      }),
    );
    expect(result).toBeCloseTo(121.904761, 5);
  });

  it("uses execution price as entry for direction flip (short to long)", () => {
    // Existing -3 @105, order +8 @95 → net +5 (long), newEntry=95 (flip)
    // closedSize=3, realizedPnl=3*(95-105)*(-1)=30
    // oldPnl=-3*(100-105)=15, newPnl=5*(100-95)=25
    // pnlDiff=30+25-15=40, equityAdj=100+40=140, MM=25, buffer=115
    // leverageFactor=0.95, priceBuffer=floor(115/(5*0.95)*1e6)/1e6=24.210526
    // liq=100-24.210526=75.789474
    const result = calculateLiquidationPrice(
      makeInput({
        positions: [{ marketAddr: "0xBTC", size: -3, entryPrice: 105 }],
        orderSize: 8,
        executionPrice: 95,
      }),
    );
    expect(result).toBeCloseTo(75.789474, 5);
  });

  // --- Partial reduction ---

  it("keeps original entry price for partial reduction", () => {
    // Existing +10 @90, order -3 @110 → net +7, entry stays 90 (not 110)
    // closedSize=3, realizedPnl=3*(110-90)*1=60
    // oldPnl=10*(100-90)=100, newPnl=7*(100-90)=70
    // pnlDiff=60+70-100=30, equityAdj=100+30=130, MM=35, buffer=95
    // leverageFactor=0.95, priceBuffer=floor(95/(7*0.95)*1e6)/1e6=14.285714
    // liq=100-14.285714=85.714286
    const result = calculateLiquidationPrice(
      makeInput({
        positions: [{ marketAddr: "0xBTC", size: 10, entryPrice: 90 }],
        orderSize: -3,
        executionPrice: 110,
      }),
    );
    expect(result).toBeCloseTo(85.714286, 5);
  });

  it("reduction at mark price is equity-neutral", () => {
    // Existing +10 @90, order -3 @100 (mark), equity=100
    // closedSize=3, realizedPnl=3*(100-90)*1=30
    // oldPnl=10*(100-90)=100, newPnl=7*(100-90)=70
    // pnlDiff=30+70-100=0, equityAdj=100 (unchanged)
    // This should match orderSize=0 on a +7 @90 position with equity=100
    const withOrder = calculateLiquidationPrice(
      makeInput({
        positions: [{ marketAddr: "0xBTC", size: 10, entryPrice: 90 }],
        orderSize: -3,
        executionPrice: 100,
      }),
    );
    const withoutOrder = calculateLiquidationPrice(
      makeInput({
        positions: [{ marketAddr: "0xBTC", size: 7, entryPrice: 90 }],
        orderSize: 0,
      }),
    );
    expect(withOrder).toBe(withoutOrder);
  });

  // --- Error cases ---

  it("throws when market is not found", () => {
    expect(() =>
      calculateLiquidationPrice(makeInput({ targetMarketAddr: "0xNONEXISTENT" })),
    ).toThrow("Market not found");
  });

  it("throws when market context is not found", () => {
    expect(() =>
      calculateLiquidationPrice(
        makeInput({
          marketContexts: [{ marketName: "ETH/USD", markPrice: 100 }],
        }),
      ),
    ).toThrow("Market context not found");
  });

  it("throws when no position exists and orderSize is 0", () => {
    expect(() => calculateLiquidationPrice(makeInput({ orderSize: 0 }))).toThrow(
      "No position found",
    );
  });

  // --- Multi-market ---

  it("accounts for other positions' maintenance margin in multi-market scenario", () => {
    // Use higher leverage (more notional relative to equity) so price buffer stays within mark
    const result = calculateLiquidationPrice({
      accountEquity: 60,
      positions: [{ marketAddr: "0xETH", size: 5, entryPrice: 50 }],
      markets: [
        { marketAddr: "0xBTC", marketName: "BTC/USD", maxLeverage: 10 },
        { marketAddr: "0xETH", marketName: "ETH/USD", maxLeverage: 20 },
      ],
      marketContexts: [
        { marketName: "BTC/USD", markPrice: 100 },
        { marketName: "ETH/USD", markPrice: 50 },
      ],
      targetMarketAddr: "0xBTC",
      orderSize: 5,
      executionPrice: 100,
    });

    // With two positions, ETH position's MM reduces margin buffer
    const singleMarket = calculateLiquidationPrice(
      makeInput({
        accountEquity: 60,
        orderSize: 5,
      }),
    );

    // Multi-market should have a different (closer to mark) liquidation price
    // because the ETH position's maintenance margin eats into the buffer
    expect(result).not.toBe(singleMarket);
    expect(result).toBeLessThan(100); // Still a long position
    expect(result).toBeGreaterThan(singleMarket); // Closer to mark due to less buffer
  });

  // --- VWAP entry price ---

  it("uses VWAP entry price when increasing position size", () => {
    // Existing +2 @90, buying +3 @110 → VWAP = (2*90+3*110)/5 = 102
    // oldPnl=2*(100-90)=20, newPnl=5*(100-102)=-10, pnlDiff=-30
    // equityAdj=200-30=170, MM=25, buffer=145
    // leverageFactor=0.95, priceBuffer=floor(145/(5*0.95)*1e6)/1e6=30.526315
    // liq=100-30.526315=69.473685
    const result = calculateLiquidationPrice(
      makeInput({
        accountEquity: 200,
        positions: [{ marketAddr: "0xBTC", size: 2, entryPrice: 90 }],
        orderSize: 3,
        executionPrice: 110,
      }),
    );
    expect(result).toBeCloseTo(69.473685, 5);
  });

  // --- orderSize 0 with existing position ---

  it("calculates current liquidation price when orderSize is 0 with existing position", () => {
    // No order simulation — just existing +5 @100, mark=100, equity=100
    // MM=25, buffer=75, leverageFactor=0.95
    // priceBuffer=floor(75/(5*0.95)*1e6)/1e6=15.789473
    // liq=100-15.789473=84.210527
    const result = calculateLiquidationPrice(
      makeInput({
        positions: [{ marketAddr: "0xBTC", size: 5, entryPrice: 100 }],
        orderSize: 0,
      }),
    );
    expect(result).toBeCloseTo(84.210527, 5);
  });

  // --- Precision ---

  it("applies floor truncation to 6 decimal places", () => {
    const result = calculateLiquidationPrice(makeInput({ accountEquity: 50 }));
    const decimalPart = result.toString().split(".")[1] || "";
    expect(decimalPart.length).toBeLessThanOrEqual(6);
  });

  // --- Formula verification ---

  it("matches expected formula for single long position", () => {
    // accountEquity=100, orderSize=5, markPrice=50, maxLev=10, executionPrice=50
    // MM = 5 * 50 * (1/(10*2)) = 12.5
    // marginBuffer = 100 - 12.5 = 87.5
    // mmrRatio = 1/(10*2) = 0.05
    // leverageFactor = 1 - 0.05 = 0.95 (long)
    // priceBuffer = floor(87.5 / (5 * 0.95) * 1e6) / 1e6
    //            = floor(18.421052... * 1e6) / 1e6
    //            = 18421052 / 1e6 = 18.421052
    // liq = 50 - 18.421052 = 31.578948
    const result = calculateLiquidationPrice(
      makeInput({
        accountEquity: 100,
        markets: [{ marketAddr: "0xBTC", marketName: "BTC/USD", maxLeverage: 10 }],
        marketContexts: [{ marketName: "BTC/USD", markPrice: 50 }],
        orderSize: 5,
        executionPrice: 50,
      }),
    );
    expect(result).toBeCloseTo(31.578948, 5);
  });

  it("matches expected formula for single short position", () => {
    // accountEquity=100, orderSize=-5, markPrice=50, maxLev=10, executionPrice=50
    // MM = 5 * 50 * (1/(10*2)) = 12.5
    // marginBuffer = 100 - 12.5 = 87.5
    // mmrRatio = 0.05
    // leverageFactor = 1 + 0.05 = 1.05 (short)
    // priceBuffer = floor(87.5 / (5 * 1.05) * 1e6) / 1e6
    //            = floor(16.666666... * 1e6) / 1e6
    //            = 16666666 / 1e6 = 16.666666
    // liq = 50 + 16.666666 = 66.666666
    const result = calculateLiquidationPrice(
      makeInput({
        accountEquity: 100,
        markets: [{ marketAddr: "0xBTC", marketName: "BTC/USD", maxLeverage: 10 }],
        marketContexts: [{ marketName: "BTC/USD", markPrice: 50 }],
        orderSize: -5,
        executionPrice: 50,
      }),
    );
    expect(result).toBeCloseTo(66.666666, 5);
  });

  // --- Underwater / negative PnL ---

  it("handles underwater long (negative uPnL reduces margin buffer)", () => {
    // Existing +5 @101, mark=90, order +2 @90 → VWAP=(5*101+2*90)/7=97.857142...
    // oldPnl=5*(90-101)=-55, newPnl=7*(90-97.857142...)=-55, pnlDiff=0
    // equityAdj=45, MM=7*90*(1/20)=31.5, buffer=13.5
    // leverageFactor=0.95, priceBuffer=floor(13.5/(7*0.95)*1e6)/1e6=2.030075
    // liq=90-2.030075=87.969925
    const result = calculateLiquidationPrice(
      makeInput({
        accountEquity: 45,
        positions: [{ marketAddr: "0xBTC", size: 5, entryPrice: 101 }],
        marketContexts: [{ marketName: "BTC/USD", markPrice: 90 }],
        orderSize: 2,
        executionPrice: 90,
      }),
    );
    expect(result).toBeCloseTo(87.969925, 5);
  });

  it("handles underwater short (negative uPnL reduces margin buffer)", () => {
    // Existing -5 @99, mark=110, order -2 @110 → VWAP=(-5*99+-2*110)/-7=102.142857...
    // oldPnl=-5*(110-99)=-55, newPnl=-7*(110-102.142857...)=-55, pnlDiff=0
    // equityAdj=45, MM=7*110*(1/20)=38.5, buffer=6.5
    // leverageFactor=1.05, priceBuffer=floor(6.5/(7*1.05)*1e6)/1e6=0.884353
    // liq=110+0.884353=110.884353
    const result = calculateLiquidationPrice(
      makeInput({
        accountEquity: 45,
        positions: [{ marketAddr: "0xBTC", size: -5, entryPrice: 99 }],
        marketContexts: [{ marketName: "BTC/USD", markPrice: 110 }],
        orderSize: -2,
        executionPrice: 110,
      }),
    );
    expect(result).toBeCloseTo(110.884353, 5);
  });

  // --- Dust positions ---

  it("handles dust-sized position without precision issues", () => {
    // equity=1000, size=0.001 → huge buffer relative to tiny position
    // priceBuffer >> markPrice → clamped to 0
    const result = calculateLiquidationPrice(
      makeInput({
        accountEquity: 1000,
        orderSize: 0.001,
        executionPrice: 100,
      }),
    );
    expect(result).toBe(0);
  });

  // --- Low leverage ---

  it("calculates wider margin buffer for low leverage (2x)", () => {
    // equity=300, size=5, mark=100, maxLev=2 → MM=5*100*(1/4)=125, buffer=175
    // mmrRatio=0.25, leverageFactor=1-0.25=0.75
    // priceBuffer=floor(175/(5*0.75)*1e6)/1e6=46.666666
    // liq=100-46.666666=53.333334
    const result = calculateLiquidationPrice(
      makeInput({
        accountEquity: 300,
        markets: [{ marketAddr: "0xBTC", marketName: "BTC/USD", maxLeverage: 2 }],
        orderSize: 5,
        executionPrice: 100,
      }),
    );
    expect(result).toBeCloseTo(53.333334, 5);
  });
});
