import WebSocket from "isomorphic-ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

import { DecibelConfig } from "../constants";
import { DecibelWsSubscription } from "./ws-subscription";

vi.mock("isomorphic-ws", () => {
  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    listeners = new Map<string, Array<(event?: unknown) => void>>();
    send = vi.fn();
    readyState = FakeWebSocket.CONNECTING;

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
      if (type === "open") this.readyState = FakeWebSocket.OPEN;
      if (type === "close") this.readyState = FakeWebSocket.CLOSED;
      this.listeners.get(type)?.forEach((listener) => listener(event));
    }
  }
  class MockErrorEvent {
    message = "";
  }
  return { default: FakeWebSocket, ErrorEvent: MockErrorEvent };
});

function acknowledge(socket: FakeWebSocket | undefined, method = "subscribe", success = true) {
  socket?.emit("message", {
    data: JSON.stringify({ success, method, topic: "topic:a" }),
  });
}

describe("DecibelWsSubscription subscription readiness", () => {
  it("waits for a successful subscribe acknowledgement after opening", () => {
    const ws = new DecibelWsSubscription(config);
    const onSubscribed = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), onSubscribed);
    const socket = FakeWebSocket.instances.at(-1);

    socket?.emit("open");
    expect(onSubscribed).not.toHaveBeenCalled();

    acknowledge(socket);
    expect(onSubscribed).toHaveBeenCalledOnce();
  });

  it("shares one subscribe frame and acknowledgement between consumers", () => {
    const ws = new DecibelWsSubscription(config);
    const first = vi.fn();
    const second = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), first);
    ws.subscribe("topic:a", z.unknown(), vi.fn(), second);
    const socket = FakeWebSocket.instances.at(-1);

    socket?.emit("open");
    acknowledge(socket);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(socket?.send).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ method: "subscribe", topic: "topic:a" }),
    );
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("immediately notifies a consumer joining an acknowledged topic", () => {
    const { ws, socket } = createSubscribed();
    socket()?.emit("open");
    acknowledge(socket());
    const onSubscribed = vi.fn();

    ws.subscribe("topic:a", z.unknown(), vi.fn(), onSubscribed);

    expect(onSubscribed).toHaveBeenCalledOnce();
    expect(socket()?.send).toHaveBeenCalledTimes(1);
  });

  it("ignores duplicate, rejected, and unsubscribe acknowledgements", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ws = new DecibelWsSubscription(config);
    const onSubscribed = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), onSubscribed);
    const socket = FakeWebSocket.instances.at(-1);
    socket?.emit("open");

    acknowledge(socket, "unsubscribe");
    acknowledge(socket, "subscribe", false);
    expect(onSubscribed).not.toHaveBeenCalled();

    ws.reset("topic:a");
    acknowledge(socket, "unsubscribe");
    acknowledge(socket);
    acknowledge(socket);
    acknowledge(socket, "unsubscribe");
    expect(onSubscribed).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("waits for a fresh acknowledgement after reconnecting", () => {
    const ws = new DecibelWsSubscription(config);
    const first = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), first);
    const oldSocket = FakeWebSocket.instances.at(-1);
    oldSocket?.emit("open");
    acknowledge(oldSocket);
    oldSocket?.emit("close");
    vi.advanceTimersByTime(1_000);
    const newSocket = FakeWebSocket.instances.at(-1);
    newSocket?.emit("open");
    const second = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), second);

    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    acknowledge(newSocket);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledOnce();
  });

  it("removes only the unsubscribed consumer's readiness callback", () => {
    const ws = new DecibelWsSubscription(config);
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = ws.subscribe("topic:a", z.unknown(), vi.fn(), first);
    ws.subscribe("topic:a", z.unknown(), vi.fn(), second);
    const socket = FakeWebSocket.instances.at(-1);
    socket?.emit("open");
    unsubscribe();

    acknowledge(socket);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(socket?.send).toHaveBeenCalledTimes(1);
  });

  it("requires a new acknowledgement after the last consumer leaves and rejoins", () => {
    const ws = new DecibelWsSubscription(config);
    const first = vi.fn();
    const unsubscribe = ws.subscribe("topic:a", z.unknown(), vi.fn(), first);
    const socket = FakeWebSocket.instances.at(-1);
    socket?.emit("open");
    unsubscribe();
    const second = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), second);

    acknowledge(socket);
    expect(second).not.toHaveBeenCalled();
    acknowledge(socket, "unsubscribe");
    acknowledge(socket);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("waits for the reset acknowledgement barrier before notifying consumers", () => {
    const ws = new DecibelWsSubscription(config);
    const onSubscribed = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), onSubscribed);
    const socket = FakeWebSocket.instances.at(-1);
    socket?.emit("open");
    ws.reset("topic:a");

    acknowledge(socket);
    expect(onSubscribed).not.toHaveBeenCalled();
    acknowledge(socket, "unsubscribe");
    acknowledge(socket);
    expect(onSubscribed).toHaveBeenCalledOnce();

    ws.reset("topic:a");
    const joining = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), joining);
    expect(joining).not.toHaveBeenCalled();
    acknowledge(socket, "unsubscribe");
    acknowledge(socket);
    expect(onSubscribed).toHaveBeenCalledTimes(2);
    expect(joining).toHaveBeenCalledOnce();
  });

  it("does not let retired sockets deliver data, acknowledge, or close the new socket", () => {
    const ws = new DecibelWsSubscription(config);
    const onSubscribed = vi.fn();
    const onData = vi.fn();
    ws.subscribe("topic:a", z.unknown(), onData, onSubscribed);
    const oldSocket = FakeWebSocket.instances.at(-1);
    oldSocket?.emit("open");
    oldSocket?.emit("close");
    vi.advanceTimersByTime(1_000);
    const newSocket = FakeWebSocket.instances.at(-1);
    newSocket?.emit("open");

    acknowledge(oldSocket);
    oldSocket?.emit("message", { data: JSON.stringify({ topic: "topic:a", x: 1 }) });
    oldSocket?.emit("close");
    vi.advanceTimersByTime(1_000);
    expect(onSubscribed).not.toHaveBeenCalled();
    expect(onData).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(ws.readyState()).toBe(WebSocket.OPEN);
    acknowledge(newSocket);
    expect(onSubscribed).toHaveBeenCalledOnce();
  });

  it("waits for the final acknowledgement when a topic is reset twice", () => {
    const ws = new DecibelWsSubscription(config);
    const onSubscribed = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), onSubscribed);
    const socket = FakeWebSocket.instances.at(-1);
    socket?.emit("open");
    ws.reset("topic:a");
    ws.reset("topic:a");

    acknowledge(socket);
    acknowledge(socket, "unsubscribe");
    acknowledge(socket);
    expect(onSubscribed).not.toHaveBeenCalled();
    acknowledge(socket, "unsubscribe");
    acknowledge(socket);
    expect(onSubscribed).toHaveBeenCalledOnce();
  });

  it("notifies a consumer added by another readiness callback only once", () => {
    const ws = new DecibelWsSubscription(config);
    const joining = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), () => {
      ws.subscribe("topic:a", z.unknown(), vi.fn(), joining);
    });
    const socket = FakeWebSocket.instances.at(-1);
    socket?.emit("open");

    acknowledge(socket);

    expect(joining).toHaveBeenCalledOnce();
    expect(socket?.send).toHaveBeenCalledTimes(1);
  });

  it("continues notifying consumers if one readiness callback throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ws = new DecibelWsSubscription(config);
    const second = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), () => {
      throw new Error("consumer failure");
    });
    ws.subscribe("topic:a", z.unknown(), vi.fn(), second);
    const socket = FakeWebSocket.instances.at(-1);
    socket?.emit("open");

    acknowledge(socket);

    expect(second).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("does not reopen a closed subscription from a pending reconnect timer", () => {
    const { ws, socket } = createSubscribed();
    socket()?.emit("open");
    socket()?.emit("close");

    ws.close();
    vi.advanceTimersByTime(30_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("clears readiness on explicit close before a new consumer subscribes", () => {
    const { ws, socket } = createSubscribed();
    const oldSocket = socket();
    oldSocket?.emit("open");
    acknowledge(oldSocket);
    ws.close();
    const onSubscribed = vi.fn();
    ws.subscribe("topic:a", z.unknown(), vi.fn(), onSubscribed);
    const newSocket = socket();

    expect(newSocket).not.toBe(oldSocket);
    acknowledge(oldSocket);
    expect(onSubscribed).not.toHaveBeenCalled();
    newSocket?.emit("open");
    acknowledge(newSocket);
    expect(onSubscribed).toHaveBeenCalledOnce();
  });
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

describe("DecibelWsSubscription.onDisconnect", () => {
  it("notifies immediately on close, before a replacement socket opens", () => {
    const { ws, socket } = createSubscribed();
    const disconnected = vi.fn();
    const reconnected = vi.fn();
    ws.onDisconnect(disconnected);
    ws.onReconnect(reconnected);
    socket()?.emit("open");
    expect(disconnected).not.toHaveBeenCalled();

    socket()?.emit("close");

    expect(disconnected).toHaveBeenCalledOnce();
    expect(ws.readyState()).toBe(WebSocket.CLOSED);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(reconnected).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    socket()?.emit("open");
    expect(disconnected).toHaveBeenCalledOnce();
    expect(reconnected).toHaveBeenCalledOnce();
  });

  it("stops notifying an unregistered listener", () => {
    const { ws, socket } = createSubscribed();
    const listener = vi.fn();
    const unregister = ws.onDisconnect(listener);
    unregister();

    socket()?.emit("close");
    ws.close();

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies once on explicit close and ignores the retired socket", () => {
    const { ws, socket } = createSubscribed();
    const oldSocket = socket();
    const listener = vi.fn();
    ws.onDisconnect(listener);
    oldSocket?.emit("open");

    ws.close();
    ws.close();
    expect(listener).toHaveBeenCalledOnce();
    ws.subscribe("topic:a", z.unknown(), vi.fn());
    socket()?.emit("open");
    oldSocket?.emit("close");
    expect(listener).toHaveBeenCalledOnce();
    expect(ws.readyState()).toBe(WebSocket.OPEN);
    socket()?.emit("close");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not notify again when explicitly closing an already dropped connection", () => {
    const { ws, socket } = createSubscribed();
    const listener = vi.fn();
    ws.onDisconnect(listener);
    socket()?.emit("open");
    socket()?.emit("close");

    ws.close();
    socket()?.emit("close");
    vi.advanceTimersByTime(30_000);

    expect(listener).toHaveBeenCalledOnce();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("defers listeners registered during notification until the next disconnect", () => {
    const { ws, socket } = createSubscribed();
    const joining = vi.fn();
    ws.onDisconnect(() => ws.onDisconnect(joining));

    socket()?.emit("close");
    expect(joining).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    socket()?.emit("open");
    socket()?.emit("close");

    expect(joining).toHaveBeenCalledOnce();
  });

  it("keeps other listeners and reconnection working when a listener throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { ws, socket } = createSubscribed();
    const listener = vi.fn();
    ws.onDisconnect(() => {
      throw new Error("consumer failure");
    });
    ws.onDisconnect(listener);

    socket()?.emit("close");

    expect(listener).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    consoleError.mockRestore();
  });
});

describe("DecibelWsSubscription ack handling", () => {
  it("logs rejected acks instead of dropping them silently", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { socket } = createSubscribed();

    socket()?.emit("message", {
      data: JSON.stringify({
        success: false,
        method: "subscribe",
        topic: "topic:a",
        error: "Unknown topic type 'topic'",
      }),
    });

    expect(consoleError).toHaveBeenCalledOnce();
    const logged = consoleError.mock.calls[0].join(" ");
    expect(logged).toContain("topic:a");
    expect(logged).toContain("Unknown topic type 'topic'");
    consoleError.mockRestore();
  });

  it("stays silent on successful acks", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { socket } = createSubscribed();

    socket()?.emit("message", {
      data: JSON.stringify({ success: true, method: "subscribe", topic: "topic:a" }),
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("still routes data payloads to topic listeners", () => {
    const onData = vi.fn();
    const ws = new DecibelWsSubscription(config);
    ws.subscribe("topic:a", z.object({ x: z.number() }), onData);

    FakeWebSocket.instances
      .at(-1)
      ?.emit("message", { data: JSON.stringify({ topic: "topic:a", x: 1 }) });

    expect(onData).toHaveBeenCalledWith({ x: 1 });
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
