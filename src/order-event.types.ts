// Type definitions for OrderEvent returned by placeOrder transactions

export interface OrderEventClientOrderId {
  vec: unknown[];
}

export interface OrderEventStatus {
  __variant__: string;
}

export interface OrderEventTimeInForce {
  __variant__: string;
}

export interface OrderEventTriggerCondition {
  vec: unknown[];
}

export interface OrderEventOrderId {
  order_id: string;
}

export interface OrderEvent {
  client_order_id: OrderEventClientOrderId;
  details: string;
  is_bid: boolean;
  is_taker: boolean;
  market: string;
  metadata_bytes: string;
  order_id: string;
  orig_size: string;
  parent: string;
  price: string;
  remaining_size: string;
  size_delta: string;
  status: OrderEventStatus;
  time_in_force: OrderEventTimeInForce;
  trigger_condition: OrderEventTriggerCondition;
  user: string;
}

export interface TwapEvent {
  account: string;
  duration_s: string;
  frequency_s: string;
  is_buy: boolean;
  is_reduce_only: boolean;
  market: string;
  order_id: OrderEventOrderId;
  orig_size: string;
  remain_size: string;
  start_time_s: string;
  status: OrderEventStatus;
}

export type PlaceOrderResult =
  | {
      success: true;
      orderId: string | undefined;
      transactionHash: string;
    }
  | {
      success: false;
      error: string;
    };
