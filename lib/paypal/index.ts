import { holdSplit, approveSplit } from "./split";
import { api, money } from "./client";
import { get, save, locked } from "../store";
import type { Reservation } from "../types";
function patch(ref: string, fields: Partial<Reservation>) {
  return save({ ...get(ref), ...fields });
}
function captureRecord(
  r: Reservation,
  d: any,
  amount: number,
  role: "deposit" | "balance",
) {
  if (!d.id) throw new Error("Capture ID missing");
  return [
    ...r.captures.filter((x) => x.id !== d.id),
    { id: d.id, amount, status: d.status, role },
  ];
}
export async function hold(input: {
  orderRef: string;
  total: number;
  depositNow: number;
  currency: string;
}) {
  return locked(input.orderRef, async () => {
    const r = get(input.orderRef);
    if (
      input.currency !== "USD" ||
      input.total !== r.total ||
      input.depositNow !== r.deposit
    )
      throw new Error("Order amount mismatch");
    if (r.paymentStrategy === "split") return holdSplit(r);
    if (r.paypalOrderId) return r;
    const origin = process.env.APP_URL || "http://localhost:3025";
    const d = await api(
      "/v2/checkout/orders",
      "POST",
      {
        intent: "AUTHORIZE",
        purchase_units: [
          {
            reference_id: r.ref,
            custom_id: r.ref,
            description: `Entrega Segura demo: ${r.product}`,
            amount: money(r.total),
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: `${origin}/judge?ref=${r.ref}&approved=1`,
              cancel_url: `${origin}/judge?ref=${r.ref}&cancelled=1`,
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              brand_name: "Entrega Segura · Sandbox",
            },
          },
        },
      },
      { ref: r.ref, verb: "hold", amount: r.total },
    );
    const approval = d.links?.find(
      (x: any) => x.rel === "payer-action" || x.rel === "approve",
    )?.href;
    if (!approval) throw new Error("PayPal approval link missing");
    return patch(r.ref, { paypalOrderId: d.id, approvalUrl: approval });
  });
}
export async function completeApproval({ orderRef }: { orderRef: string }) {
  return locked(orderRef, async () => {
    let r = get(orderRef);
    if (r.paymentStrategy === "split") return approveSplit(r);
    if (!r.paypalOrderId) throw new Error("Order not created");
    if (r.captures.some((x) => x.role === "deposit")) return r;
    if (!r.authorizationId) {
      const order = await api(
        `/v2/checkout/orders/${r.paypalOrderId}`,
        "GET",
        undefined,
        { ref: r.ref, verb: "order-status" },
      );
      if (order.status !== "APPROVED" && order.status !== "COMPLETED")
        throw new Error("Approve the sandbox checkout in PayPal first");
      const d =
        order.status === "COMPLETED"
          ? order
          : await api(
              `/v2/checkout/orders/${r.paypalOrderId}/authorize`,
              "POST",
              {},
              { ref: r.ref, verb: "authorize", amount: r.total },
            );
      const auth = d.purchase_units?.[0]?.payments?.authorizations?.[0];
      if (!auth?.id) throw new Error("Authorization not returned");
      r = patch(r.ref, {
        authorizationId: auth.id,
        authorizationAt: auth.create_time || new Date().toISOString(),
        originalAuthorizationAt: auth.create_time || new Date().toISOString(),
        state: "authorized",
        authorizationStatus: auth.status || "CREATED",
      });
    }
    const deposit = await api(
      `/v2/payments/authorizations/${r.authorizationId}/capture`,
      "POST",
      {
        amount: money(r.deposit),
        final_capture: false,
        note_to_payer:
          "50% de anticipo para producción personalizada; saldo al entregar.",
      },
      { ref: r.ref, verb: "deposit", amount: r.deposit },
    );
    return patch(r.ref, {
      captures: captureRecord(get(r.ref), deposit, r.deposit, "deposit"),
      state: deposit.status === "COMPLETED" ? "held" : "deposit_pending",
    });
  });
}
async function reauthorizeUnlocked(r: Reservation) {
  if (!r.authorizationId) throw new Error("Missing authorization");
  const originalAge =
    Date.now() - Date.parse(r.originalAuthorizationAt || r.authorizationAt!);
  const age = Date.now() - Date.parse(r.authorizationAt!);
  if (originalAge >= 29 * 86400000)
    throw new Error("Authorization expired; new buyer approval required");
  if (age < 72 * 3600000) return r;
  const amount = r.total - r.captures.reduce((a, c) => a + c.amount, 0);
  const d = await api(
    `/v2/payments/authorizations/${r.authorizationId}/reauthorize`,
    "POST",
    { amount: money(amount) },
    { ref: r.ref, verb: `reauthorize-${r.authorizationId}`, amount },
  );
  return patch(r.ref, {
    authorizationId: d.id,
    authorizationAt: d.create_time || new Date().toISOString(),
  });
}
export async function reauthorize({ orderRef }: { orderRef: string }) {
  return locked(orderRef, () => reauthorizeUnlocked(get(orderRef)));
}
export async function release({ orderRef }: { orderRef: string }) {
  return locked(orderRef, async () => {
    let r = get(orderRef);
    if (r.captures.some((x) => x.role === "balance")) return r;
    if (r.state !== "held") throw new Error("Balance is not ready for capture");
    r = await reauthorizeUnlocked(r);
    const amount = r.total - r.deposit;
    const d = await api(
      `/v2/payments/authorizations/${r.authorizationId}/capture`,
      "POST",
      {
        amount: money(amount),
        final_capture: true,
        note_to_payer: "Entrega confirmada con código. Saldo del pedido.",
      },
      { ref: r.ref, verb: "release", amount },
    );
    return patch(r.ref, {
      captures: captureRecord(get(r.ref), d, amount, "balance"),
      state: d.status === "COMPLETED" ? "released" : "review",
    });
  });
}
export async function cancel({ orderRef }: { orderRef: string }) {
  return locked(orderRef, async () => {
    const r = get(orderRef);
    if (r.state === "voided") return r;
    if (r.state !== "held" || r.captures.some((x) => x.role === "balance"))
      throw new Error("Balance cannot be voided");
    await api(
      `/v2/payments/authorizations/${r.authorizationId}/void`,
      "POST",
      undefined,
      { ref: r.ref, verb: "cancel", amount: r.total - r.deposit },
    );
    return patch(r.ref, { state: "voided" });
  });
}
export async function refund({
  orderRef,
  amount,
  reason,
}: {
  orderRef: string;
  amount: number;
  reason: string;
}) {
  return locked(orderRef, async () => {
    let r = get(orderRef);
    if (r.refunds.length) {
      if (r.refunds[0].amount !== amount)
        throw new Error("A refund already exists");
      return r;
    }
    if (r.refundIntent !== undefined && r.refundIntent !== amount)
      throw new Error("A different refund is already in progress");
    const capture = [...r.captures]
      .reverse()
      .find((x) => x.status === "COMPLETED" && x.amount >= amount);
    if (!capture) throw new Error("Refund must fit a completed capture");
    r = patch(r.ref, { refundIntent: amount });
    const d = await api(
      `/v2/payments/captures/${capture.id}/refund`,
      "POST",
      { amount: money(amount), note_to_payer: reason.slice(0, 200) },
      { ref: r.ref, verb: "refund", amount },
    );
    return patch(r.ref, {
      refunds: [{ id: d.id, amount, status: d.status }],
      state: d.status === "COMPLETED" ? "refunded" : "review",
    });
  });
}
export async function payOut({
  receiverEmail,
  amount,
  note,
  orderRef,
}: {
  receiverEmail: string;
  amount: number;
  note: string;
  orderRef: string;
}) {
  return locked(orderRef, async () => {
    const r = get(orderRef);
    if (
      !r.captures.some((c) => c.role === "balance" && c.status === "COMPLETED")
    )
      throw new Error("Courier payout requires a completed delivery payment");
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 650)
      throw new Error("Demo courier payout must be between $0.01 and $6.50");
    if (
      r.payoutIntent &&
      (r.payoutIntent.amount !== amount ||
        r.payoutIntent.receiverEmail !== receiverEmail)
    )
      throw new Error("Courier payout intent is already fixed");
    if (r.payout) return r.payout;
    patch(r.ref, { payoutIntent: { receiverEmail, amount, note } });
    const d = await api(
      "/v1/payments/payouts",
      "POST",
      {
        sender_batch_header: {
          sender_batch_id: `${orderRef}-courier`,
          email_subject: "Entrega Segura sandbox payout",
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: { currency: "USD", value: money(amount).value },
            receiver: receiverEmail,
            note: note.slice(0, 200),
            sender_item_id: orderRef,
          },
        ],
      },
      { ref: orderRef, verb: "payOut", amount },
    );
    patch(orderRef, { payout: d.batch_header });
    return d;
  });
}
export function status({ orderRef }: { orderRef: string }) {
  const r = get(orderRef);
  return {
    order: r.paypalOrderId,
    authorization: r.authorizationId,
    depositOrder: r.depositOrderId,
    strategy: r.paymentStrategy || "single",
    captures: r.captures,
    refunds: r.refunds,
    lastWebhook: r.lastWebhook,
    calls: r.calls,
  };
}
export async function refresh({ orderRef }: { orderRef: string }) {
  return locked(orderRef, async () => {
    const r = get(orderRef);
    for (const capture of r.captures) {
      const d = await api(
        `/v2/payments/captures/${capture.id}`,
        "GET",
        undefined,
        { ref: r.ref, verb: "capture-status" },
      );
      capture.status = d.status;
    }
    for (const refund of r.refunds) {
      const d = await api(
        `/v2/payments/refunds/${refund.id}`,
        "GET",
        undefined,
        { ref: r.ref, verb: "refund-status" },
      );
      refund.status = d.status;
    }
    let authorizationStatus = r.authorizationStatus;
    if (r.authorizationId) {
      const d = await api(
        `/v2/payments/authorizations/${r.authorizationId}`,
        "GET",
        undefined,
        { ref: r.ref, verb: "authorization-status" },
      );
      authorizationStatus = d.status;
    }
    let payout = r.payout;
    if (typeof payout?.payout_batch_id === "string") {
      const d = await api(
        `/v1/payments/payouts/${payout.payout_batch_id}`,
        "GET",
        undefined,
        { ref: r.ref, verb: "payout-status" },
      );
      payout = d.batch_header;
    }
    let state = r.state;
    if (
      state === "deposit_pending" &&
      r.captures.find((c) => c.role === "deposit")?.status === "COMPLETED"
    )
      state =
        r.paymentStrategy === "split" && !r.authorizationId
          ? "awaiting_balance_approval"
          : "held";
    if (
      r.captures.some((c) => c.role === "balance" && c.status === "COMPLETED")
    )
      state = "released";
    if (r.refunds.some((c) => c.status === "COMPLETED")) state = "refunded";
    if (
      ["EXPIRED", "DENIED"].includes(authorizationStatus || "") &&
      !r.captures.some((c) => c.role === "balance")
    )
      state = "review";
    if (
      authorizationStatus === "VOIDED" &&
      !r.captures.some((c) => c.role === "balance")
    )
      state = "voided";
    return patch(r.ref, {
      captures: r.captures,
      refunds: r.refunds,
      payout,
      state,
      authorizationStatus,
    });
  });
}
