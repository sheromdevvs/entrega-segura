import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.STORE_DIR = mkdtempSync(join(tmpdir(), "entrega-outbox-"));
const store = await import("../lib/store");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());
describe("persistent callback retry schedule", () => {
  it("deduplicates callback IDs", () => {
    store.enqueueNotification(
      "callback-a",
      JSON.stringify({ orderRef: "ORDER-A" }),
    );
    store.enqueueNotification(
      "callback-a",
      JSON.stringify({ orderRef: "ORDER-A" }),
    );
    expect(store.pendingNotifications("ORDER-A")).toHaveLength(1);
  });
  it("backs off failures rather than retrying on every poll", () => {
    store.enqueueNotification(
      "callback-b",
      JSON.stringify({ orderRef: "ORDER-B" }),
    );
    store.failedNotification("callback-b", "HTTP 503");
    expect(store.pendingNotifications("ORDER-B")).toHaveLength(0);
    vi.advanceTimersByTime(30001);
    expect(store.pendingNotifications("ORDER-B")).toHaveLength(1);
    store.failedNotification("callback-b", "HTTP 503");
    vi.advanceTimersByTime(30001);
    expect(store.pendingNotifications("ORDER-B")).toHaveLength(0);
    vi.advanceTimersByTime(30001);
    expect(store.pendingNotifications("ORDER-B")).toHaveLength(1);
  });
  it("lets the owner retry one reservation without releasing another queue", () => {
    store.enqueueNotification(
      "callback-c",
      JSON.stringify({ orderRef: "ORDER-C" }),
    );
    store.enqueueNotification(
      "callback-d",
      JSON.stringify({ orderRef: "ORDER-D" }),
    );
    store.failedNotification("callback-c", "offline");
    store.failedNotification("callback-d", "offline");
    store.retryNotificationsFor("ORDER-C");
    expect(store.pendingNotifications("ORDER-C")).toHaveLength(1);
    expect(store.pendingNotifications("ORDER-D")).toHaveLength(0);
  });
  it("removes acknowledged callbacks from pending delivery", () => {
    store.enqueueNotification(
      "callback-e",
      JSON.stringify({ orderRef: "ORDER-E" }),
    );
    store.deliveredNotification("callback-e");
    expect(store.pendingNotifications("ORDER-E")).toHaveLength(0);
  });
});
