import { explainDecision } from "./ai";
import { randomInt, randomBytes } from "node:crypto";
import {
  get,
  save,
  locked,
  enqueueNotification,
  pendingNotifications,
  deliveredNotification,
  failedNotification,
} from "./store";
import { createHmac } from "node:crypto";
import { decide, approveRefund } from "./gate";
import { release, cancel, refund } from "./paypal";
import type { Reservation, DeliveryEvent } from "./types";
export const products = [
  { id: "hoodie", name: "Hoodie personalizado", total: 2400 },
  { id: "mug", name: "Taza personalizada", total: 1200 },
  { id: "frame", name: "Cuadro de mascota 8×10", total: 1300 },
];
export async function createOrder(
  owner: string,
  productId = "hoodie",
  source: Reservation["source"] = "judge",
  merchantRef?: string,
  paymentStrategy?: "single" | "split",
  buyerMethod: "approval_link" | "sandbox_card" = "approval_link",
) {
  const p = products.find((x) => x.id === productId);
  if (!p) throw new Error("Unknown product");
  const now = new Date().toISOString();
  return save({
    ref: `ES-${randomBytes(8).toString("hex").toUpperCase()}`,
    owner,
    source,
    merchantRef,
    paymentStrategy:
      paymentStrategy ||
      (process.env.PAYPAL_CAPTURE_STRATEGY === "split" ? "split" : "single"),
    buyerMethod,
    product: p.name,
    total: p.total,
    deposit: Math.round(p.total / 200) * 100,
    currency: "USD",
    code: String(randomInt(1000, 10000)),
    createdAt: now,
    state: "awaiting_approval",
    captures: [],
    refunds: [],
    events: [],
    decisions: [],
    calls: [],
  });
}
export async function processEvent(ref: string, e: DeliveryEvent) {
  return locked(`gate:${ref}`, async () => {
    let r = await get(ref);
    const index = r.events.findIndex((x) => x.id === e.id);
    if (index >= 0 && r.events[index].applied !== false) return r;
    let decision;
    if (index >= 0) {
      e = r.events[index];
      decision = r.events[index].decision || r.decisions[index];
    } else {
      decision = decide(r, e);
      r.events.push({ ...e, observedState: r.state, decision, applied: false });
      r.decisions.push(decision);
      await save(r);
    }
    try {
      if (decision.action === "release") await release({ orderRef: ref });
      if (decision.action === "cancel") await cancel({ orderRef: ref });
      r = await get(ref);
      r.events.find((x) => x.id === e.id)!.applied = true;
      r.lastError = undefined;
      await save(r);
    } catch (err) {
      r = await get(ref);
      r.lastError =
        err instanceof Error ? err.message : "Payment action failed";
      await save(r);
      throw err;
    }
    if (e.interpretation) {
      try {
        const explanation = await explainDecision(decision);
        if (explanation) {
          const current = await get(ref);
          current.events.find((x) => x.id === e.id)!.gateExplanation =
            explanation;
          await save(current);
        }
      } catch {
        console.warn(
          "AI explanation unavailable; deterministic decision retained",
          ref,
        );
      }
    }
    await notifyShop(await get(ref));
    return get(ref);
  });
}
export async function shopRefund(ref: string, amount: number) {
  const r = await get(ref);
  const decision = approveRefund(r, amount);
  if (decision.action !== "refund_partial") throw new Error(decision.reason);
  r.decisions.push(decision);
  await save(r);
  const result = await refund({
    orderRef: ref,
    amount,
    reason: "Reembolso parcial aprobado por tienda por defecto reportado.",
  });
  await notifyShop(result);
  return result;
}
export async function notifyShop(r: Reservation) {
  if (r.source !== "pascal") return;
  const body = JSON.stringify({
    id: `${r.ref}:${r.state}:${r.captures.length}:${r.refunds.length}`,
    type: "reservation.updated",
    orderRef: r.ref,
    merchantRef: r.merchantRef,
    state: r.state,
    total: r.total,
    deposit: r.deposit,
    captures: r.captures,
    refunds: r.refunds,
    sandbox: true,
  });
  await enqueueNotification(JSON.parse(body).id, body);
  await flushNotifications();
}
export async function flushNotifications(orderRef?: string) {
  const url = process.env.SHOP_WEBHOOK_URL,
    secret = process.env.SHOP_WEBHOOK_SECRET;
  if (!url || !secret) return;
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1"
  )
    throw new Error("Shop webhook must use HTTPS");
  for (const n of await pendingNotifications(orderRef)) {
    const time = String(Date.now());
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Entrega-Timestamp": time,
          "X-Entrega-Signature": createHmac("sha256", secret)
            .update(time + "." + n.body)
            .digest("hex"),
        },
        body: n.body,
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) await deliveredNotification(n.id);
      else await failedNotification(n.id, `HTTP ${r.status}`);
    } catch {
      await failedNotification(n.id, "Connection failed");
      console.error("Shop notification remains queued", n.id);
    }
  }
}
