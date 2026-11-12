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
    const r = await createOrder("integration-test");
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
    const r = await createOrder("integration-test", "mug");
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
// Buyer = PayPal's published sandbox test card (Orders v2 payment_source.card),
// so the full money lifecycle runs without a browser approval.
describe.skipIf(!enabled)(
  "card-funded sandbox lifecycle (real captures, void, refund)",
  () => {
    let ref: string;
    async function cardOrder(productId = "hoodie") {
      const r = await createOrder(
        "integration-test",
        productId,
        "judge",
        undefined,
        "single",
        "sandbox_card",
      );
      await hold({
        orderRef: r.ref,
        total: r.total,
        depositNow: r.deposit,
        currency: r.currency,
      });
      return r.ref;
    }
    it("authorizes the full amount and captures the deposit with final_capture false", async () => {
      ref = await cardOrder();
      const r = await completeApproval({ orderRef: ref });
      expect(r.state).toBe("held");
      expect(r.captures).toHaveLength(1);
      expect(r.captures[0]).toMatchObject({
        role: "deposit",
        status: "COMPLETED",
        amount: 1200,
      });
      const auth = await api(
        `/v2/payments/authorizations/${r.authorizationId}`,
      );
      expect(auth.status).toBe("PARTIALLY_CAPTURED");
      console.log("AUTH", r.authorizationId, "DEPOSIT", r.captures[0].id);
    });
    it("captures the remaining balance with final_capture true", async () => {
      const r = await release({ orderRef: ref });
      expect(r.state).toBe("released");
      const auth = await api(
        `/v2/payments/authorizations/${r.authorizationId}`,
      );
      expect(auth.status).toBe("CAPTURED");
      console.log("BALANCE", r.captures.find((x) => x.role === "balance")?.id);
    });
    it("repeated concurrent release preserves one balance capture", async () => {
      await Promise.all([
        release({ orderRef: ref }),
        release({ orderRef: ref }),
      ]);
      expect(
        (await get(ref)).captures.filter((x) => x.role === "balance"),
      ).toHaveLength(1);
    });
    it("refusal voids the remaining authorization and keeps the deposit", async () => {
      const voidRef = await cardOrder("mug");
      await completeApproval({ orderRef: voidRef });
      const r = await cancel({ orderRef: voidRef });
      expect(r.state).toBe("voided");
      const auth = await api(
        `/v2/payments/authorizations/${r.authorizationId}`,
      );
      expect(auth.status).toBe("VOIDED");
      console.log("VOIDED", r.authorizationId);
    });
    it("refunds part of a completed capture exactly once", async () => {
      const r1 = await refund({
        orderRef: ref,
        amount: 300,
        reason: "Sandbox test",
      });
      const r2 = await refund({ orderRef: ref, amount: 300, reason: "Retry" });
      expect(r1.refunds).toHaveLength(1);
      expect(r2.refunds[0].id).toBe(r1.refunds[0].id);
      console.log("REFUND", r1.refunds[0].id, r1.refunds[0].status);
    });
  },
);
