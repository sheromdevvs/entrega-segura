import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.STORE_DIR = mkdtempSync(join(tmpdir(), "entrega-maintenance-"));
vi.mock("../lib/paypal", () => ({
  refresh: vi.fn(),
  reauthorize: vi.fn(),
  release: vi.fn(),
  cancel: vi.fn(),
  refund: vi.fn(),
}));
const store = await import("../lib/store");
const paypal = await import("../lib/paypal");
const { createOrder } = await import("../lib/orders");
const { maintainOrder, runMaintenance } = await import("../lib/maintenance");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
  vi.mocked(paypal.refresh).mockImplementation(async ({ orderRef }) =>
    store.get(orderRef),
  );
  vi.mocked(paypal.reauthorize).mockImplementation(async ({ orderRef }) => {
    const r = store.get(orderRef);
    r.authorizationId = "RENEWED-AUTH";
    r.authorizationAt = new Date().toISOString();
    return store.save(r);
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
function held(days: number) {
  const r = createOrder("unit");
  r.state = "held";
  r.authorizationId = "AUTH";
  r.authorizationAt = new Date(Date.now() - days * 86400000).toISOString();
  r.originalAuthorizationAt = r.authorizationAt;
  r.captures = [
    { id: "DEPOSIT", role: "deposit", amount: r.deposit, status: "COMPLETED" },
  ];
  return store.save(r);
}
describe("authorization maintenance, no PayPal network", () => {
  it("leaves an authorization inside its honor period unchanged", async () => {
    const r = held(1);
    const result = await maintainOrder(r.ref);
    expect(result.maintenance?.status).toBe("ok");
    expect(paypal.reauthorize).not.toHaveBeenCalled();
  });
  it("renews an eligible aged authorization and preserves original lifetime", async () => {
    const r = held(4),
      original = r.originalAuthorizationAt;
    const result = await maintainOrder(r.ref);
    expect(result.authorizationId).toBe("RENEWED-AUTH");
    expect(result.originalAuthorizationAt).toBe(original);
    expect(result.maintenance?.status).toBe("ok");
    expect(paypal.reauthorize).toHaveBeenCalledTimes(1);
  });
  it("asks the shop near the maximum lifetime instead of silently extending it", async () => {
    const r = held(28);
    const result = await maintainOrder(r.ref);
    expect(result.maintenance?.status).toBe("review");
    expect(result.decisions.at(-1)?.action).toBe("ask_shop");
    expect(paypal.reauthorize).not.toHaveBeenCalled();
    await maintainOrder(r.ref);
    expect(store.get(r.ref).events).toHaveLength(1);
  });
  it("records a review when PayPal renewal fails", async () => {
    const r = held(5);
    vi.mocked(paypal.reauthorize).mockRejectedValueOnce(
      new Error("PayPal unavailable"),
    );
    const result = await maintainOrder(r.ref);
    expect(result.maintenance).toMatchObject({
      status: "review",
      message: "PayPal unavailable",
    });
    expect(result.decisions.at(-1)?.action).toBe("ask_shop");
  });
  it("does not continuously poll already reviewed reservations", async () => {
    const r = held(2);
    await maintainOrder(r.ref);
    vi.mocked(paypal.refresh).mockClear();
    const batch = await runMaintenance();
    expect(batch.results.some((x) => x.ref === r.ref)).toBe(false);
  });
});
