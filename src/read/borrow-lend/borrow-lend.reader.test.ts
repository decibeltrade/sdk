import { Aptos, Network } from "@aptos-labs/ts-sdk";
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { DecibelConfig, DecibelReaderDeps } from "../../constants";
import { DEFAULT_COMPAT_VERSION } from "../../release-config";
import { FetchError } from "../../utils";
import { DecibelWsSubscription } from "../ws-subscription";
import accountBorrower from "./__fixtures__/account_borrower.json";
import pool from "./__fixtures__/pool.json";
import rateHistory from "./__fixtures__/rate_history.json";
import { BorrowLendReader } from "./borrow-lend.reader";

const BASE_URL = "https://api.testnet.example.com";
const ACCOUNT = "0x00000000000000000000000000000000000000000000000000000000000000aa";
const VAULT = "0x00000000000000000000000000000000000000000000000000000000000000bb";

const SOURCE = { transaction_version: "10", transaction_unix_ms: 100 };

const COLLATERAL_ITEM = {
  asset: "0xabc",
  decimals: 8,
  max_collateral_units: "1000",
  value_in_primary_per_unit: "1",
  max_ltv_bps: 8000,
  target_ltv_bps: 6000,
  liquidation_bonus_bps: 500,
  liquidation_protocol_fee_bps: 100,
};

const ACTIVITY_ITEM = {
  source: SOURCE,
  event_index: "0",
  account: ACCOUNT,
  event_type: "borrow",
  reason: "auto",
  counterparty: "0x0",
  asset: "0x1",
  amount: "5",
  shares: "5",
  secondary_amount: "0",
  protocol_fee_amount: "0",
  reaches_target: false,
  is_full_repay: false,
  target_amount: "0",
  insurance_amount: "0",
};

const POOL_HISTORY_ITEM = {
  source: SOURCE,
  event_index: "1",
  pool_address: "0x3",
  event_type: "indices_updated",
  borrow_index: "1000000000000000000000000000",
  supply_index: "1000000000000000000000000000",
  last_index_update_secs: "1",
  total_lender_shares: "0",
  available_liquidity: "10",
  base_apr_ray: "0",
  slope1_apr_ray: "0",
  slope2_apr_ray: "0",
  kink_ray: "0",
  treasury_fee_bps: 0,
  insurance_fee_bps: 0,
  liquidation_target_ltv_bps: 0,
};

function createReader() {
  const config: DecibelConfig = {
    network: Network.TESTNET,
    fullnodeUrl: "https://testnet.aptoslabs.com/v1",
    tradingHttpUrl: BASE_URL,
    tradingWsUrl: "wss://ws.testnet.example.com",
    deployment: {
      package: "0x0000000000000000000000000000000000000000000000000000000000000123",
      predepositPackage: "0x0",
      campaignPackage: "0x0",
      usdc: "0x0",
      testc: "0x0",
      perpEngineGlobal: "0x0",
      dlpVault: "0x0",
      dlpShare: "0x0",
    },
    compatVersion: DEFAULT_COMPAT_VERSION,
  };
  const deps: DecibelReaderDeps = {
    aptos: {} as Aptos,
    ws: {} as DecibelWsSubscription,
    config,
  };
  return new BorrowLendReader(deps);
}

function mockFetchJson(body: unknown, status = 200) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

function calledUrl(spy: MockInstance<typeof fetch>): URL {
  const first = spy.mock.calls[0]?.[0];
  if (typeof first !== "string" && !(first instanceof URL)) {
    throw new Error("expected fetch to be called with a string or URL");
  }
  return new URL(first);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BorrowLendReader.getPool", () => {
  it("GETs /api/v1/borrow_lend/pool with no query and parses the response", async () => {
    const spy = mockFetchJson(pool);

    const result = await createReader().getPool();

    const url = calledUrl(spy);
    expect(url.origin + url.pathname).toBe(`${BASE_URL}/api/v1/borrow_lend/pool`);
    expect(url.search).toBe("");
    expect(result.pool_address).toBe(pool.pool_address);
  });

  it("throws a FetchError carrying status 503 when borrow/lend is unavailable", async () => {
    mockFetchJson({ message: "borrow/lend unavailable" }, 503);

    await expect(createReader().getPool()).rejects.toMatchObject({
      constructor: FetchError,
      status: 503,
    });
  });

  it("rejects a pool missing a required field", async () => {
    mockFetchJson({ ...pool, pool_address: undefined });

    await expect(createReader().getPool()).rejects.toThrow();
  });
});

