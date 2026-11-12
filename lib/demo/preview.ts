import type { Reservation, DeliveryEvent } from "../types";
import { decide, approveRefund } from "../gate";
import { catalogue } from "../presentation";
export const previewStorageKey = "entrega:guided:v2";
export function createPreview(productId = "hoodie"): Reservation {
  const p = catalogue.find((x) => x.id === productId) || catalogue[0],
    at = new Date().toISOString();
  return {
    ref: "VISTA-GUIADA-00024",
    owner: "browser-preview",
    source: "judge",
    product: p.name,
    total: p.total,
    deposit: Math.round(p.total / 200) * 100,
    currency: "USD",
    code: "4821",
    createdAt: at,
    authorizationAt: at,
    originalAuthorizationAt: at,
    state: "held",
    captures: [
      {
        id: "ILLUSTRATIVE_DEPOSIT",
        amount: Math.round(p.total / 200) * 100,
        status: "COMPLETED",
        role: "deposit",
      },
    ],
    refunds: [],
    calls: [],
    events: [],
    decisions: [],
  };
}
export function previewEvent(r: Reservation, e: DeliveryEvent): Reservation {
  const next = structuredClone(r),
    decision = decide(r, e);
  next.events.push({ ...e, observedState: r.state, decision, applied: true });
  next.decisions.push(decision);
  if (decision.action === "release") {
    next.state = "released";
    next.captures.push({
      id: "ILLUSTRATIVE_BALANCE",
      amount: r.total - r.deposit,
      status: "COMPLETED",
      role: "balance",
    });
  }
  if (decision.action === "cancel") next.state = "voided";
  return next;
}
export function previewRefund(r: Reservation, amount: number) {
  const decision = approveRefund(r, amount);
  if (decision.action !== "refund_partial") throw new Error(decision.reason);
  return {
    ...r,
    state: "refunded" as const,
    decisions: [...r.decisions, decision],
    refunds: [{ id: "ILLUSTRATIVE_REFUND", amount, status: "COMPLETED" }],
  };
}
export function previewShopOrders() {
  const r = createPreview();
  const e = (
    id: string,
    kind: DeliveryEvent["kind"],
    text: string,
    code?: string,
  ): DeliveryEvent => ({
    id,
    kind,
    text,
    code,
    at: new Date().toISOString(),
    source: "simulated_laar",
  });
  const delivered = previewEvent(
    { ...r, ref: "GUIADA-024" },
    e("d", "delivered", "Pedido recibido completo.", r.code),
  );
  const refused = previewEvent(
    { ...createPreview("mug"), ref: "GUIADA-025" },
    e("r", "refused", "El cliente rechazó el paquete."),
  );
  const absence = previewEvent(
    previewEvent(
      { ...createPreview("frame"), ref: "GUIADA-026" },
      e("a1", "not_home", "No había nadie en casa."),
    ),
    e("a2", "not_home", "Segundo intento sin respuesta."),
  );
  return [
    delivered,
    refused,
    absence,
    { ...createPreview("mug"), ref: "GUIADA-027" },
  ];
}
