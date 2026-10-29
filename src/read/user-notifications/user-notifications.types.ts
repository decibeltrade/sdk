import z from "zod/v4";

import { UserActiveTwapSchema } from "../user-active-twaps/user-active-twaps.types";
import { UserOrderSchema } from "../user-order-history/user-order-history.types";

// from /rust/trading-api-dto/src/notification.rs
export enum NotificationType {
  MarketOrderPlaced = "MarketOrderPlaced",
  LimitOrderPlaced = "LimitOrderPlaced",
  StopMarketOrderPlaced = "StopMarketOrderPlaced",
  StopMarketOrderTriggered = "StopMarketOrderTriggered",
  StopLimitOrderPlaced = "StopLimitOrderPlaced",
  StopLimitOrderTriggered = "StopLimitOrderTriggered",
  OrderPartiallyFilled = "OrderPartiallyFilled",
  OrderFilled = "OrderFilled",
  OrderSizeReduced = "OrderSizeReduced",
  OrderCancelled = "OrderCancelled",
  OrderRejected = "OrderRejected",
  OrderErrored = "OrderErrored",
  TwapOrderPlaced = "TwapOrderPlaced",
  TwapOrderTriggered = "TwapOrderTriggered",
  TwapOrderCompleted = "TwapOrderCompleted",
  TwapOrderCancelled = "TwapOrderCancelled",
  TwapOrderErrored = "TwapOrderErrored",
  AccountDeposit = "AccountDeposit",
  AccountWithdrawal = "AccountWithdrawal",
  TpSlSet = "TpSlSet",
  TpHit = "TpHit",
  SlHit = "SlHit",
  TpCancelled = "TpCancelled",
  SlCancelled = "SlCancelled",
  BorrowLendBorrowed = "BorrowLendBorrowed",
  BorrowLendRepaid = "BorrowLendRepaid",
  BorrowLendLiquidated = "BorrowLendLiquidated",
  BorrowLendSupplied = "BorrowLendSupplied",
  BorrowLendRedeemed = "BorrowLendRedeemed",
  BorrowLendCollateralDeposited = "BorrowLendCollateralDeposited",
  BorrowLendCollateralWithdrawn = "BorrowLendCollateralWithdrawn",
}

export enum ClientNotificationType {
  TwapPlaced = "TwapPlaced",
  OrderCancellationPlaced = "OrderCancellationPlaced",
  PositionCancellationPlaced = "PositionCancellationPlaced",
  PositionReversalPlaced = "PositionReversalPlaced",
  TwapCancellationPlaced = "TwapCancellationPlaced",
  OrderCancellationErrored = "OrderCancellationErrored",
  PositionCancellationErrored = "PositionCancellationErrored",
  PositionReversalErrored = "PositionReversalErrored",
  TwapCancellationErrored = "TwapCancellationErrored",
  LimitOrderSubmitted = "LimitOrderSubmitted",
}

export const NotificationMetadataSchema = z.object({
  trigger_price: z.number().optional(),
  reason: z.string().optional(),
  amount: z.number().optional(),
  filled_size: z.number().optional(),
  // BorrowLend* only: chain units as a decimal string (not normalized);
  // `asset` is absent when the amount is in the pool's primary asset.
  amount_raw: z.string().optional(),
  asset: z.string().optional(),
  transaction_version: z.string().optional(),
  event_index: z.string().optional(),
  // BorrowLendLiquidated only: collateral seized from the borrower.
  seized_asset: z.string().optional(),
  seized_amount_raw: z.string().optional(),
});

export const UserNotificationSchema = z.object({
  notification: z.object({
    account: z.string(),
    notification_metadata: NotificationMetadataSchema.optional(),
    notification_type: z.enum(NotificationType),
    order: UserOrderSchema.optional(),
    twap: UserActiveTwapSchema.optional(),
  }),
});

export type UserNotification = z.infer<typeof UserNotificationSchema>;
