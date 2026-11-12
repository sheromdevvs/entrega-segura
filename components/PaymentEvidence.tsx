"use client";
import type { Reservation } from "@/lib/types";
import { usd } from "@/lib/presentation";
import { Icon } from "./Icon";
export function downloadEvidence(order: Reservation, guided = false) {
  const safe = {
    ...order,
    owner: undefined,
    code: "[delivery code omitted]",
    events: order.events.map((e) => ({
      ...e,
      photo: e.photo ? "[attachment omitted]" : undefined,
      code: e.code ? "[omitted]" : undefined,
    })),
    payoutIntent: order.payoutIntent
      ? { ...order.payoutIntent, receiverEmail: "[redacted]" }
      : undefined,
    mode: guided ? "illustrative_guided_view" : "paypal_sandbox",
    exportedAt: new Date().toISOString(),
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `entrega-${order.ref}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PaymentEvidence({
  order,
  guided,
}: {
  order: Reservation;
  guided: boolean;
}) {
  return (
    <div className="evidence-content">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PAYMENT EVIDENCE</span>
          <h2>Una historia que se puede revisar.</h2>
        </div>
        <button
          className="button button-outline button-small"
          onClick={() => downloadEvidence(order, guided)}
        >
          <Icon name="download" size={16} /> Exportar
        </button>
      </div>
      {guided ? (
        <div className="notice">
          <Icon name="info" />
          <div>
            <strong>Esta vista no genera IDs de PayPal.</strong>
            <p>
              Los importes son ilustrativos y se calculan con las mismas reglas
              de entrega. Para revisar respuestas reales, abra un pedido en modo
              Sandbox.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="evidence-identifiers">
            <div>
              <small>Orden PayPal</small>
              <code>{order.paypalOrderId || "Pendiente de creación"}</code>
            </div>
            {order.depositOrderId && (
              <div>
                <small>Orden del anticipo</small>
                <code>{order.depositOrderId}</code>
              </div>
            )}
            <div>
              <small>Autorización</small>
              <code>{order.authorizationId || "Esperando aprobación"}</code>
            </div>
            <div>
              <small>Forma de aprobación</small>
              <span>
                {order.paymentStrategy === "split"
                  ? "Dos órdenes, anticipo y saldo"
                  : "Una orden, capturas parciales"}
              </span>
            </div>
          </div>
          <div className="capture-list">
            {order.captures.map((c) => (
              <details key={c.id}>
                <summary>
                  <Icon name="wallet" size={17} />
                  <span>{c.role === "deposit" ? "Anticipo" : "Saldo"}</span>
                  <strong>{usd(c.amount)}</strong>
                  <code>{c.id}</code>
                  <span className="status-badge">{c.status}</span>
                </summary>
                <pre>{JSON.stringify(c, null, 2)}</pre>
              </details>
            ))}
            {order.refunds.map((r) => (
              <details key={r.id}>
                <summary>
                  <Icon name="undo" size={17} />
                  <span>Reembolso parcial</span>
                  <strong>{usd(r.amount)}</strong>
                  <code>{r.id}</code>
                  <span className="status-badge">{r.status}</span>
                </summary>
                <pre>{JSON.stringify(r, null, 2)}</pre>
              </details>
            ))}
          </div>
          <div
            className={`webhook-status ${order.lastWebhook ? "is-verified" : ""}`}
          >
            <Icon name={order.lastWebhook ? "shield" : "clock"} size={19} />
            <div>
              <strong>
                {order.lastWebhook
                  ? "Firma de PayPal verificada"
                  : "Aún no hay un webhook verificado"}
              </strong>
              <p>
                {order.lastWebhook
                  ? `${order.lastWebhook.type} · verification_status: SUCCESS`
                  : "La firma debe verificarse con PayPal antes de registrar el evento. Este estado nunca se simula."}
              </p>
              {order.lastWebhook && <code>{order.lastWebhook.id}</code>}
            </div>
          </div>
        </>
      )}
      {order.source === "pascal" && !guided && (
        <>
          <div className="audit-label">
            <span>Avisos a Pascal</span>
            <span>Cola de entrega</span>
          </div>
          {order.notifications?.length ? (
            order.notifications.map((n) => (
              <div className="callback-status" key={n.id}>
                <Icon name={n.delivered ? "check" : "clock"} size={15} />
                <span>
                  {n.delivered
                    ? "Recibido por Pascal"
                    : "Pendiente de reintento"}
                </span>
                <small>
                  {n.attempts} intento(s)
                  {n.last_error ? ` · ${n.last_error}` : ""}
                </small>
              </div>
            ))
          ) : (
            <p className="muted empty-inline">
              El aviso se generará cuando cambie el estado del pedido.
            </p>
          )}
        </>
      )}
      <div className="audit-label">
        <span>Registro de llamadas</span>
        <span>
          {guided ? "Sin llamadas de pago" : `${order.calls.length} llamada(s)`}
        </span>
      </div>
      {!order.calls.length && (
        <p className="muted empty-inline">
          {guided
            ? "La vista guiada no se conecta con PayPal."
            : "Las respuestas aparecerán aquí cuando se cree el checkout."}
        </p>
      )}
      <div className="api-calls">
        {order.calls.map((c, i) => (
          <details key={`${i}-${c.at}`}>
            <summary>
              <span
                className={`http-code ${c.status >= 400 ? "has-error" : ""}`}
              >
                {c.status}
              </span>
              <code>
                {c.method} {c.path}
              </code>
              <span className="debug-id">{c.debugId || "Sin debug ID"}</span>
              <Icon name="plus" size={15} />
            </summary>
            <pre>{JSON.stringify(c, null, 2)}</pre>
          </details>
        ))}
      </div>
      <div className="audit-label">
        <span>Eventos y reglas</span>
        <span>{order.events.length} evento(s)</span>
      </div>
      <div className="event-ledger">
        {order.events.length ? (
          order.events.map((e) => (
            <details key={e.id}>
              <summary>
                <span className="tiny-dot" />
                <code>{e.kind}</code>
                <span>{e.decision?.action || "wait"}</span>
                <Icon name="plus" size={15} />
              </summary>
              <pre>
                {JSON.stringify(
                  { ...e, photo: e.photo ? "[image attachment]" : undefined },
                  null,
                  2,
                )}
              </pre>
            </details>
          ))
        ) : (
          <p className="muted empty-inline">
            Todavía no se ha registrado un evento de entrega.
          </p>
        )}
      </div>
      <p className="fine-print">
        Las respuestas excluyen campos personales. Los intentos de pago usan
        identificadores idempotentes para impedir cobros repetidos.
      </p>
    </div>
  );
}
