// Scripted real-sandbox scenarios. Used by scripts/sandbox-e2e.ts and by the
// one-click judge run (/api/judge/run). The buyer pays with PayPal's sandbox
// test card so no browser approval is needed; every money decision still goes
// through the same deterministic gate and PayPal verbs as the human flow.
import { randomUUID } from "node:crypto";
import { api, requestId, money } from "./paypal/client";
import { hold, completeApproval, release, payOut } from "./paypal";
import { createOrder, processEvent, shopRefund } from "./orders";
import { SimulatedLaar } from "./courier";
import { get } from "./store";
import type { Reservation, EventKind } from "./types";

export const sandboxScenarios = [
  "delivered",
  "refused",
  "not_home_twice",
  "defect_refund",
  "courier_payout",
  "duplicate_retry",
] as const;
export type SandboxScenario = (typeof sandboxScenarios)[number];

export type Step = {
  step: string;
  result: string;
  ids?: Record<string, string | undefined>;
  decision?: string;
};

async function courierEvent(
  r: Reservation,
  kind: EventKind,
  extra: { code?: string; hasPhoto?: boolean; text?: string } = {},
) {
  const courier = await new SimulatedLaar(
    kind === "delivered" || kind === "refused" || kind === "not_home"
      ? kind
      : "in_transit",
  ).getStatus(`DEMO-${r.ref}`);
  return processEvent(r.ref, {
    id: randomUUID(),
    kind,
    at: courier.at,
    source: kind === "defect_reported" ? "chat" : "simulated_laar",
    code: extra.code,
    hasPhoto: extra.hasPhoto,
    text: extra.text || courier.evidence,
  });
}

function lastDebug(r: Reservation, pathPart: string) {
  return [...r.calls].reverse().find((c) => c.path.includes(pathPart))?.debugId;
}

async function authorizeWithDeposit(owner: string, productId: string) {
  const created = await createOrder(
    owner,
    productId,
    "judge",
    undefined,
    "single",
    "sandbox_card",
  );
  await hold({
    orderRef: created.ref,
    total: created.total,
    depositNow: created.deposit,
    currency: created.currency,
  });
  const r = await completeApproval({ orderRef: created.ref });
  if (r.state !== "held")
    throw new Error(`Deposit did not complete (state ${r.state})`);
  const deposit = r.captures.find((c) => c.role === "deposit")!;
  const steps: Step[] = [
    {
      step: "Order created with intent AUTHORIZE (sandbox test card as buyer)",
      result: `${r.paypalOrderId} for $${(r.total / 100).toFixed(2)}`,
      ids: {
        order: r.paypalOrderId,
        debugId: lastDebug(r, "/v2/checkout/orders") || undefined,
      },
    },
    {
      step: "Full amount authorized; 50% deposit captured with final_capture=false",
      result: `deposit $${(deposit.amount / 100).toFixed(2)} ${deposit.status}; balance stays authorized`,
      ids: {
        authorization: r.authorizationId,
        depositCapture: deposit.id,
        debugId: lastDebug(r, "/capture") || undefined,
      },
    },
  ];
  return { r, steps };
}

async function authorizationStatus(r: Reservation) {
  const d = await api(
    `/v2/payments/authorizations/${r.authorizationId}`,
    "GET",
    undefined,
    { ref: r.ref, verb: "authorization-status" },
  );
  return String(d.status);
}

