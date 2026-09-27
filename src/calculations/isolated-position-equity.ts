/** Estimates an isolated margin pool after unrealized PnL and funding. */
export interface IsolatedPositionEquityInput {
  size: number;
  entryPrice: number;
  userLeverage: number;
  markPrice: number;
  unrealizedFunding: number;
}

export function isolatedPositionEquity(input: IsolatedPositionEquityInput): number {
  const margin =
    input.userLeverage > 0 ? (Math.abs(input.size) * input.entryPrice) / input.userLeverage : 0;
  return margin + input.size * (input.markPrice - input.entryPrice) - input.unrealizedFunding;
}
