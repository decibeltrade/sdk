import type { PerpMarket } from "../markets/markets.types";
import type { UserPosition } from "./user-positions.types";

export interface MarketSettings {
  isCross: boolean;
  userLeverage: number;
}

/**
 * Account margin mode and leverage for a market. Pass the row from an `includeDeleted`
 * read: closed positions retain the settings. With no row, the chain's defaults apply.
 */
export function marketSettingsFromPosition(
  position: UserPosition | undefined,
  market: Pick<PerpMarket, "is_isolated_only" | "max_leverage">,
): MarketSettings {
  if (position) return { isCross: !position.is_isolated, userLeverage: position.user_leverage };
  return { isCross: !(market.is_isolated_only ?? false), userLeverage: market.max_leverage };
}
