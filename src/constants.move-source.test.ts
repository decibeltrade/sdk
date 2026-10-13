import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BASE_FEE_RATES, SPOT_BASE_FEE_RATES } from "./constants";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const RUST_SRC = readFileSync(
  resolve(repoRoot, "rust/trading-api/src/http/handle_user_fees.rs"),
  "utf8",
);
const MOVE_SRC = readFileSync(
  resolve(repoRoot, "move/trade_tracking/sources/unified_fees_config.move"),
  "utf8",
);

// Fee units are 0.0001%: 450 units is a 0.00045 decimal rate.
const FEE_UNITS_PER_RATE = 1_000_000;

function tierZero(ladder: string | undefined, label: string): number {
  const first = ladder?.split(",")[0]?.trim();
  if (!first) throw new Error(`${label} fee ladder not found`);
  return Number(first);
}

function rustTierZero(constName: string): number {
  const match = new RegExp(`const ${constName}: &\\[u64\\] = &\\[([^\\]]+)\\]`).exec(RUST_SRC);
  return tierZero(match?.[1], `Rust ${constName}`);
}

const MOVE_FEE_SCHEDULE =
  `_bucket_type\\(\\),\\s*TierFeeSchedule::V1\\s*\\{\\s*` +
  `maker_fees:\\s*vector\\[([^\\]]+)\\],\\s*taker_fees:\\s*vector\\[([^\\]]+)\\]`;

function moveTierZero(bucket: "perp" | "spot", side: "maker" | "taker"): number {
  const match = new RegExp(`${bucket}${MOVE_FEE_SCHEDULE}`).exec(MOVE_SRC);
  return tierZero(match?.[side === "maker" ? 1 : 2], `Move seed_defaults ${bucket} ${side}`);
}

const PINS = [
  {
    name: "BASE_FEE_RATES.taker",
    rate: BASE_FEE_RATES.taker,
    rust: "DEFAULT_PERP_TIER_TAKER_FEES",
    bucket: "perp",
    side: "taker",
  },
  {
    name: "BASE_FEE_RATES.maker",
    rate: BASE_FEE_RATES.maker,
    rust: "DEFAULT_PERP_TIER_MAKER_FEES",
    bucket: "perp",
    side: "maker",
  },
  {
    name: "SPOT_BASE_FEE_RATES.taker",
    rate: SPOT_BASE_FEE_RATES.taker,
    rust: "DEFAULT_SPOT_TIER_TAKER_FEES",
    bucket: "spot",
    side: "taker",
  },
  {
    name: "SPOT_BASE_FEE_RATES.maker",
    rate: SPOT_BASE_FEE_RATES.maker,
    rust: "DEFAULT_SPOT_TIER_MAKER_FEES",
    bucket: "spot",
    side: "maker",
  },
] as const;

describe("base fee rates source pin", () => {
  it.each(PINS)("$name matches tier 0 of trading-api $rust", ({ rate, rust }) => {
    expect(rate * FEE_UNITS_PER_RATE).toBeCloseTo(rustTierZero(rust), 9);
  });

  it.each(PINS)(
    "$rust tier 0 matches Move seed_defaults $bucket $side",
    ({ rust, bucket, side }) => {
      expect(rustTierZero(rust)).toBe(moveTierZero(bucket, side));
    },
  );
});
