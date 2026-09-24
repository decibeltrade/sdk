/**
 * Regression coverage for single-response account HTTP reads.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { DecibelReaderDeps, NAMED_CONFIGS } from "../constants";
import { UserActiveTwapsReader } from "./user-active-twaps/user-active-twaps.reader";
import { UserActiveTwap } from "./user-active-twaps/user-active-twaps.types";
import { UserOpenOrdersReader } from "./user-open-orders/user-open-orders.reader";
import { UserOpenOrder } from "./user-open-orders/user-open-orders.types";
import { UserPositionsReader } from "./user-positions/user-positions.reader";
import { UserPosition } from "./user-positions/user-positions.types";

const deps = { config: NAMED_CONFIGS.testnet } as DecibelReaderDeps;
const subAddr = "0x123";

const requestUrl = (input: Parameters<typeof fetch>[0]): URL =>
  new URL(input instanceof Request ? input.url : input);

function createPosition(index: number): UserPosition {
  return {
    market: `0x${index}`,
    user: subAddr,
    size: 1,
    user_leverage: 2,
    entry_price: 10,
    is_isolated: false,
    unrealized_funding: 0,
    estimated_liquidation_price: 5,
    tp_order_id: null,
    tp_trigger_price: null,
    tp_limit_price: null,
    sl_order_id: null,
    sl_trigger_price: null,
    sl_limit_price: null,
    has_fixed_sized_tpsls: false,
    transaction_version: index,
  };
}

function createOpenOrder(index: number): UserOpenOrder {
  return {
    market: "0xmarket",
    order_id: String(index),
    parent: "",
    client_order_id: null,
    orig_size: 1,
    remaining_size: 1,
    size_delta: null,
    price: 10,
    is_buy: true,
    details: "",
    transaction_version: index,
    unix_ms: index,
    is_tpsl: false,
    tp_trigger_price: null,
    tp_limit_price: null,
    sl_trigger_price: null,
    sl_limit_price: null,
    asset_type: "perp",
  };
}

function createTwap(index: number): UserActiveTwap {
  return {
    market: "0xmarket",
    order_id: String(index),
    client_order_id: "",
    is_buy: true,
    is_reduce_only: false,
    start_unix_ms: index,
    frequency_s: 1,
    duration_s: 60,
    orig_size: 1,
    remaining_size: 1,
    status: index === 0 ? "Cancelled" : "Activated",
    transaction_unix_ms: index,
    transaction_version: index,
  };
}

const cases = [
  {
    name: "positions",
    Reader: UserPositionsReader,
    createRow: createPosition,
    createResponse: (items: unknown[]) => items,
  },
  {
    name: "open orders",
    Reader: UserOpenOrdersReader,
    createRow: createOpenOrder,
    createResponse: (items: unknown[]) => ({ items, total_count: 99_999 }),
  },
  {
    name: "active TWAPs",
    Reader: UserActiveTwapsReader,
    createRow: createTwap,
    createResponse: (items: unknown[]) => items,
  },
];

afterEach(() => vi.restoreAllMocks());

describe.each(cases)("bounded $name", ({ Reader, createRow, createResponse }) => {
  it.each([0, 999, 1000])("returns %i rows from a single response", async (count) => {
    const response = createResponse(Array.from({ length: count }, (_, index) => createRow(index)));
    const controller = new AbortController();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(response)));
    expect(
      await new Reader(deps).getByAddr({
        subAddr,
        limit: 1000,
        fetchOptions: { signal: controller.signal },
      }),
    ).toEqual(response);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [input, options] = fetchSpy.mock.calls[0];
    const url = requestUrl(input);
    expect(url.searchParams.get("account")).toBe(subAddr);
    expect(url.searchParams.get("limit")).toBe("1000");
    expect(url.searchParams.has("offset")).toBe(false);
    expect(url.searchParams.has("require_complete")).toBe(false);
    expect(options?.signal).toBe(controller.signal);
  });

  it("preserves HTTP failures", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(new Reader(deps).getByAddr({ subAddr, limit: 1000 })).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

describe("bounded request arguments", () => {
  it("preserves position filters and custom headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]"));
    await new UserPositionsReader(deps).getByAddr({
      subAddr,
      marketAddr: "0xmarket",
      includeDeleted: true,
      limit: 1000,
      fetchOptions: { headers: { "X-Test": "preserved" } },
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [input, options] = fetchSpy.mock.calls[0];
    const url = requestUrl(input);
    expect(url.searchParams.get("market_address")).toBe("0xmarket");
    expect(url.searchParams.get("include_deleted")).toBe("true");
    expect(new Headers(options?.headers).get("X-Test")).toBe("preserved");
  });

  it("keeps position and TWAP defaults", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("[]"))
      .mockResolvedValueOnce(new Response("[]"));
    expect(await new UserPositionsReader(deps).getByAddr({ subAddr })).toEqual([]);
    expect(await new UserActiveTwapsReader(deps).getByAddr({ subAddr })).toEqual([]);
    const [positions, twaps] = fetchSpy.mock.calls.map(([url]) => requestUrl(url));
    expect(positions.searchParams.get("limit")).toBe("10");
    expect(positions.searchParams.get("include_deleted")).toBe("false");
    expect(positions.searchParams.has("offset")).toBe(false);
    expect(twaps.searchParams.has("limit")).toBe(false);
    expect(twaps.searchParams.has("offset")).toBe(false);
  });
});
