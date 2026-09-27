/** Shares post-order liquidation estimates across trading forms and agent previews. */
import { addressComparisonKey } from "../address";
import { isolatedPositionEquity } from "./isolated-position-equity";
import { calculateLiquidationPrice, type LiquidationPriceInput } from "./liquidation-price";

export interface EstimateLiqPriceInput {
  isIsolated: boolean;
  targetMarketAddr: string;
  orderSize: number;
  executionPrice: number;
  /** Used only when an isolated order increases position size. */
  orderLeverage: number;
  markPrice: number;
  /** Haircutted account equity before subtracting isolated equity; cross mode only. */
  totalAccountEquity: number;

  /** The existing target position; consumed only in isolated mode. */
  targetPosition: {
    market: string;
    size: number;
    entryPrice: number;
    userLeverage: number;
    unrealizedFunding: number;
  } | null;

  /** Account positions and their own quotes; consumed only in cross mode. */
  positions: Array<{
    market: string;
    size: number;
    entryPrice: number;
    userLeverage: number;
    isIsolated: boolean;
    unrealizedFunding: number;
    markPrice: number | null;
  }>;

  markets: Array<{
    marketAddr: string;
    marketName: string;
    maxLeverage: number;
  }>;
}

/** Returns a positive price, zero for no liquidation price, or null for unavailable inputs. */
export function estimateLiqPrice(input: EstimateLiqPriceInput): number | null {
  try {
    const { isIsolated, orderSize, executionPrice, orderLeverage, markPrice, totalAccountEquity } =
      input;
    const targetMarketAddr = addressComparisonKey(input.targetMarketAddr);
    const markets = new Map<string, LiquidationPriceInput["markets"][number]>();
    const findMarket = (key: string) => {
      const cached = markets.get(key);
      if (cached) return cached;
      const match = input.markets.find((market) => addressComparisonKey(market.marketAddr) === key);
      if (!match) return undefined;
      const market = { ...match, marketAddr: key };
      markets.set(key, market);
      return market;
    };
    const targetMarket = findMarket(targetMarketAddr);
    if (!targetMarket) return null;
    const marketContexts = new Map([[targetMarket.marketName, markPrice]]);
    let accountEquity: number;
    let positions: LiquidationPriceInput["positions"];

    if (isIsolated) {
      const targetPosition = input.targetPosition;
      if (targetPosition && addressComparisonKey(targetPosition.market) !== targetMarketAddr)
        return null;
      accountEquity = targetPosition
        ? isolatedPositionEquity({
            size: targetPosition.size,
            entryPrice: targetPosition.entryPrice,
            userLeverage: targetPosition.userLeverage,
            markPrice,
            unrealizedFunding: targetPosition.unrealizedFunding,
          })
        : 0;

      const currentSize = targetPosition?.size ?? 0;
      const newSize = currentSize + orderSize;
      if (Math.abs(newSize) > Math.abs(currentSize) && orderLeverage > 0) {
        accountEquity += ((Math.abs(newSize) - Math.abs(currentSize)) * markPrice) / orderLeverage;
      }
      positions = targetPosition
        ? [
            {
              marketAddr: addressComparisonKey(targetPosition.market),
              size: targetPosition.size,
              entryPrice: targetPosition.entryPrice,
            },
          ]
        : [];
    } else {
      accountEquity = totalAccountEquity;
      positions = [];
      for (const position of input.positions) {
        if (position.size === 0) {
          if (position.isIsolated) accountEquity += position.unrealizedFunding;
          continue;
        }
        const marketAddr = addressComparisonKey(position.market);
        const positionMark = marketAddr === targetMarketAddr ? markPrice : position.markPrice;
        if (positionMark === null) return null;
        if (position.isIsolated) {
          accountEquity -= isolatedPositionEquity({ ...position, markPrice: positionMark });
        } else {
          const market = findMarket(marketAddr);
          if (!market) return null;
          positions.push({ marketAddr, size: position.size, entryPrice: position.entryPrice });
          marketContexts.set(market.marketName, positionMark);
        }
      }
    }

    const result = calculateLiquidationPrice({
      accountEquity,
      positions,
      markets: [...markets.values()],
      marketContexts: [...marketContexts].map(([marketName, price]) => ({
        marketName,
        markPrice: price,
      })),
      targetMarketAddr,
      orderSize,
      executionPrice,
    });
    return Number.isFinite(result) && result >= 0 ? result : null;
  } catch {
    return null;
  }
}
