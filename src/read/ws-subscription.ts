/** Shares one reconnecting socket across topics and exposes ACKs so consumers can recover missed history over HTTP. */
import WebSocket, { ErrorEvent } from "isomorphic-ws";
import { z } from "zod/v4";

import { DecibelConfig } from "../constants";
import { bigIntReviver, prettifyMaybeZodError } from "../utils";

interface SubscriptionListener {
  onData: (data: unknown) => void | Promise<void>;
  onSubscribed?: () => void;
}

export class DecibelWsSubscription {
  constructor(
    readonly config: DecibelConfig,
    readonly apiKey?: string,
    readonly onError?: (error: ErrorEvent) => void,
  ) {}

  #ws: WebSocket | null = null;
  #subscriptions = new Map<string, Set<SubscriptionListener>>();
  #readyTopics = new Set<string>();
  // Unsubscribe ACKs separate old subscribe responses from a reset or rejoin.
  #pendingUnsubscribes = new Map<string, number>();
  #reconnectAttempts = 0;
  #reconnectListeners = new Set<() => void>();
  #disconnectListeners = new Set<() => void>();
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  #getSubscribeMessage(topic: string) {
    return JSON.stringify({ method: "subscribe", topic });
  }

  #getUnsubscribeMessage(topic: string) {
    return JSON.stringify({ method: "unsubscribe", topic });
  }

  #sendUnsubscribe(topic: string) {
    if (this.#ws?.readyState !== WebSocket.OPEN) return;
    this.#pendingUnsubscribes.set(topic, (this.#pendingUnsubscribes.get(topic) ?? 0) + 1);
    this.#ws.send(this.#getUnsubscribeMessage(topic));
  }

  #notifySubscribed(topic: string, listener: SubscriptionListener) {
    try {
      listener.onSubscribed?.();
    } catch (error) {
      console.error("Error in WebSocket subscription callback for topic:", topic, error);
    }
  }

  #handleAcknowledgement(topic: string, method: unknown, success: unknown) {
    if (method === "unsubscribe") {
      const pending = this.#pendingUnsubscribes.get(topic) ?? 0;
      if (pending <= 1) this.#pendingUnsubscribes.delete(topic);
      else this.#pendingUnsubscribes.set(topic, pending - 1);
      return;
    }
    if (
      method !== "subscribe" ||
      success !== true ||
      this.#pendingUnsubscribes.has(topic) ||
      this.#readyTopics.has(topic)
    ) {
      return;
    }

    const listeners = this.#subscriptions.get(topic);
    if (!listeners) return;
    this.#readyTopics.add(topic);
    for (const listener of [...listeners]) {
      if (listeners.has(listener) && this.#readyTopics.has(topic)) {
        this.#notifySubscribed(topic, listener);
      }
    }
  }

  #parseMessageData(data: WebSocket.Data): { topic: string; data: unknown } | null {
    if (typeof data !== "string") {
      throw new Error("Unhandled WebSocket message: expected string data", { cause: data });
    }

    let jsonData: unknown;
    try {
      jsonData = JSON.parse(data, bigIntReviver);
    } catch {
      throw new Error("Unhandled WebSocket message: failed to parse JSON", { cause: data });
    }

    if (
      jsonData &&
      typeof jsonData === "object" &&
      "topic" in jsonData &&
      typeof jsonData.topic === "string"
    ) {
      // Control replies carry success; event payloads do not.
      if ("success" in jsonData) {
        this.#handleAcknowledgement(
          jsonData.topic,
          "method" in jsonData ? jsonData.method : undefined,
          jsonData.success,
        );
        // A rejected subscribe means the topic will never deliver — surface it.
        if (jsonData.success === false) {
          const error = "error" in jsonData ? jsonData.error : "unknown error";
          console.error("WebSocket request rejected for topic:", jsonData.topic, error);
        }
        return null;
      }
      const { topic, ...rest } = jsonData;
      return { topic, data: rest };
    }
    throw new Error("Unhandled WebSocket message: missing topic field", { cause: data });
  }

  #notifyDisconnected() {
    for (const listener of [...this.#disconnectListeners]) {
      if (!this.#disconnectListeners.has(listener)) continue;
      try {
        listener();
      } catch (error) {
        console.error("Error in WebSocket disconnect callback:", error);
      }
    }
  }

  #open() {
    if (this.#ws || this.#subscriptions.size === 0) {
      return;
    }
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;

    const extra = this.config.additionalHeaders;
    // When additionalHeaders are set (server-side), pass them as HTTP upgrade
    // headers instead of using API key subprotocol auth. The `ws` library
    // (Node.js) supports a third `options` argument with `headers`.
    const ws = extra
      ? new WebSocket(this.config.tradingWsUrl, ["decibel"], {
          headers: extra,
        })
      : new WebSocket(this.config.tradingWsUrl, this.apiKey ? ["decibel", this.apiKey] : undefined);

    ws.addEventListener("open", () => {
      if (this.#ws !== ws) return;
      const isReconnect = this.#reconnectAttempts > 0;
      this.#reconnectAttempts = 0;
      for (const topic of this.#subscriptions.keys()) {
        ws.send(this.#getSubscribeMessage(topic));
      }
      if (isReconnect) {
        this.#reconnectListeners.forEach((listener) => listener());
      }
    });

    ws.addEventListener("message", (event: WebSocket.MessageEvent) => {
      if (this.#ws !== ws) return;
      const parsedMessage = this.#parseMessageData(event.data);
      if (!parsedMessage) {
        return;
      }
      const { topic, data } = parsedMessage;
      const listeners = this.#subscriptions.get(topic);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            void listener.onData(data);
          } catch (e) {
            // Log error but don't break other listeners
            console.error(`Error in WebSocket listener for topic : `, topic, " with error : ", e);
          }
        });
      }
    });

    ws.addEventListener("error", (event) => {
      if (this.#ws !== ws) return;
      this.onError?.(event);
      ws.close();
    });

    ws.addEventListener("close", () => {
      if (this.#ws !== ws) return;
      this.#ws = null;
      this.#readyTopics.clear();
      this.#pendingUnsubscribes.clear();
      this.#notifyDisconnected();

      // If there are still subscriptions, reconnect.
      if (this.#subscriptions.size > 0) {
        this.#reconnectTimer = setTimeout(
          () => this.#open(),
          Math.min(Math.pow(1.5, this.#reconnectAttempts) * 1000, 30_000),
        );
        this.#reconnectAttempts++;
      }
    });

    this.#ws = ws;
  }

  /**
   * Fires after a dropped connection is re-established and subscribe frames are
   * re-sent. Streaming-only topics get no replay of events missed during the
   * outage — re-seed their state over HTTP from this callback.
   */
  onReconnect(listener: () => void): () => void {
    this.#reconnectListeners.add(listener);
    return () => this.#reconnectListeners.delete(listener);
  }

  /** Fires when the current socket closes, including explicit close. */
  onDisconnect(listener: () => void): () => void {
    this.#disconnectListeners.add(listener);
    return () => this.#disconnectListeners.delete(listener);
  }

  /** onSubscribed permits HTTP reconciliation after each ACK; it provides no replay or sequence boundary. */
  subscribe<TMessageData>(
    topic: string,
    schema: z.ZodType<TMessageData>,
    onData: (data: TMessageData) => void | Promise<void>,
    onSubscribed?: () => void,
  ) {
    const listeners = this.#subscriptions.get(topic) ?? new Set<SubscriptionListener>();

    if (listeners.size === 0) {
      if (this.#ws?.readyState === WebSocket.OPEN) {
        this.#ws.send(this.#getSubscribeMessage(topic));
      }
    }

    const listener: SubscriptionListener = {
      onData: (data: unknown) => {
        try {
          const parsedData = schema.parse(data);
          void onData(parsedData);
        } catch (e) {
          throw prettifyMaybeZodError(e);
        }
      },
      onSubscribed,
    };

    listeners.add(listener);

    this.#subscriptions.set(topic, listeners);

    // Open the WebSocket. All subscription messages will be sent when the WebSocket is opened.
    if (!this.#ws) {
      this.#open();
    }
    if (this.#readyTopics.has(topic)) {
      this.#notifySubscribed(topic, listener);
    }

    return () => this.unsubscribeByListener(topic, listener);
  }

  private unsubscribe(topic: string) {
    if (!this.#subscriptions.has(topic)) return;

    this.#subscriptions.delete(topic);
    this.#readyTopics.delete(topic);
    this.#sendUnsubscribe(topic);

    // Close the WebSocket if the last subscription was removed.
    if (this.#subscriptions.size === 0) {
      // Set a timeout in case the last unsubscribe is immediately followed by a new subscription.
      setTimeout(() => {
        // Check subscriptions one more time before closing.
        if (this.#subscriptions.size === 0) {
          this.#ws?.close();
        }
      }, 500);
    }
  }

  /**
   * Removes the specified listener from the set of listeners for the given topic.
   * If no listeners remain for the topic after removal, unsubscribes from the topic.
   * If all subscriptions are removed, closes the WebSocket connection.
   */
  private unsubscribeByListener(topic: string, listener: SubscriptionListener) {
    if (this.#subscriptions.has(topic)) {
      const listeners = this.#subscriptions.get(topic);

      if (!listeners) return;

      // Remove the specified listener
      listeners.delete(listener);

      // If no listeners remain for the topic, unsubscribe from the topic
      if (listeners.size === 0) {
        this.unsubscribe(topic);
      }
      // Otherwise, update the listeners set for the topic
      else {
        this.#subscriptions.set(topic, listeners);
      }
    }
  }

  reset(topic: string) {
    if (!this.#subscriptions.has(topic)) {
      return;
    }
    this.#readyTopics.delete(topic);

    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#sendUnsubscribe(topic);
      this.#ws.send(this.#getSubscribeMessage(topic));
      return;
    }
  }

  close() {
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;
    this.#reconnectAttempts = 0;
    this.#subscriptions.clear();
    this.#readyTopics.clear();
    this.#pendingUnsubscribes.clear();
    const ws = this.#ws;
    this.#ws = null;
    if (ws) this.#notifyDisconnected();
    ws?.close();
  }

  readyState() {
    return this.#ws?.readyState ?? WebSocket.CLOSED;
  }
}
