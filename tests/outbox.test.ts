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
  it("deduplicates callback IDs", async () => {
    await store.enqueueNotification(
      "callback-a",
      JSON.stringify({ orderRef: "ORDER-A" }),
    );
    await store.enqueueNotification(
      "callback-a",
      JSON.stringify({ orderRef: "ORDER-A" }),
    );
    expect(await store.pendingNotifications("ORDER-A")).toHaveLength(1);
  });
  it("backs off failures rather than retrying on every poll", async () => {
    await store.enqueueNotification(
      "callback-b",
      JSON.stringify({ orderRef: "ORDER-B" }),
    );
    await store.failedNotification("callback-b", "HTTP 503");
    expect(await store.pendingNotifications("ORDER-B")).toHaveLength(0);
    vi.advanceTimersByTime(30001);
    expect(await store.pendingNotifications("ORDER-B")).toHaveLength(1);
    await store.failedNotification("callback-b", "HTTP 503");
    vi.advanceTimersByTime(30001);
    expect(await store.pendingNotifications("ORDER-B")).toHaveLength(0);
    vi.advanceTimersByTime(30001);
    expect(await store.pendingNotifications("ORDER-B")).toHaveLength(1);
  });
  it("lets the owner retry one reservation without releasing another queue", async () => {
    await store.enqueueNotification(
      "callback-c",
      JSON.stringify({ orderRef: "ORDER-C" }),
    );
    await store.enqueueNotification(
      "callback-d",
      JSON.stringify({ orderRef: "ORDER-D" }),
    );
    await store.failedNotification("callback-c", "offline");
    await store.failedNotification("callback-d", "offline");
    await store.retryNotificationsFor("ORDER-C");
    expect(await store.pendingNotifications("ORDER-C")).toHaveLength(1);
    expect(await store.pendingNotifications("ORDER-D")).toHaveLength(0);
  });
  it("removes acknowledged callbacks from pending delivery", async () => {
    await store.enqueueNotification(
      "callback-e",
      JSON.stringify({ orderRef: "ORDER-E" }),
    );
    await store.deliveredNotification("callback-e");
    expect(await store.pendingNotifications("ORDER-E")).toHaveLength(0);
  });
});
