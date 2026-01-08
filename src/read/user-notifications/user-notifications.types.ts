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
}

export enum ClientNotificationType {
  TwapPlaced = "TwapPlaced",
  OrderCancellationPlaced = "OrderCancellationPlaced",
  PositionCancellationPlaced = "PositionCancellationPlaced",
  TwapCancellationPlaced = "TwapCancellationPlaced",
  OrderCancellationErrored = "OrderCancellationErrored",
  PositionCancellationErrored = "PositionCancellationErrored",
  TwapCancellationErrored = "TwapCancellationErrored",
  LimitOrderSubmitted = "LimitOrderSubmitted",
}

export const NotificationMetadataSchema = z.object({
  trigger_price: z.number().optional(),
  reason: z.string().optional(),
  amount: z.number().optional(),
  filled_size: z.number().optional(),
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
