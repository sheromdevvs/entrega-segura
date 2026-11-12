"use client";
import { useState } from "react";
import type { Reservation } from "@/lib/types";
import { usd } from "@/lib/presentation";
import { Icon } from "./Icon";
export function ShopActions({
  order,
  guided,
  busy,
  onAction,
}: {
  order: Reservation;
  guided: boolean;
  busy: boolean;
  onAction: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [amount, setAmount] = useState("3.00"),
    [receiver, setReceiver] = useState(""),
    [note, setNote] = useState("Entrega del pedido de demostración"),
    [payoutAmount, setPayoutAmount] = useState("3.00"),
    [confirm, setConfirm] = useState(false);
  const defect = order.events.findLast((e) => e.kind === "defect_reported");
  return (
    <div className="operations-content">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SHOP OPERATIONS</span>
          <h2>La tienda tiene la última palabra.</h2>
        </div>
      </div>
      <section className="operation-block">
        <div className="operation-label">
          <Icon name="undo" />
          <div>
            <h3>Revisar un reclamo</h3>
            <p>
              Un defecto con imagen requiere revisión antes de aprobar un
              reembolso parcial.
            </p>
          </div>
        </div>
        {defect ? (
          <>
            <div className="claim-evidence">
              <blockquote>{defect.text}</blockquote>
              {defect.photo && (
                <img
                  src={defect.photo}
                  alt={
                    guided
                      ? "Evidencia sintética de un defecto de demostración"
                      : "Evidencia adjunta al reclamo"
                  }
                />
              )}
              <span className="fine-print">
                {guided
                  ? "Evidencia de demostración; no es un reclamo comercial."
                  : "Imagen aportada en este pedido de prueba."}
              </span>
            </div>
            <div className="operation-form">
              <label>
                Importe a devolver (USD)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <button
                className="button button-black"
                disabled={
                  busy || order.state !== "released" || !!order.refunds.length
                }
                onClick={() =>
                  onAction({
                    action: "refund",
                    amount: Math.round(Number(amount) * 100),
                  })
                }
              >
                Aprobar reembolso{guided ? " ilustrativo" : " Sandbox"}{" "}
                <Icon name="arrow" size={17} />
              </button>
            </div>
            {order.refunds.length > 0 && (
              <p className="result-line">
                <Icon name="check" size={16} /> Reembolso registrado:{" "}
                {usd(order.refunds[0].amount)}. No se volverá a ejecutar.
              </p>
            )}
          </>
        ) : (
          <div className="operation-empty">
            <Icon name="shield" size={24} />
            <span>No hay un defecto reportado en este pedido.</span>
          </div>
        )}
      </section>
      <section className="operation-block">
        <div className="operation-label">
          <Icon name="clock" />
          <div>
            <h3>Vigilar la autorización</h3>
            <p>
              La autorización tiene un plazo limitado. La revisión comprueba el
              estado y reautoriza cuando corresponde.
            </p>
          </div>
        </div>
        {order.maintenance && (
          <p className="operation-result">{order.maintenance.message}</p>
        )}
        <div className="operation-buttons">
          <button
            className="button button-outline button-small"
            disabled={busy || order.state !== "held"}
            onClick={() => onAction({ action: "maintenance" })}
          >
            Revisar autorización <Icon name="refresh" size={15} />
          </button>
          <button
            className="button button-text button-small"
            disabled={busy}
            onClick={() => onAction({ action: "refresh" })}
          >
            Actualizar pagos <Icon name="refresh" size={15} />
          </button>
          {order.source === "pascal" && (
            <button
              className="button button-text button-small"
              disabled={busy}
              onClick={() => onAction({ action: "retry_notifications" })}
            >
              Reintentar aviso a Pascal
            </button>
          )}
        </div>
      </section>
      <section className="operation-block">
        <div className="operation-label">
          <Icon name="truck" />
          <div>
            <h3>Pago al repartidor</h3>
            <p>
              Una operación independiente del saldo del cliente. PayPal Payouts,
              exclusivamente en Sandbox.
            </p>
          </div>
        </div>
        {order.payout ? (
          <div className="notice">
            <Icon name="check" />
            <div>
              <strong>Pago registrado</strong>
              <pre>{JSON.stringify(order.payout, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <>
            <div className="payout-fields">
              <label>
                Correo de la cuenta Sandbox del repartidor
                <input
                  type="email"
                  value={receiver}
                  placeholder="courier@personal.example.com"
                  onChange={(e) => setReceiver(e.target.value)}
                />
              </label>
              <label>
                Importe (USD)
                <input
                  type="number"
                  value={payoutAmount}
                  min="0.01"
                  max="6.50"
                  step="0.01"
                  onChange={(e) => setPayoutAmount(e.target.value)}
                />
              </label>
              <label className="full-width">
                Nota
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                />
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />{" "}
              {guided
                ? "Entiendo que este pago será ilustrativo."
                : "Confirmo que el destinatario pertenece al entorno Sandbox."}
            </label>
            <button
              className="button button-outline"
              disabled={
                busy ||
                !confirm ||
                !receiver.includes("@") ||
                !order.captures.some(
                  (c) => c.role === "balance" && c.status === "COMPLETED",
                )
              }
              onClick={() =>
                onAction({
                  action: "payout",
                  receiverEmail: receiver,
                  amount: Math.round(Number(payoutAmount) * 100),
                  note,
                  confirmPayout: true,
                })
              }
            >
              {guided
                ? "Simular pago al repartidor"
                : "Autorizar pago de prueba"}{" "}
              <Icon name="northeast" size={17} />
            </button>
            <p className="fine-print">
              Disponible después de una entrega cobrada. Puede requerir
              habilitar Payouts en la aplicación de PayPal.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