describe("BorrowLendReader.getAccount", () => {
  it("sends the account query param and parses the response", async () => {
    const spy = mockFetchJson(accountBorrower);

    const result = await createReader().getAccount({ account: ACCOUNT });

    const url = calledUrl(spy);
    expect(url.pathname).toBe("/api/v1/borrow_lend/account");
    expect(url.searchParams.get("account")).toBe(ACCOUNT);
    expect(result.debt).toBe(accountBorrower.debt);
  });

  it("rejects a malformed response instead of returning it", async () => {
    mockFetchJson({ account: ACCOUNT });

    await expect(createReader().getAccount({ account: ACCOUNT })).rejects.toThrow();
  });
});

describe("BorrowLendReader.getCollateral", () => {
  it("omits unset pagination params", async () => {
    const spy = mockFetchJson({ items: [] });

    await createReader().getCollateral();

    const url = calledUrl(spy);
    expect(url.pathname).toBe("/api/v1/borrow_lend/collateral");
    expect(url.search).toBe("");
  });

  it("sends offset and limit, never the removed after_asset", async () => {
    const spy = mockFetchJson({ items: [] });

    await createReader().getCollateral({ offset: 200, limit: 25 });

    const url = calledUrl(spy);
    expect(url.searchParams.get("offset")).toBe("200");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.has("after_asset")).toBe(false);
  });

  it("sends offset 0 rather than dropping it", async () => {
    const spy = mockFetchJson({ items: [] });

    await createReader().getCollateral({ offset: 0 });

    expect(calledUrl(spy).searchParams.get("offset")).toBe("0");
  });

  it("parses a collateral item and tolerates an absent total_count", async () => {
    mockFetchJson({ items: [COLLATERAL_ITEM] });

    const result = await createReader().getCollateral();

    expect(result.items[0]?.asset).toBe(COLLATERAL_ITEM.asset);
    expect(result.total_count).toBeUndefined();
  });

  it("accepts a null value_in_primary_per_unit as unavailable", async () => {
    mockFetchJson({ items: [{ ...COLLATERAL_ITEM, value_in_primary_per_unit: null }] });

    const result = await createReader().getCollateral();

    expect(result.items[0]?.value_in_primary_per_unit).toBeNull();
  });

  it("rejects an item missing required fields", async () => {
    mockFetchJson({ items: [{ asset: "0xabc" }] });

    await expect(createReader().getCollateral()).rejects.toThrow();
  });
});

describe("BorrowLendReader.getVaultLending", () => {
  it("sends the vault query param", async () => {
    const spy = mockFetchJson({
      vault_address: VAULT,
      primary_asset: "0x1",
      primary_decimals: 6,
      indices_as_of_secs: "1",
      claim_in_primary: "0",
      positions: [],
    });

    const result = await createReader().getVaultLending({ vault: VAULT });

    const url = calledUrl(spy);
    expect(url.pathname).toBe("/api/v1/borrow_lend/vault_lending");
    expect(url.searchParams.get("vault")).toBe(VAULT);
    expect(result.vault_address).toBe(VAULT);
  });

  it("rejects a response missing required fields", async () => {
    mockFetchJson({ vault_address: VAULT, positions: [] });

    await expect(createReader().getVaultLending({ vault: VAULT })).rejects.toThrow();
  });

  it("rejects a malformed lending position", async () => {
    mockFetchJson({
      vault_address: VAULT,
      primary_asset: "0x1",
      primary_decimals: 6,
      indices_as_of_secs: "1",
      claim_in_primary: "0",
      positions: [{}],
    });

    await expect(createReader().getVaultLending({ vault: VAULT })).rejects.toThrow();
  });
});

