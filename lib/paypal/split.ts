import { api, money } from "./client";
import { get, save } from "../store";
import type { Reservation } from "../types";
function patch(ref: string, fields: Partial<Reservation>) {
  return save({ ...get(ref), ...fields });
}
function approval(d: any) {
  const href = d.links?.find(
    (x: any) => x.rel === "payer-action" || x.rel === "approve",
  )?.href;
  if (!href) throw new Error("PayPal approval link missing");
  return href as string;
}
async function create(
  r: Reservation,
  intent: "CAPTURE" | "AUTHORIZE",
  amount: number,
  part: "deposit" | "balance",
) {
  const origin = process.env.APP_URL || "http://localhost:3025";
  return api(
    "/v2/checkout/orders",
    "POST",
    {
      intent,
      purchase_units: [
        {
          reference_id: r.ref,
          custom_id: r.ref,
          description: `Entrega Segura · ${part} · ${r.product}`,
          amount: money(amount),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: `${origin}/judge?mode=sandbox&ref=${r.ref}&approved=1`,
            cancel_url: `${origin}/judge?mode=sandbox&ref=${r.ref}&cancelled=1`,
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            brand_name: "Entrega Segura · Sandbox",
          },
        },
      },
    },
    { ref: r.ref, verb: `hold-${part}`, amount },
  );
}
// Called inside the reservation lock owned by lib/paypal/index.ts.
export async function holdSplit(r: Reservation) {
  if (!r.depositOrderId) {
    const d = await create(r, "CAPTURE", r.deposit, "deposit");
    r = patch(r.ref, {
      depositOrderId: d.id,
      depositApprovalUrl: approval(d),
      approvalUrl: approval(d),
    });
  }
  if (!r.paypalOrderId) {
    const d = await create(r, "AUTHORIZE", r.total - r.deposit, "balance");
    r = patch(r.ref, { paypalOrderId: d.id, balanceApprovalUrl: approval(d) });
  }
  return r;
}
export async function approveSplit(r: Reservation) {
  if (!r.depositOrderId || !r.paypalOrderId)
    throw new Error("Both checkout orders must be created first");
  let deposit = r.captures.find((x) => x.role === "deposit");
  if (!deposit) {
    const order = await api(
      `/v2/checkout/orders/${r.depositOrderId}`,
      "GET",
      undefined,
      { ref: r.ref, verb: "deposit-order-status" },
    );
    if (order.status !== "APPROVED" && order.status !== "COMPLETED")
      throw new Error("Approve the production deposit in PayPal Sandbox first");
    const d =
      order.status === "COMPLETED"
        ? order
        : await api(
            `/v2/checkout/orders/${r.depositOrderId}/capture`,
            "POST",
            {},
            { ref: r.ref, verb: "deposit", amount: r.deposit },
          );
    const capture = d.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture?.id) throw new Error("Deposit capture was not returned");
    deposit = {
      id: capture.id,
      amount: r.deposit,
      status: capture.status,
      role: "deposit",
    };
    r = patch(r.ref, {
      captures: [...get(r.ref).captures, deposit],
      state:
        capture.status === "COMPLETED"
          ? "awaiting_balance_approval"
          : "deposit_pending",
      approvalUrl: r.balanceApprovalUrl,
    });
  }
  if (deposit.status !== "COMPLETED") return r;
  if (r.authorizationId) return r;
  const order = await api(
    `/v2/checkout/orders/${r.paypalOrderId}`,
    "GET",
    undefined,
    { ref: r.ref, verb: "balance-order-status" },
  );
  if (order.status !== "APPROVED" && order.status !== "COMPLETED")
    return patch(r.ref, {
      state: "awaiting_balance_approval",
      approvalUrl: r.balanceApprovalUrl,
    });
  const d =
    order.status === "COMPLETED"
      ? order
      : await api(
          `/v2/checkout/orders/${r.paypalOrderId}/authorize`,
          "POST",
          {},
          { ref: r.ref, verb: "authorize", amount: r.total - r.deposit },
        );
  const authorization = d.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!authorization?.id)
    throw new Error("Balance authorization was not returned");
  return patch(r.ref, {
    authorizationId: authorization.id,
    authorizationAt: authorization.create_time || new Date().toISOString(),
    originalAuthorizationAt:
      authorization.create_time || new Date().toISOString(),
    authorizationStatus: authorization.status || "CREATED",
    state: "held",
    approvalUrl: undefined,
  });
}
