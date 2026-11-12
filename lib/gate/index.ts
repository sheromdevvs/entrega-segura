import type { Reservation, DeliveryEvent, Decision } from "../types";
export const policy = {
  maxAttempts: 2,
  defectWindowHours: 48,
  honorHours: 72,
  maxAuthorizationDays: 29,
};
export function decide(
  r: Reservation,
  e: DeliveryEvent,
  now = new Date(),
): Decision {
  const result = (action: Decision["action"], reason: string) => ({
    action,
    reason,
  });
  if (
    !Number.isFinite(Date.parse(e.at)) ||
    Date.parse(e.at) > now.getTime() + 60000
  )
    return result("ask_shop", "La fecha de la evidencia requiere revisión.");
  if (r.events.some((x) => x.id === e.id))
    return result("wait", "Este evento ya fue procesado.");
  if (e.kind === "defect_reported") {
    const delivery = r.events.find(
      (x) => x.kind === "delivered" && x.code === r.code,
    );
    if (
      delivery &&
      e.hasPhoto &&
      Date.parse(e.at) >= Date.parse(delivery.at) &&
      Date.parse(e.at) - Date.parse(delivery.at) <=
        policy.defectWindowHours * 3600000
    )
      return result(
        "ask_shop",
        "Hay una foto del defecto dentro de 48 horas; la tienda debe aprobar un reembolso parcial.",
      );
    return result(
      "ask_shop",
      "La tienda debe revisar la evidencia y el plazo del reclamo.",
    );
  }
  if (
    r.state === "released" ||
    r.state === "voided" ||
    r.state === "refunded" ||
    r.captures.some((x) => x.role === "balance")
  )
    return result(
      "wait",
      "El saldo ya tiene una resolución; no se vuelve a cobrar.",
    );
  if (r.state !== "held")
    return result(
      "wait",
      "Primero se necesita la autorización y el anticipo completado.",
    );
  const age =
    now.getTime() -
    Date.parse(r.originalAuthorizationAt || r.authorizationAt || r.createdAt);
  if (age >= policy.maxAuthorizationDays * 86400000)
    return result(
      "ask_shop",
      "La autorización alcanzó su vida máxima; solicite una nueva aprobación.",
    );
  if (e.kind === "refused")
    return result(
      "cancel",
      "Se rechazó la entrega: se anula el saldo y se conserva el anticipo informado.",
    );
  if (e.kind === "not_home")
    return r.events.filter(
      (x) =>
        x.kind === "not_home" &&
        (!x.observedState || x.observedState === "held"),
    ).length +
      1 >=
      policy.maxAttempts
      ? result(
          "ask_shop",
          "Dos intentos sin entrega; la tienda debe coordinar el siguiente paso.",
        )
      : result(
          "wait",
          "No había nadie; se propone reintentar mañana sin cobrar el saldo.",
        );
  if (e.kind === "partial_delivery")
    return result(
      "ask_shop",
      "La entrega está incompleta; la tienda debe revisarla antes de cobrar.",
    );
  if (e.kind === "authorization_expiring")
    return result(
      "ask_shop",
      "Revise la autorización y reautorice dentro del plazo permitido.",
    );
  if (e.kind === "delivered")
    return e.code === r.code
      ? result(
          "release",
          "La entrega y el código coinciden; se puede cobrar el saldo una sola vez.",
        )
      : result("ask_shop", "El código no coincide; no se cobra el saldo.");
  return result(
    "ask_shop",
    "El mensaje no permite confirmar una entrega; hace falta revisión.",
  );
}
export function approveRefund(r: Reservation, amount: number): Decision {
  const delivery = r.events.find(
    (x) =>
      x.kind === "delivered" &&
      x.code === r.code &&
      (!x.observedState || x.observedState === "held"),
  );
  const evidence =
    delivery &&
    r.events.some(
      (x) =>
        x.kind === "defect_reported" &&
        x.hasPhoto &&
        Date.parse(x.at) >= Date.parse(delivery.at) &&
        Date.parse(x.at) - Date.parse(delivery.at) <=
          policy.defectWindowHours * 3600000,
    );
  return r.state === "released" &&
    evidence &&
    r.decisions.some((x) => x.action === "ask_shop") &&
    Number.isInteger(amount) &&
    amount > 0 &&
    amount < r.total &&
    r.captures.some((x) => x.status === "COMPLETED" && x.amount >= amount) &&
    !r.refunds.length
    ? {
        action: "refund_partial",
        reason:
          "La tienda aprobó el importe del reembolso después de revisar el reclamo.",
      }
    : {
        action: "ask_shop",
        reason:
          "El reembolso requiere entrega completada, evidencia dentro de 48 horas, revisión e importe válido.",
      };
}
