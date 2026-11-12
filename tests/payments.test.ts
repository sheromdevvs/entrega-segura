import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.STORE_DIR = mkdtempSync(join(tmpdir(), "entrega-tests-"));
process.env.PAYPAL_CLIENT_ID = "test-client";
process.env.PAYPAL_CLIENT_SECRET = "test-secret";
process.env.PAYPAL_ENV = "sandbox";
const store = await import("../lib/store");
const paypal = await import("../lib/paypal");
const { processEvent } = await import("../lib/orders");
const { createOrder } = await import("../lib/orders");
let calls: { path: string; method: string; body: any; requestId?: string }[] =
  [];
let failCapture = false;
let pendingCapture = false;
let captureIndex = 0;
beforeEach(() => {
  calls = [];
  failCapture = false;
  pendingCapture = false;
  captureIndex = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: any = {}) => {
      const path = new URL(url).pathname;
      const body = options.body
        ? JSON.parse(
            options.body === "grant_type=client_credentials"
              ? "{}"
              : options.body,
          )
        : undefined;
      calls.push({
        path,
        method: options.method || "GET",
        body,
        requestId: options.headers?.["PayPal-Request-Id"],
      });
      if (path === "/v1/oauth2/token")
        return Response.json({
          access_token: "fake-token-for-unit-tests",
          expires_in: 3600,
        });
      if (path.endsWith("/reauthorize"))
        return Response.json(
          { id: "NEW-AUTH", create_time: new Date().toISOString() },
          { status: 201 },
        );
      if (path.endsWith("/capture")) {
        if (failCapture)
          return Response.json({ name: "INTERNAL_ERROR" }, { status: 500 });
        return Response.json(
          {
            id: `CAP-${++captureIndex}`,
            status: pendingCapture ? "PENDING" : "COMPLETED",
          },
          { status: 201 },
        );
      }
      if (path.endsWith("/void")) return new Response(null, { status: 204 });
      if (path.endsWith("/refund"))
        return Response.json(
          { id: "REF-1", status: "COMPLETED" },
          { status: 201 },
        );
      if (path.endsWith("/authorize"))
        return Response.json(
          {
            purchase_units: [
              {
                payments: {
                  authorizations: [
                    { id: "AUTH-1", create_time: new Date().toISOString() },
                  ],
                },
              },
            ],
          },
          { status: 201 },
        );
      return Response.json({ id: "ORDER-1", status: "APPROVED" });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
async function ready() {
  const r = await createOrder("unit");
  r.state = "held";
  r.paypalOrderId = "ORDER-1";
  r.authorizationId = "AUTH-1";
  r.authorizationAt = new Date().toISOString();
  r.originalAuthorizationAt = r.authorizationAt;
  r.captures = [
    { id: "DEP-1", amount: r.deposit, status: "COMPLETED", role: "deposit" },
  ];
  return await store.save(r);
}
describe("money lifecycle safety", () => {
  it("captures deposit partially, with final_capture false", async () => {
    const r = await createOrder("unit");
    r.paypalOrderId = "ORDER-1";
    await store.save(r);
    const d = await paypal.completeApproval({ orderRef: r.ref });
    expect(d.state).toBe("held");
    expect(calls.find((x) => x.path.endsWith("/capture"))?.body).toMatchObject({
      amount: { value: "12.00" },
      final_capture: false,
    });
  });
  it("does not expose a pending deposit as ready to ship", async () => {
    pendingCapture = true;
    const r = await createOrder("unit");
    r.paypalOrderId = "ORDER-1";
    await store.save(r);
    const d = await paypal.completeApproval({ orderRef: r.ref });
    expect(d.state).toBe("deposit_pending");
    await expect(paypal.release({ orderRef: r.ref })).rejects.toThrow(
      "not ready",
    );
  });
  it("captures exact balance with final_capture true", async () => {
    const r = await ready();
    const d = await paypal.release({ orderRef: r.ref });
    expect(d.state).toBe("released");
    expect(calls.find((x) => x.path.endsWith("/capture"))?.body).toMatchObject({
      amount: { value: "12.00" },
      final_capture: true,
    });
  });
  it("concurrent deliveries capture the balance once", async () => {
    const r = await ready();
    await Promise.all(
      Array.from({ length: 20 }, () => paypal.release({ orderRef: r.ref })),
    );
    expect(calls.filter((x) => x.path.endsWith("/capture"))).toHaveLength(1);
    expect(
      (await store.get(r.ref)).captures.filter((x) => x.role === "balance"),
    ).toHaveLength(1);
  });
  it("cannot cancel after a balance capture", async () => {
    const r = await ready();
    await paypal.release({ orderRef: r.ref });
    await expect(paypal.cancel({ orderRef: r.ref })).rejects.toThrow(
      "cannot be voided",
    );
  });
  it("refusal voids only the remaining authorization", async () => {
    const r = await ready();
    const d = await paypal.cancel({ orderRef: r.ref });
    expect(d.state).toBe("voided");
    expect(d.captures).toHaveLength(1);
    await paypal.cancel({ orderRef: r.ref });
    expect(calls.filter((x) => x.path.endsWith("/void"))).toHaveLength(1);
  });
  it("refunds once and rejects a changed amount", async () => {
    const r = await ready();
    await paypal.refund({ orderRef: r.ref, amount: 300, reason: "Reviewed" });
    await paypal.refund({ orderRef: r.ref, amount: 300, reason: "Retry" });
    await expect(
      paypal.refund({ orderRef: r.ref, amount: 400, reason: "Changed" }),
    ).rejects.toThrow("already exists");
    expect(calls.filter((x) => x.path.endsWith("/refund"))).toHaveLength(1);
  });
  it("reauthorizes an aged hold for the remaining amount", async () => {
    const r = await ready();
    r.authorizationAt = new Date(Date.now() - 4 * 86400000).toISOString();
    r.originalAuthorizationAt = r.authorizationAt;
    await store.save(r);
    const d = await paypal.release({ orderRef: r.ref });
    expect(d.authorizationId).toBe("NEW-AUTH");
    expect(
      calls.find((x) => x.path.endsWith("/reauthorize"))?.body.amount.value,
    ).toBe("12.00");
    expect(
      calls.some(
        (x) => x.path === "/v2/payments/authorizations/NEW-AUTH/capture",
      ),
    ).toBe(true);
  });
  it("refuses reauthorization beyond the original 29-day lifetime", async () => {
    const r = await ready();
    r.authorizationAt = new Date(Date.now() - 4 * 86400000).toISOString();
    r.originalAuthorizationAt = new Date(
      Date.now() - 30 * 86400000,
    ).toISOString();
    await store.save(r);
    await expect(paypal.release({ orderRef: r.ref })).rejects.toThrow(
      "expired",
    );
    expect(calls).toHaveLength(0);
  });
  it("retries a failed event using the same PayPal request ID", async () => {
    const r = await ready();
    failCapture = true;
    const e = {
      id: "delivery",
      kind: "delivered" as const,
      at: new Date().toISOString(),
      source: "chat" as const,
      text: "Recibido",
      code: r.code,
    };
    await expect(processEvent(r.ref, e)).rejects.toThrow("INTERNAL_ERROR");
    expect((await store.get(r.ref)).events[0].applied).toBe(false);
    failCapture = false;
    await processEvent(r.ref, e);
    expect((await store.get(r.ref)).state).toBe("released");
    const captures = calls.filter((x) => x.path.endsWith("/capture"));
    expect(captures).toHaveLength(2);
    expect(captures[0].requestId).toBe(captures[1].requestId);
    await processEvent(r.ref, e);
    expect(calls.filter((x) => x.path.endsWith("/capture"))).toHaveLength(2);
  });
});
