import { get, save, listAll, locked } from "./store";
import { reauthorize, refresh } from "./paypal";
import { processEvent, flushNotifications, notifyShop } from "./orders";
import { policy } from "./gate";
const hour = 3600000,
  day = 24 * hour;
export async function maintainOrder(ref: string, now = new Date()) {
  return locked(`maintenance:${ref}`, async () => {
    let order = get(ref);
    const update = (status: "ok" | "review", message: string) => {
      order = get(ref);
      order.maintenance = { checkedAt: now.toISOString(), status, message };
      save(order);
      return order;
    };
    if (
      !order.authorizationId &&
      !order.captures.some((c) => c.status === "PENDING")
    )
      return update(
        "ok",
        "El pedido todavía no tiene una autorización que revisar.",
      );
    try {
      order = await refresh({ orderRef: ref });
      if (order.state !== "held")
        return update(
          "ok",
          "Estado consultado en PayPal. No hay un saldo autorizado pendiente de revisión.",
        );
      const original = Date.parse(
          order.originalAuthorizationAt ||
            order.authorizationAt ||
            order.createdAt,
        ),
        age = now.getTime() - original,
        renewalAge =
          now.getTime() - Date.parse(order.authorizationAt || order.createdAt);
      if (
        !Number.isFinite(age) ||
        age >= (policy.maxAuthorizationDays - 1) * day
      ) {
        await processEvent(ref, {
          id: `expiry:${ref}:${order.originalAuthorizationAt || order.createdAt}`,
          kind: "authorization_expiring",
          at: now.toISOString(),
          source: "system",
          text:
            age >= policy.maxAuthorizationDays * day
              ? "La autorización alcanzó su vida máxima. Se necesita una nueva aprobación."
              : "La autorización está a menos de 24 horas de su vida máxima. La tienda debe revisar el pedido.",
        });
        const result = update(
          "review",
          age >= policy.maxAuthorizationDays * day
            ? "Autorización vencida: solicite una nueva aprobación antes de enviar o cobrar."
            : "La autorización está cerca del límite de 29 días. Hace falta revisión de la tienda.",
        );
        await notifyShop(result);
        return result;
      }
      if (renewalAge >= policy.honorHours * hour) {
        order = await reauthorize({ orderRef: ref });
        const result = update(
          "ok",
          "PayPal devolvió una reautorización. Se conserva el límite de vida de la aprobación original.",
        );
        await notifyShop(result);
        return result;
      }
      return update(
        "ok",
        renewalAge >= 60 * hour
          ? "La autorización se acerca al fin del período de honor. La revisión automática reautorizará cuando sea elegible."
          : "La autorización está dentro del período de honor. No se necesita reautorizar ahora.",
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No se pudo revisar la autorización";
      const latest = get(ref);
      if (latest.state === "held") {
        await processEvent(ref, {
          id: `maintenance-error:${ref}:${now.toISOString().slice(0, 10)}`,
          kind: "authorization_expiring",
          at: now.toISOString(),
          source: "system",
          text: "La revisión automática no pudo mantener la autorización; la tienda debe revisar el estado.",
        }).catch(() => {});
      }
      return update("review", message);
    }
  });
}
export async function runMaintenance() {
  return locked("maintenance:batch", async () => {
    const now = new Date();
    const eligible = listAll()
      .filter(
        (r) =>
          ["held", "deposit_pending", "review"].includes(r.state) &&
          (!r.maintenance ||
            now.getTime() - Date.parse(r.maintenance.checkedAt) > 10 * 60000),
      )
      .slice(0, 50);
    const results = [];
    for (const order of eligible) {
      const current = await maintainOrder(order.ref, now);
      results.push({ ref: current.ref, ...current.maintenance });
    }
    await flushNotifications();
    return { at: now.toISOString(), checked: results.length, results };
  });
}
export function startMaintenance() {
  const scope = globalThis as typeof globalThis & {
    entregaMaintenanceTimer?: ReturnType<typeof setInterval>;
  };
  if (
    scope.entregaMaintenanceTimer ||
    process.env.MAINTENANCE_ENABLED !== "true"
  )
    return;
  const configured = Number(process.env.MAINTENANCE_INTERVAL_MS || 60000),
    interval = Number.isFinite(configured)
      ? Math.max(30000, configured)
      : 60000;
  scope.entregaMaintenanceTimer = setInterval(() => {
    void runMaintenance().catch((e) =>
      console.error(
        "Maintenance batch failed",
        e instanceof Error ? e.message : "unknown",
      ),
    );
  }, interval);
  scope.entregaMaintenanceTimer.unref();
  console.log("Sandbox maintenance scheduler enabled");
}
