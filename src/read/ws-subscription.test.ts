import WebSocket from "isomorphic-ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

import { DecibelConfig } from "../constants";
import { DecibelWsSubscription } from "./ws-subscription";

vi.mock("isomorphic-ws", () => {
  class FakeWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    listeners = new Map<string, Array<(event?: unknown) => void>>();
    send = vi.fn();
    readyState = FakeWebSocket.OPEN;

    constructor(readonly url: string) {
      FakeWebSocket.instances.push(this);
    }

    addEventListener(type: string, listener: (event?: unknown) => void) {
      const existing = this.listeners.get(type) ?? [];
      this.listeners.set(type, [...existing, listener]);
    }

    close() {
      // Tests drive lifecycle explicitly via emit("close").
    }

    emit(type: string, event?: unknown) {
      this.listeners.get(type)?.forEach((listener) => listener(event));
    }
  }
  class MockErrorEvent {
    message = "";
  }
  return { default: FakeWebSocket, ErrorEvent: MockErrorEvent };
});

type FakeWebSocket = InstanceType<typeof WebSocket> & {
  emit: (type: string, event?: unknown) => void;
  send: ReturnType<typeof vi.fn>;
};
const FakeWebSocket = WebSocket as unknown as { instances: FakeWebSocket[] };

const config = { tradingWsUrl: "wss://ws.example.com" } as DecibelConfig;

function createSubscribed() {
  const ws = new DecibelWsSubscription(config);
  ws.subscribe("topic:a", z.unknown(), () => undefined);
  const socket = () => FakeWebSocket.instances.at(-1);
  return { ws, socket };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DecibelWsSubscription.onReconnect", () => {
  it("does not fire on the first open", () => {
    const { ws, socket } = createSubscribed();
    const listener = vi.fn();
    ws.onReconnect(listener);

    socket()?.emit("open");

    expect(listener).not.toHaveBeenCalled();
  });

  it("fires after a drop and successful reopen, once per reconnect", () => {
    const { ws, socket } = createSubscribed();
    const listener = vi.fn();
    ws.onReconnect(listener);

    socket()?.emit("open");
    socket()?.emit("close");
    vi.advanceTimersByTime(1_000);
    socket()?.emit("open");

    expect(listener).toHaveBeenCalledTimes(1);
    // Re-seed only makes sense after the subscribe frames went out.
    expect(socket()?.send).toHaveBeenCalledWith(
      JSON.stringify({ method: "subscribe", topic: "topic:a" }),
    );
  });

  it("stops firing after unregister", () => {
    const { ws, socket } = createSubscribed();
    const listener = vi.fn();
    const unregister = ws.onReconnect(listener);
    unregister();

    socket()?.emit("open");
    socket()?.emit("close");
    vi.advanceTimersByTime(1_000);
    socket()?.emit("open");

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("DecibelWsSubscription reconnect backoff", () => {
  it("stays capped at 30s even after many failed attempts", () => {
    const { socket } = createSubscribed();

    // 20 uncapped attempts would reach 1.5^19 ≈ 36 minutes.
    for (let attempt = 0; attempt < 20; attempt++) {
      const before = FakeWebSocket.instances.length;
      socket()?.emit("close");
      vi.advanceTimersByTime(30_000);
      expect(FakeWebSocket.instances.length).toBe(before + 1);
    }
  });
});
