import type { MoneyState, Reservation, EventKind } from "./types";
export const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const stateLabels: Record<MoneyState, string> = {
  awaiting_approval: "Por aprobar",
  awaiting_balance_approval: "Aprobar saldo",
  authorized: "Autorizado",
  deposit_pending: "Anticipo pendiente",
  held: "Saldo autorizado",
  released: "Entregado y cobrado",
  voided: "Saldo anulado",
  refunded: "Reembolso registrado",
  review: "Requiere revisión",
};
export const eventLabels: Record<EventKind, string> = {
  delivered: "Entrega confirmada",
  refused: "Entrega rechazada",
  not_home: "Cliente ausente",
  partial_delivery: "Entrega incompleta",
  defect_reported: "Defecto reportado",
  authorization_expiring: "Autorización por vencer",
  unknown: "Por aclarar",
};
export const catalogue = [
  {
    id: "hoodie",
    name: "Hoodie personalizado",
    total: 2400,
    image: "/images/delivery-editorial.webp",
    category: "PRENDAS",
  },
  {
    id: "mug",
    name: "Taza personalizada",
    total: 1200,
    image: "/images/made-with-care.webp",
    category: "OBJETOS",
  },
  {
    id: "frame",
    name: "Cuadro de mascota 8×10",
    total: 1300,
    image: "/images/pet-frame.webp",
    category: "RECUERDOS",
  },
];
export function productImage(name: string) {
  return catalogue.find((x) => x.name === name)?.image || catalogue[0].image;
}
export function ledger(r: Reservation) {
  const completed = r.captures.filter((c) => c.status === "COMPLETED");
  const deposit = completed
    .filter((c) => c.role === "deposit")
    .reduce((n, c) => n + c.amount, 0);
  const balance = completed
    .filter((c) => c.role === "balance")
    .reduce((n, c) => n + c.amount, 0);
  const refunded = r.refunds
    .filter((x) => x.status === "COMPLETED")
    .reduce((n, x) => n + x.amount, 0);
  const held =
    r.state === "held" || r.state === "authorized"
      ? r.total - deposit - balance
      : 0;
  return {
    deposit,
    balance,
    refunded,
    held,
    collected: deposit + balance - refunded,
  };
}
