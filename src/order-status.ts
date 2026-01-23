import z from "zod/v4";

import { DecibelConfig } from "./constants";

// Order status response schema
export const OrderStatusSchema = z.object({
  parent: z.string(),
  market: z.string(),
  order_id: z.string(),
  status: z.string(),
  orig_size: z.number(),
  remaining_size: z.number(),
  size_delta: z.number(),
  price: z.number(),
  is_buy: z.boolean(),
  details: z.string(),
  transaction_version: z.number(),
  unix_ms: z.number(),
});

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export type OrderStatusType = "Acknowledged" | "Filled" | "Cancelled" | "Rejected" | "Unknown";

export class OrderStatusClient {
  constructor(private config: DecibelConfig) {}

  /**
   * Get order status by order ID and market address using REST API
   */
  async getOrderStatus(
    orderId: string,
    marketAddress: string,
    userAddress: string,
  ): Promise<OrderStatus | null> {
    try {
      const url = `${this.config.tradingHttpUrl}/api/v1/orders?order_id=${orderId}&market_address=${marketAddress}&account=${userAddress}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Order not found yet
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return OrderStatusSchema.parse(data);
    } catch (error) {
      console.error("Error fetching order status:", error);
      return null;
    }
  }

  /**
   * Parse order status string to enum-like type
   */
  parseOrderStatusType(status: string | undefined | null): OrderStatusType {
    if (!status) return "Unknown";
    const upperStatus = status.toLowerCase();
    if (upperStatus.includes("acknowledged")) return "Acknowledged";
    if (upperStatus.includes("filled")) return "Filled";
    if (upperStatus.includes("cancelled")) return "Cancelled";
    if (upperStatus.includes("rejected")) return "Rejected";
    return "Unknown";
  }

  /**
   * Check if order status represents success
   */
  isSuccessStatus(status: string | undefined | null): boolean {
    return this.parseOrderStatusType(status) === "Filled";
  }

  /**
   * Check if order status represents failure
   */
  isFailureStatus(status: string | undefined | null): boolean {
    const statusType = this.parseOrderStatusType(status);
    return statusType === "Cancelled" || statusType === "Rejected";
  }

  /**
   * Check if order status is final (success or failure)
   */
  isFinalStatus(status: string | undefined | null): boolean {
    return this.isSuccessStatus(status) || this.isFailureStatus(status);
  }
}
