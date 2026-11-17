import { describe, expect, it, vi } from "vitest";

import { UserTradeHistoryReader } from "../../src/read/user-trade-history/user-trade-history.reader";

const deps = { config: { tradingHttpUrl: "http://api" } } as never;

function reader() {
  const r = new UserTradeHistoryReader(deps);
  const get = vi.fn().mockResolvedValue({ data: { items: [] } });
  Object.assign(r, { getRequest: get });
  return { r, get };
}

describe("UserTradeHistoryReader.getByAddr", () => {
  it("passes the market filter through, and leaves it out when not asked", async () => {
    const { r, get } = reader();
    await r.getByAddr({ subAddr: "0xa", market: "0xb" });
    expect(get.mock.calls[0]?.[0].queryParams).toMatchObject({ account: "0xa", market: "0xb" });
    await r.getByAddr({ subAddr: "0xa" });
    expect(get.mock.calls[1]?.[0].queryParams).not.toHaveProperty("market");
  });
});
