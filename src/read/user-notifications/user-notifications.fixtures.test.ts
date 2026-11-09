import { describe, expect, it } from "vitest";

import borrowed from "./__fixtures__/bl-borrowed.json";
import collateralDeposited from "./__fixtures__/bl-collateral-deposited.json";
import collateralWithdrawn from "./__fixtures__/bl-collateral-withdrawn.json";
import liquidated from "./__fixtures__/bl-liquidated.json";
import redeemed from "./__fixtures__/bl-redeemed.json";
import repaid from "./__fixtures__/bl-repaid.json";
import supplied from "./__fixtures__/bl-supplied.json";
import { NotificationType, UserNotificationSchema } from "./user-notifications.types";

/**
 * CT-01: the fixtures are full WS envelopes of the real `UserNotificationResponse`; the Rust
 * `bl_ws_envelope_matches_sdk_fixtures` test (notification_builder.rs) checks the same files.
 */
const fixtures = {
  borrowed: [borrowed, NotificationType.BorrowLendBorrowed],
  liquidated: [liquidated, NotificationType.BorrowLendLiquidated],
  repaid: [repaid, NotificationType.BorrowLendRepaid],
  supplied: [supplied, NotificationType.BorrowLendSupplied],
  redeemed: [redeemed, NotificationType.BorrowLendRedeemed],
  "collateral-deposited": [collateralDeposited, NotificationType.BorrowLendCollateralDeposited],
  "collateral-withdrawn": [collateralWithdrawn, NotificationType.BorrowLendCollateralWithdrawn],
} as const;

describe("UserNotificationSchema against the Rust WS envelope", () => {
  it.each(Object.entries(fixtures))("parses bl-%s", (_name, [frame, type]) => {
    const parsed = UserNotificationSchema.parse(frame);
    expect(parsed.notification.notification_type).toBe(type);
    expect(frame.topic).toMatch(/^notifications:0x/);
    expect(parsed.notification.notification_metadata?.amount_raw).toMatch(/^\d+$/);
  });

  it("keeps the borrowed and liquidated amounts as exact chain-unit strings", () => {
    expect(
      UserNotificationSchema.parse(borrowed).notification.notification_metadata?.amount_raw,
    ).toBe("12500000");
    const meta = UserNotificationSchema.parse(liquidated).notification.notification_metadata;
    expect(meta?.amount_raw).toBe("12500000");
    expect(meta?.seized_amount_raw).toBe("150000000");
    expect(meta?.seized_asset).toMatch(/^0x0*a$/);
  });
});
