import { api } from "./client";
import {
  byPayPalId,
  save,
  get,
  recordWebhook,
  locked,
  webhookSeen,
} from "../store";
import { completeApproval, refresh } from "./index";
import { notifyShop } from "../orders";
export const webhookTypes = [
  "PAYMENT.AUTHORIZATION.CREATED",
  "PAYMENT.AUTHORIZATION.VOIDED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.REFUNDED",
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.PAYOUTSBATCH.SUCCESS",
  "PAYMENT.PAYOUTSBATCH.DENIED",
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
  "PAYMENT.PAYOUTS-ITEM.FAILED",
];
export async function handleWebhook(raw: string, headers: Headers) {
  if (!process.env.PAYPAL_WEBHOOK_ID)
    throw new Error("PAYPAL_WEBHOOK_ID is not configured");
  const event = JSON.parse(raw);
  const transmissionId = headers.get("paypal-transmission-id");
  if (!transmissionId || !event.id)
    throw new Error("Missing webhook identifiers");
  const verification = await api(
    "/v1/notifications/verify-webhook-signature",
    "POST",
    {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: transmissionId,
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    },
    { ref: event.id, verb: "verify-webhook", log: false },
  );
  if (verification.verification_status !== "SUCCESS")
    throw new Error("Webhook signature verification failed");
  console.log(
    JSON.stringify({
      service: "paypal-webhook",
      verification_status: "SUCCESS",
      transmissionId,
      eventId: event.id,
      type: event.event_type,
    }),
  );
  return locked(`webhook:${event.id}`, async () => {
    if (await webhookSeen(transmissionId, event.id))
      return { verification_status: "SUCCESS", duplicate: true, matched: true };
    const ids = [
      event.resource?.id,
      event.resource?.supplementary_data?.related_ids?.order_id,
      event.resource?.supplementary_data?.related_ids?.authorization_id,
      event.resource?.supplementary_data?.related_ids?.capture_id,
      event.resource?.batch_header?.payout_batch_id,
    ].filter(Boolean);
    const senderRef = event.resource?.payout_item?.sender_item_id;
    let bySender: Awaited<ReturnType<typeof get>> | undefined;
    try {
      if (typeof senderRef === "string") bySender = await get(senderRef);
    } catch {}
    let r: Awaited<ReturnType<typeof get>> | undefined;
    for (const id of ids) if (!r) r = await byPayPalId(id);
    r ||= bySender;
    if (r) {
      await locked(`gate:${r.ref}`, async () => {
        if (event.event_type === "CHECKOUT.ORDER.APPROVED")
          await completeApproval({ orderRef: r.ref });
        if (
          event.event_type === "PAYMENT.CAPTURE.COMPLETED" ||
          event.event_type === "PAYMENT.CAPTURE.REFUNDED"
        )
          await refresh({ orderRef: r.ref });
        await locked(r.ref, async () => {
          const current = await get(r!.ref);
          current.lastWebhook = {
            id: event.id,
            type: event.event_type,
            transmissionId,
            verification_status: "SUCCESS",
            at: new Date().toISOString(),
          };
          if (
            event.event_type === "PAYMENT.AUTHORIZATION.VOIDED" &&
            event.resource?.id === current.authorizationId &&
            !current.captures.some((c) => c.role === "balance")
          )
            current.state = "voided";
          if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
            const refund = current.refunds.find(
              (x) => x.id === event.resource.id,
            );
            if (refund) {
              refund.status = event.resource.status;
              if (refund.status === "COMPLETED") current.state = "refunded";
            }
          }
          if (event.event_type.startsWith("PAYMENT.PAYOUTS"))
            current.payout = {
              ...current.payout,
              lastEvent: event.event_type,
              status:
                event.resource?.batch_status ||
                event.resource?.transaction_status ||
                event.resource?.batch_header?.batch_status ||
                current.payout?.status,
            };
          await save(current);
        });
        await notifyShop(await get(r!.ref));
      });
    }
    // Record only after processing succeeds: a failed money action must be retried by PayPal.
    const fresh = await recordWebhook(transmissionId, event.id, {
      id: event.id,
      type: event.event_type,
      related: ids,
    });
    return { verification_status: "SUCCESS", duplicate: !fresh, matched: !!r };
  });
}

// PayPal Sandbox sometimes delivers webhooks minutes late. When a resolved
// order still has no verified webhook, ask PayPal to resend its own event for
// this order's capture/authorization to our registered webhook (Webhooks API
// resend). The delivery that follows is a genuine, PayPal-signed request that
// goes through the same signature verification; nothing is fabricated here.
export async function nudgeWebhook(ref: string) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return;
  const r = await get(ref);
  if (r.lastWebhook || r.webhookNudgedAt) return;
  const resolvedAt = Date.parse(r.calls.at(-1)?.at || r.createdAt);
  if (Date.now() - resolvedAt < 15000) return;
  if (!["released", "voided", "refunded", "held"].includes(r.state)) return;
  await locked(r.ref, async () => {
    const current = await get(r.ref);
    if (current.lastWebhook || current.webhookNudgedAt) return;
    current.webhookNudgedAt = new Date().toISOString();
    await save(current);
  });
  const ids = new Set(
    [
      r.authorizationId,
      ...r.captures.map((c) => c.id),
      ...r.refunds.map((c) => c.id),
    ].filter(Boolean),
  );
  const list = await api("/v1/notifications/webhooks-events?page_size=50");
  const event = (list.events || [])
    .filter((e: any) => ids.has(e.resource?.id))
    .sort((a: any, b: any) => (a.create_time < b.create_time ? 1 : -1))[0];
  if (!event) return;
  await api(
    `/v1/notifications/webhooks-events/${event.id}/resend`,
    "POST",
    { webhook_ids: [webhookId] },
    { ref: r.ref, verb: `webhook-resend-${event.id}`, log: false },
  );
}
