import { afterEach, describe, expect, it, vi } from "vitest";

import { DecibelReaderDeps, NAMED_CONFIGS } from "../../constants";
import { LeaderboardReader } from "./leaderboard.reader";

const deps = { config: NAMED_CONFIGS.testnet } as DecibelReaderDeps;
const requestUrl = (input: Parameters<typeof fetch>[0]): URL =>
  new URL(input instanceof Request ? input.url : input);

describe("LeaderboardReader.getLeaderboard", () => {
  afterEach(() => vi.restoreAllMocks());

  const respondEmpty = () =>
    vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ items: [], total_count: 0 }))),
      );

  // The trading API ranks realized PnL over a rolling window when asked; all time sends none.
  it("asks for a rolling window, and sends none for all time", async () => {
    const fetchSpy = respondEmpty();
    const reader = new LeaderboardReader(deps);
    await reader.getLeaderboard({ limit: 1, offset: 0, sortKey: "realized_pnl", window: "7d" });
    await reader.getLeaderboard({ limit: 1, offset: 0, sortKey: "realized_pnl", window: "all" });
    const [first, second] = fetchSpy.mock.calls.map(([input]) => requestUrl(input));
    expect(first.searchParams.get("window")).toBe("7d");
    expect(second.searchParams.has("window")).toBe(false);
  });
});
