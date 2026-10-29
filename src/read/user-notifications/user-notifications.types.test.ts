import { describe, expect, it } from "vitest";

import { NotificationType, UserNotificationSchema } from "./user-notifications.types";

// Mirrors the JSON pinned by `borrow_lend_builder_tests::collateral_deposit_json_shape`
// in rust/trading-api/src/notification/notification_builder.rs.
const borrowLendCollateralDeposit = {
  notification: {
    account: "0xb53203494f71424f39b104f9125dec6198ae6dadbfe7abdded5d8d85ab1ce213",
    notification_type: "BorrowLendCollateralDeposited",
    notification_metadata: {
      amount_raw: "340282366920938463463374607431768211455",
      asset: "0x000000000000000000000000000000000000000000000000000000000000dddd",
      transaction_version: "18446744073709551615",
      event_index: "7",
    },
  },
};

describe("UserNotificationSchema borrow/lend", () => {
  it("parses a BorrowLend notification and keeps chain units as strings", () => {
    const parsed = UserNotificationSchema.parse(borrowLendCollateralDeposit);
    expect(parsed.notification.notification_type).toBe(
      NotificationType.BorrowLendCollateralDeposited,
    );
    expect(parsed.notification.notification_metadata?.amount_raw).toBe(
      "340282366920938463463374607431768211455",
    );
    expect(parsed.notification.notification_metadata?.amount).toBeUndefined();
    expect(parsed.notification.order).toBeUndefined();
    expect(parsed.notification.twap).toBeUndefined();
  });

  it.each([
    "BorrowLendBorrowed",
    "BorrowLendRepaid",
    "BorrowLendLiquidated",
    "BorrowLendSupplied",
    "BorrowLendRedeemed",
    "BorrowLendCollateralDeposited",
    "BorrowLendCollateralWithdrawn",
  ])("accepts %s with no asset (primary-asset amount)", (notification_type) => {
    const parsed = UserNotificationSchema.parse({
      notification: {
        account: "0xa",
        notification_type,
        notification_metadata: {
          amount_raw: "1000000",
          transaction_version: "42",
          event_index: "0",
        },
      },
    });
    expect(parsed.notification.notification_metadata?.asset).toBeUndefined();
  });

  it("parses the seized side of a liquidation", () => {
    const parsed = UserNotificationSchema.parse({
      notification: {
        account: "0xa",
        notification_type: "BorrowLendLiquidated",
        notification_metadata: {
          amount_raw: "700",
          seized_asset: "0x000000000000000000000000000000000000000000000000000000000000dddd",
          seized_amount_raw: "5",
          transaction_version: "17",
          event_index: "3",
        },
      },
    });
    const metadata = parsed.notification.notification_metadata;
    expect(metadata?.amount_raw).toBe("700");
    expect(metadata?.seized_amount_raw).toBe("5");
    expect(metadata?.seized_asset).toMatch(/dddd$/);
  });

  it("rejects a numeric amount_raw", () => {
    expect(() =>
      UserNotificationSchema.parse({
        notification: {
          account: "0xa",
          notification_type: "BorrowLendBorrowed",
          notification_metadata: { amount_raw: 1 },
        },
      }),
    ).toThrow();
  });

  it("rejects a notification_type this SDK does not know", () => {
    expect(() =>
      UserNotificationSchema.parse({
        notification: { account: "0xa", notification_type: "BorrowLendSomethingElse" },
      }),
    ).toThrow();
  });
});