export async function runSandboxScenario(
  scenario: SandboxScenario,
  options: { owner: string; productId?: string; courierEmail?: string },
) {
  const { r: start, steps } = await authorizeWithDeposit(
    options.owner,
    options.productId || "hoodie",
  );
  let r = start;
  const deliver = async (
    label = "Courier confirms delivery with the buyer's 4-digit code",
  ) => {
    r = await courierEvent(r, "delivered", { code: r.code });
    const balance = r.captures.find((c) => c.role === "balance");
    steps.push({
      step: label,
      decision: r.decisions.at(-1)?.action,
      result: balance
        ? `balance $${(balance.amount / 100).toFixed(2)} captured with final_capture=true (${balance.status})`
        : `no capture (${r.decisions.at(-1)?.reason})`,
      ids: {
        balanceCapture: balance?.id,
        debugId: balance ? lastDebug(r, "/capture") || undefined : undefined,
      },
    });
  };

  if (scenario === "delivered") {
    await deliver();
    r = await courierEvent(r, "delivered", { code: r.code });
    steps.push({
      step: "Same delivery confirmation arrives again",
      decision: r.decisions.at(-1)?.action,
      result: `${r.captures.filter((c) => c.role === "balance").length} balance capture in total`,
    });
  }

  if (scenario === "refused") {
    r = await courierEvent(r, "refused");
    steps.push({
      step: "Buyer refuses the parcel at the door",
      decision: r.decisions.at(-1)?.action,
      result: `remaining authorization voided; PayPal now reports ${await authorizationStatus(r)}; deposit kept as disclosed`,
      ids: {
        authorization: r.authorizationId,
        debugId: lastDebug(r, "/void") || undefined,
      },
    });
  }

  if (scenario === "not_home_twice") {
    for (const attempt of [1, 2]) {
      r = await courierEvent(r, "not_home");
      steps.push({
        step: `Courier attempt ${attempt}: nobody home`,
        decision: r.decisions.at(-1)?.action,
        result: r.decisions.at(-1)!.reason,
      });
    }
    steps.push({
      step: "PayPal authorization after two failed attempts",
      result: `still ${await authorizationStatus(r)}: no balance captured, nothing voided, shop decides`,
      ids: { authorization: r.authorizationId },
    });
  }

  if (scenario === "defect_refund") {
    await deliver();
    r = await courierEvent(r, "defect_reported", {
      hasPhoto: true,
      text: "El cuadro llegó con el vidrio roto. Adjunto foto.",
    });
    steps.push({
      step: "Buyer reports a defect with a photo within 48 h",
      decision: r.decisions.at(-1)?.action,
      result: r.decisions.at(-1)!.reason,
    });
    r = await shopRefund(r.ref, 400);
    const refund = r.refunds[0];
    steps.push({
      step: "Shop explicitly approves a $4.00 partial refund",
      decision: "refund_partial",
      result: `refund ${refund?.status}`,
      ids: {
        refund: refund?.id,
        debugId: lastDebug(r, "/refund") || undefined,
      },
    });
  }

  // The real courier fee is $3 (Quito) to $6.50 (LAAR). The shared sandbox
  // business account's payout balance is nearly empty (PayPal answers
  // INSUFFICIENT_FUNDS for $3 and $6.50 although card captures succeed), so the
  // scripted demo pays out $1.00. Override with DEMO_PAYOUT_CENTS.
  const payoutCents = Number(process.env.DEMO_PAYOUT_CENTS || 100);
  if (scenario === "courier_payout") {
    await deliver();
    if (!options.courierEmail)
      throw new Error("courierEmail (a sandbox account) is required");
    await payOut({
      orderRef: r.ref,
      receiverEmail: options.courierEmail,
      amount: payoutCents,
      note: "Courier fee for a fictional demo delivery (sandbox)",
    });
    r = await get(r.ref);
    steps.push({
      step: `Courier fee ($${(payoutCents / 100).toFixed(2)}) paid out to a sandbox PayPal account`,
      result: `payout batch ${String(r.payout?.batch_status)}`,
      ids: {
        payoutBatch: String(r.payout?.payout_batch_id),
        debugId: lastDebug(r, "/v1/payments/payouts") || undefined,
      },
    });
  }

  if (scenario === "duplicate_retry") {
    await deliver();
    const balance = r.captures.find((c) => c.role === "balance")!;
    await Promise.all(
      Array.from({ length: 5 }, () => release({ orderRef: r.ref })),
    );
    r = await courierEvent(r, "delivered", { code: r.code });
    // Bypass the local journal entirely: replay the exact capture request at
    // PayPal with the same PayPal-Request-Id. PayPal must answer with the same capture.
    const amount = r.total - r.deposit;
    const replay = await api(
      `/v2/payments/authorizations/${r.authorizationId}/capture`,
      "POST",
      {
        amount: money(amount),
        final_capture: true,
        note_to_payer: "Entrega confirmada con código. Saldo del pedido.",
      },
      { ref: r.ref, verb: "release", amount, log: false },
    );
    r = await get(r.ref);
    steps.push({
      step: "5 concurrent release() calls + a repeated delivery event + a raw PayPal replay with the same PayPal-Request-Id",
      result: `${r.captures.filter((c) => c.role === "balance").length} balance capture locally; PayPal replay returned ${replay.id} (${replay.id === balance.id ? "same capture, no second charge" : "DIFFERENT capture"})`,
      ids: {
        balanceCapture: balance.id,
        replayCapture: replay.id,
        requestId: requestId(r.ref, "release", amount),
      },
    });
    if (replay.id !== balance.id)
      throw new Error("Idempotency replay produced a different capture");
  }

  return { scenario, order: await get(r.ref), steps };
}
