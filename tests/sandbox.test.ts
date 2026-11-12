import { describe, it, expect, beforeAll } from "vitest";
import { api, token, requestId } from "../lib/paypal/client";
import { createOrder } from "../lib/orders";
import {
  hold,
  completeApproval,
  release,
  cancel,
  refund,
  reauthorize,
} from "../lib/paypal";
import type { Reservation } from "../lib/types";
import { get } from "../lib/store";
const enabled =
  process.env.RUN_SANDBOX_TESTS === "1" &&
  !!process.env.PAYPAL_CLIENT_ID &&
  !!process.env.PAYPAL_CLIENT_SECRET;
describe.skipIf(!enabled)("real PayPal Sandbox (network, no mocks)", () => {
  let order: Reservation;
  beforeAll(async () => {
    const r = createOrder("integration-test");
    order = await hold({
      orderRef: r.ref,
      total: r.total,
      depositNow: r.deposit,
      currency: r.currency,
    });
    console.log("SANDBOX ORDER", order.paypalOrderId);
  });
  it("OAuth returns a usable token", async () =>
    expect((await token()).length).toBeGreaterThan(20));
  it("creates an actual AUTHORIZE order", async () => {
    const d = await api(`/v2/checkout/orders/${order.paypalOrderId}`);
    expect(d.intent).toBe("AUTHORIZE");
    expect(d.id).toBe(order.paypalOrderId);
    console.log("PAYPAL ID", d.id);
  });
  it("retrieves exact order amount", async () => {
    const d = await api(`/v2/checkout/orders/${order.paypalOrderId}`);
    expect(d.purchase_units[0].amount).toMatchObject({
      currency_code: "USD",
      value: "24.00",
    });
  });
  it("replayed create is idempotent at PayPal", async () => {
    const r = await fetch(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await token()}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": requestId(order.ref, "hold", order.total),
        },
        body: JSON.stringify({
          intent: "AUTHORIZE",
          purchase_units: [
            { amount: { currency_code: "USD", value: "24.00" } },
          ],
        }),
      },
    );
    const d = await r.json();
    expect(r.ok).toBe(true);
    expect(d.id).toBe(order.paypalOrderId);
    console.log("PAYPAL REPLAY ID", d.id);
  });
  it("unapproved order cannot authorize", async () => {
    await expect(
      api(
        `/v2/checkout/orders/${order.paypalOrderId}/authorize`,
        "POST",
        {},
        { ref: order.ref, verb: "test-unapproved" },
      ),
    ).rejects.toThrow(/ORDER_NOT_APPROVED/);
  });
  it("unknown authorization returns a real PayPal error", async () => {
    await expect(
      api("/v2/payments/authorizations/INVALID_AUTH_123"),
    ).rejects.toThrow(/PayPal (404|422)/);
  });
  it("can list actual application webhook subscriptions", async () => {
    const d = await api("/v1/notifications/webhooks");
    expect(Array.isArray(d.webhooks)).toBe(true);
    console.log(
      "REGISTERED WEBHOOK IDS",
      d.webhooks.map((x: any) => x.id),
    );
  });
  it("creates another independent sandbox order", async () => {
    const r = createOrder("integration-test", "mug");
    const d = await hold({
      orderRef: r.ref,
      total: r.total,
      depositNow: r.deposit,
      currency: r.currency,
    });
    expect(d.paypalOrderId).not.toBe(order.paypalOrderId);
    console.log("SECOND PAYPAL ID", d.paypalOrderId);
  });
});
const approved = enabled && !!process.env.SANDBOX_APPROVED_ORDER_ID;
describe.skipIf(!approved)(
  "approved sandbox lifecycle (requires externally approved PayPal order)",
  () => {
    it("authorizes and partially captures deposit", async () => {
      const ref = process.env.SANDBOX_APPROVED_ORDER_ID!;
      const r = await completeApproval({ orderRef: ref });
      expect(r.captures[0].status).toBe("COMPLETED");
      console.log("DEPOSIT", r.captures[0].id);
    });
    it("captures remaining balance with final_capture true", async () => {
      const r = await release({
        orderRef: process.env.SANDBOX_APPROVED_ORDER_ID!,
      });
      expect(r.state).toBe("released");
      console.log("BALANCE", r.captures.find((x) => x.role === "balance")?.id);
    });
    it("repeated release preserves one balance capture", async () => {
      const ref = process.env.SANDBOX_APPROVED_ORDER_ID!;
      await Promise.all([
        release({ orderRef: ref }),
        release({ orderRef: ref }),
      ]);
      expect(
        get(ref).captures.filter((x) => x.role === "balance"),
      ).toHaveLength(1);
    });
  },
);