describe.each([
  ["getActivity", "activity"],
  ["getLendingHistory", "lending_history"],
] as const)("BorrowLendReader.%s", (method, path) => {
  it("sends account and omits unset cursor/limit/filters", async () => {
    const spy = mockFetchJson({ items: [], next_cursor: null });

    await createReader()[method]({ account: ACCOUNT });

    const url = calledUrl(spy);
    expect(url.pathname).toBe(`/api/v1/borrow_lend/${path}`);
    expect(url.searchParams.get("account")).toBe(ACCOUNT);
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.has("limit")).toBe(false);
    expect(url.searchParams.has("event_type")).toBe(false);
    expect(url.searchParams.has("reason")).toBe(false);
  });

  it("sends the cursor and limit, never the removed before, and returns next_cursor", async () => {
    const spy = mockFetchJson({ items: [], next_cursor: "100:2" });

    const result = await createReader()[method]({
      account: ACCOUNT,
      cursor: "200:5",
      limit: 50,
    });

    const url = calledUrl(spy);
    expect(url.searchParams.get("cursor")).toBe("200:5");
    expect(url.searchParams.has("before")).toBe(false);
    expect(url.searchParams.get("limit")).toBe("50");
    expect(result.next_cursor).toBe("100:2");
  });

  it("sends the event_type and reason filters", async () => {
    const spy = mockFetchJson({ items: [], next_cursor: null });

    await createReader()[method]({ account: ACCOUNT, eventType: "Debt", reason: "FillBorrow" });

    const url = calledUrl(spy);
    expect(url.searchParams.get("event_type")).toBe("Debt");
    expect(url.searchParams.get("reason")).toBe("FillBorrow");
  });

  it("sends an empty reason, which the server matches against rows without a reason", async () => {
    const spy = mockFetchJson({ items: [], next_cursor: null });

    await createReader()[method]({ account: ACCOUNT, reason: "" });

    expect(calledUrl(spy).searchParams.get("reason")).toBe("");
  });

  it("parses an activity item and returns its fields", async () => {
    mockFetchJson({ items: [ACTIVITY_ITEM], next_cursor: null });

    const result = await createReader()[method]({ account: ACCOUNT });

    expect(result.items[0]?.event_type).toBe(ACTIVITY_ITEM.event_type);
  });

  it("rejects a page whose item is a pool-history row", async () => {
    mockFetchJson({ items: [POOL_HISTORY_ITEM], next_cursor: null });

    await expect(createReader()[method]({ account: ACCOUNT })).rejects.toThrow();
  });

  it("rejects an item missing required fields", async () => {
    mockFetchJson({ items: [{}], next_cursor: null });

    await expect(createReader()[method]({ account: ACCOUNT })).rejects.toThrow();
  });

  it("rejects a page with no next_cursor key", async () => {
    mockFetchJson({ items: [] });

    await expect(createReader()[method]({ account: ACCOUNT })).rejects.toThrow();
  });
});

