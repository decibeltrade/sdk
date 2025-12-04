import WebSocket, { ErrorEvent } from "isomorphic-ws";
import { z } from "zod/v4";

import { DecibelConfig } from "../constants";
import { bigIntReviver, prettifyMaybeZodError } from "../utils";

export class DecibelWsSubscription {
  constructor(
    readonly config: DecibelConfig,
    readonly onError?: (error: ErrorEvent) => void,
  ) {}

  #ws: WebSocket | null = null;
  #subscriptions = new Map<string, Set<(data: unknown) => void | Promise<void>>>();
  #reconnectAttempts = 0;

  #getSubscribeMessage(topic: string) {
    return JSON.stringify({ Subscribe: { topic } });
  }

  #getUnsubscribeMessage(topic: string) {
    return JSON.stringify({ Unsubscribe: { topic } });
  }

  #parseMessageData(data: WebSocket.Data): { topic: string; data: unknown } | null {
    if (typeof data !== "string") {
      return null;
    }
    try {
      const jsonData: unknown = JSON.parse(data, bigIntReviver);
      if (
        jsonData &&
        typeof jsonData === "object" &&
        "topic" in jsonData &&
        typeof jsonData.topic === "string"
      ) {
        const { topic, ...rest } = jsonData;
        return { topic, data: rest };
      }
      return null;
    } catch {
      return null;
    }
  }

  #open() {
    if (this.#ws) {
      return;
    }

    const ws = new WebSocket(this.config.tradingWsUrl);

    ws.addEventListener("open", () => {
      this.#reconnectAttempts = 0;
      this.#subscriptions.keys().forEach((topic) => {
        ws.send(this.#getSubscribeMessage(topic));
      });
    });

    ws.addEventListener("message", (event) => {
      if (
        typeof event.data === "string" &&
        (event.data.includes("UnsubscribeResponse") || event.data.includes("SubscribeResponse"))
      ) {
        // Ignore response messages for now. Maybe we'll make use of them in the future.
        return;
      }

      const parsedMessage = this.#parseMessageData(event.data);
      if (!parsedMessage) {
        throw new Error("Unhandled WebSocket message:", { cause: event.data });
      }
      const { topic, data } = parsedMessage;
      const listeners = this.#subscriptions.get(topic);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            void listener(data);
          } catch (e) {
            // Log error but don't break other listeners
            console.error(`Error in WebSocket listener for topic : `, topic, " with error : ", e);
          }
        });
      }
    });

    ws.addEventListener("error", (event) => {
      this.onError?.(event);
      ws.close();
    });

    ws.addEventListener("close", () => {
      this.#ws = null;

      // If there are still subscriptions, reconnect.
      if (this.#subscriptions.size > 0) {
        setTimeout(() => this.#open(), Math.pow(1.5, this.#reconnectAttempts) * 1000);
        this.#reconnectAttempts++;
      }
    });

    this.#ws = ws;
  }

  subscribe<TMessageData>(
    topic: string,
    schema: z.ZodType<TMessageData>,
    onData: (data: TMessageData) => void | Promise<void>,
  ) {
    const listeners = this.#subscriptions.get(topic) ?? new Set();

    // If subscription arent found, subscribe to topic first
    if (listeners.size === 0) {
      if (this.#ws?.readyState === WebSocket.OPEN) {
        this.#ws.send(this.#getSubscribeMessage(topic));
      }
    }

    const listener = (data: unknown) => {
      try {
        const parsedData = schema.parse(data);
        void onData(parsedData);
      } catch (e) {
        throw prettifyMaybeZodError(e);
      }
    };

    listeners.add(listener);

    this.#subscriptions.set(topic, listeners);

    // Open the WebSocket. All subscription messages will be sent when the WebSocket is opened.
    if (!this.#ws) {
      this.#open();
    }

    return () => this.unsubscribeByListener(topic, listener);
  }

  private unsubscribe(topic: string) {
    if (!this.#subscriptions.has(topic)) return;

    this.#subscriptions.delete(topic);

    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(this.#getUnsubscribeMessage(topic));
    }

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
  private unsubscribeByListener(topic: string, listener: (data: unknown) => void | Promise<void>) {
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

    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(this.#getUnsubscribeMessage(topic));
      this.#ws.send(this.#getSubscribeMessage(topic));
      return;
    }
  }

  close() {
    this.#subscriptions.clear();
    this.#ws?.close();
  }

  readyState() {
    return this.#ws?.readyState ?? WebSocket.CLOSED;
  }
}
