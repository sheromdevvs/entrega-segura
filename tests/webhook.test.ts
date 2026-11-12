import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.STORE_DIR = mkdtempSync(join(tmpdir(), "entrega-hook-tests-"));
process.env.PAYPAL_CLIENT_ID = "test";
process.env.PAYPAL_CLIENT_SECRET = "test";
process.env.PAYPAL_WEBHOOK_ID = "HOOK-TEST";
const { handleWebhook } = await import("../lib/paypal/webhook");
const { createOrder } = await import("../lib/orders");
const { save, get } = await import("../lib/store");
let verification = "SUCCESS";
let verifyBody: any;
beforeEach(() => {
  verification = "SUCCESS";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: any) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/token"))
        return Response.json({ access_token: "fake", expires_in: 3600 });
      if (path.includes("verify-webhook-signature")) {
        verifyBody = JSON.parse(options.body);
        return Response.json({ verification_status: verification });
      }
      return Response.json({});
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
const headers = (id = "TX-1") =>
  new Headers({
    "paypal-transmission-id": id,
    "paypal-transmission-time": new Date().toISOString(),
    "paypal-transmission-sig": "test-signature",
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.paypal.com/test-cert",
  });
describe("webhook trust boundary (verification API mocked)", () => {
  it("rejects a failed verification before mutating any state", async () => {
    verification = "FAILURE";
    await expect(
      handleWebhook(
        JSON.stringify({
          id: "EV-FAIL",
          event_type: "PAYMENT.AUTHORIZATION.VOIDED",
          resource: { id: "AUTH" },
        }),
        headers(),
      ),
    ).rejects.toThrow("verification failed");
  });
  it("submits the received event and transmission headers to PayPal", async () => {
    const event = {
      id: "EV-HEADERS",
      event_type: "UNHANDLED.EVENT",
      resource: { id: "NONE" },
    };
    await handleWebhook(JSON.stringify(event), headers("TX-HEADERS"));
    expect(verifyBody.webhook_event).toEqual(event);
    expect(verifyBody.webhook_id).toBe("HOOK-TEST");
    expect(verifyBody.transmission_id).toBe("TX-HEADERS");
  });
  it("deduplicates event IDs even with a different transmission ID", async () => {
    const event = JSON.stringify({
      id: "EV-DUP",
      event_type: "UNHANDLED.EVENT",
      resource: {},
    });
    expect((await handleWebhook(event, headers("TX-A"))).duplicate).toBe(false);
    expect((await handleWebhook(event, headers("TX-B"))).duplicate).toBe(true);
  });
  it("records successful verification and applies authorization void", async () => {
    const r = await createOrder("unit");
    r.authorizationId = "AUTH-VOID";
    r.state = "held";
    await save(r);
    await handleWebhook(
      JSON.stringify({
        id: "EV-VOID",
        event_type: "PAYMENT.AUTHORIZATION.VOIDED",
        resource: { id: "AUTH-VOID" },
      }),
      headers("TX-VOID"),
    );
    expect((await get(r.ref)).state).toBe("voided");
    expect((await get(r.ref)).lastWebhook?.verification_status).toBe("SUCCESS");
  });
  it("an old authorization event cannot void its replacement", async () => {
    const r = await createOrder("unit");
    r.authorizationId = "AUTH-NEW";
    r.paypalOrderId = "ORDER-REAUTH";
    r.state = "held";
    await save(r);
    await handleWebhook(
      JSON.stringify({
        id: "EV-OLD",
        event_type: "PAYMENT.AUTHORIZATION.VOIDED",
        resource: {
          id: "AUTH-OLD",
          supplementary_data: { related_ids: { order_id: "ORDER-REAUTH" } },
        },
      }),
      headers("TX-OLD"),
    );
    expect((await get(r.ref)).state).toBe("held");
  });
  it("a late void cannot roll back a completed balance capture", async () => {
    const r = await createOrder("unit");
    r.authorizationId = "AUTH-LATE";
    r.state = "released";
    r.captures = [
      { id: "CAP-LATE", role: "balance", amount: 1200, status: "COMPLETED" },
    ];
    await save(r);
    await handleWebhook(
      JSON.stringify({
        id: "EV-LATE",
        event_type: "PAYMENT.AUTHORIZATION.VOIDED",
        resource: { id: "AUTH-LATE" },
      }),
      headers("TX-LATE"),
    );
    expect((await get(r.ref)).state).toBe("released");
  });
});
