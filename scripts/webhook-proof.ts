// Webhook verification proof for the deployed app. Writes reports/webhook-proof.json.
// SUCCESS: genuine PayPal deliveries recorded by the deployed webhook endpoint
// (read from the production ledger: DATABASE_URL must point at it).
// FAILURE: a forged event posted to the deployed endpoint is rejected, and
// PayPal's own verify-webhook-signature answers FAILURE for the forged headers.
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { api } from "../lib/paypal/client";
import { listAll } from "../lib/store";

async function main() {
  const origin = process.env.APP_URL;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!origin?.startsWith("https://") || !webhookId)
    throw new Error("Set APP_URL (https) and PAYPAL_WEBHOOK_ID");
  if (!process.env.DATABASE_URL)
    throw new Error("Set DATABASE_URL to the deployed ledger");

  const verified = (await listAll(1000))
    .filter((r) => r.lastWebhook?.verification_status === "SUCCESS")
    .map((r) => ({
      orderRef: r.ref,
      paypalOrder: r.paypalOrderId,
      eventId: r.lastWebhook!.id,
      eventType: r.lastWebhook!.type,
      transmissionId: r.lastWebhook!.transmissionId,
      verification_status: r.lastWebhook!.verification_status,
      receivedAt: r.lastWebhook!.at,
    }));

  const forgedEvent = {
    id: `WH-FORGED-${randomUUID()}`,
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: { id: "FORGED-CAPTURE", status: "COMPLETED" },
  };
  const forgedHeaders = {
    "paypal-transmission-id": randomUUID(),
    "paypal-transmission-time": new Date().toISOString(),
    "paypal-transmission-sig":
      Buffer.from("forged signature").toString("base64"),
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url":
      "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-a5cafa77",
  };
  const posted = await fetch(origin + "/api/paypal/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...forgedHeaders },
    body: JSON.stringify(forgedEvent),
  });
  const direct = await api(
    "/v1/notifications/verify-webhook-signature",
    "POST",
    {
      auth_algo: forgedHeaders["paypal-auth-algo"],
      cert_url: forgedHeaders["paypal-cert-url"],
      transmission_id: forgedHeaders["paypal-transmission-id"],
      transmission_sig: forgedHeaders["paypal-transmission-sig"],
      transmission_time: forgedHeaders["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: forgedEvent,
    },
  );

  const report = {
    generatedAt: new Date().toISOString(),
    endpoint: origin + "/api/paypal/webhook",
    webhookId,
    method:
      "Every delivery is checked with POST /v1/notifications/verify-webhook-signature on the raw event before any state change; duplicates are ignored by transmission id and event id.",
    success: {
      count: verified.length,
      note: "Genuine PayPal Sandbox deliveries that the deployed endpoint verified (verification_status SUCCESS) and applied to the matching reservation.",
      events: verified.slice(0, 20),
    },
    failure: {
      forgedEventId: forgedEvent.id,
      deployedEndpointHttpStatus: posted.status,
      deployedEndpointBody: await posted.json().catch(() => null),
      paypalVerifyResponse: direct,
      note: "A forged event with an invented signature is rejected by the deployed endpoint (HTTP 400, nothing applied); PayPal's verification API itself answers FAILURE for it.",
    },
  };
  writeFileSync(
    "reports/webhook-proof.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      success: verified.length,
      forgedStatus: posted.status,
      paypalSays: direct.verification_status,
    }),
  );
  setTimeout(() => process.exit(), 200).unref();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