describe("BorrowLendReader.getPoolHistory", () => {
  it("sends the timestamp range as milliseconds", async () => {
    const spy = mockFetchJson({ items: [], next_cursor: null });

    await createReader().getPoolHistory({ startTimestamp: 1_000, endTimestamp: 2_000 });

    const url = calledUrl(spy);
    expect(url.pathname).toBe("/api/v1/borrow_lend/pool_history");
    expect(url.searchParams.get("start_timestamp")).toBe("1000");
    expect(url.searchParams.get("end_timestamp")).toBe("2000");
    expect(url.searchParams.has("cursor")).toBe(false);
  });

  it("sends the range, cursor and limit, never the removed before", async () => {
    const spy = mockFetchJson({ items: [], next_cursor: null });

    await createReader().getPoolHistory({
      startTimestamp: 1,
      endTimestamp: 2,
      cursor: "9:1",
      limit: 10,
    });

    const url = calledUrl(spy);
    expect(url.searchParams.get("start_timestamp")).toBe("1");
    expect(url.searchParams.get("cursor")).toBe("9:1");
    expect(url.searchParams.has("before")).toBe(false);
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("parses a pool-history item and returns its fields", async () => {
    mockFetchJson({ items: [POOL_HISTORY_ITEM], next_cursor: null });

    const result = await createReader().getPoolHistory({ startTimestamp: 1, endTimestamp: 2 });

    expect(result.items[0]?.pool_address).toBe(POOL_HISTORY_ITEM.pool_address);
  });

  it("rejects a page whose item is an activity row", async () => {
    mockFetchJson({ items: [ACTIVITY_ITEM], next_cursor: null });

    await expect(
      createReader().getPoolHistory({ startTimestamp: 1, endTimestamp: 2 }),
    ).rejects.toThrow();
  });

  it("rejects an item missing required fields", async () => {
    mockFetchJson({ items: [{}], next_cursor: null });

    await expect(
      createReader().getPoolHistory({ startTimestamp: 1, endTimestamp: 2 }),
    ).rejects.toThrow();
  });

  it("rejects a page with no next_cursor key", async () => {
    mockFetchJson({ items: [] });

    await expect(
      createReader().getPoolHistory({ startTimestamp: 1, endTimestamp: 2 }),
    ).rejects.toThrow();
  });
});

describe("BorrowLendReader.getRateHistory", () => {
  it("sends the range in milliseconds and the interval", async () => {
    const spy = mockFetchJson({ points: [] });

    await createReader().getRateHistory({
      startTimestamp: 1_000,
      endTimestamp: 2_000,
      interval: "1d",
    });

    const url = calledUrl(spy);
    expect(url.pathname).toBe("/api/v1/borrow_lend/rate_history");
    expect(url.searchParams.get("start_timestamp")).toBe("1000");
    expect(url.searchParams.get("end_timestamp")).toBe("2000");
    expect(url.searchParams.get("interval")).toBe("1d");
  });

  it("omits the interval when unset so the server default applies", async () => {
    const spy = mockFetchJson({ points: [] });

    await createReader().getRateHistory({ startTimestamp: 1, endTimestamp: 2 });

    expect(calledUrl(spy).searchParams.has("interval")).toBe(false);
  });

  it("parses the rate-history fixture and keeps null supply APRs as null", async () => {
    mockFetchJson(rateHistory);

    const result = await createReader().getRateHistory({ startTimestamp: 0, endTimestamp: 3 });

    expect(result.points).toHaveLength(rateHistory.points.length);
    expect(result.points[0]?.supply_apr_ray).toBe("7884000000000000000000000");
    expect(result.points[2]?.supply_apr_ray).toBeNull();
  });

  it("throws a FetchError carrying status 503 when borrow/lend is unavailable", async () => {
    mockFetchJson({ message: "borrow/lend unavailable" }, 503);

    await expect(
      createReader().getRateHistory({ startTimestamp: 1, endTimestamp: 2 }),
    ).rejects.toMatchObject({ constructor: FetchError, status: 503 });
  });

  it("rejects a point missing required fields", async () => {
    mockFetchJson({ points: [{ bucket_start: 0 }] });

    await expect(
      createReader().getRateHistory({ startTimestamp: 1, endTimestamp: 2 }),
    ).rejects.toThrow();
  });

  it("rejects a response without a points array", async () => {
    mockFetchJson({ items: [] });

    await expect(
      createReader().getRateHistory({ startTimestamp: 1, endTimestamp: 2 }),
    ).rejects.toThrow();
  });
});
