"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Reservation } from "@/lib/types";
export default function Shop() {
  const [orders, setOrders] = useState<Reservation[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/orders")
        .then((r) => r.json())
        .then((d) => {
          if (active) {
            if (d.error) setError(d.error);
            else setOrders(d.orders || []);
          }
        })
        .catch(() => setError("No se pudieron cargar los pedidos."));
    load();
    const t = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);
  return (
    <main className="workspace">
      <div className="workspace-head">
        <div>
          <div className="eyebrow">PASCAL STUDIO / DEMO SHOP PANEL</div>
          <h1>
            Menos comprobantes.
            <br />
            <em>Más claridad.</em>
          </h1>
          <p>Fictional orders from your current demo session.</p>
        </div>
        <Link className="button primary" href="/judge">
          + Create demo order
        </Link>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Total / anticipo</th>
              <th>Estado del dinero</th>
              <th>Último evento</th>
              <th>Regla aplicada</th>
              <th>PayPal evidence</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((r) => (
              <tr key={r.ref}>
                <td>
                  <Link href={`/judge?ref=${r.ref}`}>
                    <strong>{r.product}</strong>
                    <code>{r.ref}</code>
                  </Link>
                </td>
                <td>
                  ${(r.total / 100).toFixed(2)} / $
                  {(r.deposit / 100).toFixed(2)}
                </td>
                <td>
                  <span className={`state-tag ${r.state}`}>{r.state}</span>
                </td>
                <td>{r.events.at(-1)?.kind || "Awaiting delivery"}</td>
                <td>
                  {r.decisions.at(-1)?.reason ||
                    "Pendiente de aprobación del comprador."}
                  {r.events.findLast((e) => e.interpretation)
                    ?.interpretation && (
                    <p className="muted">
                      AI:{" "}
                      {
                        r.events.findLast((e) => e.interpretation)
                          ?.interpretation?.explanation
                      }
                    </p>
                  )}
                </td>
                <td>
                  {r.captures.map((c) => (
                    <code key={c.id}>
                      {c.role}: {c.id} · {c.status}
                    </code>
                  ))}
                  {r.lastWebhook && (
                    <span className="green">Webhook verified ✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && (
          <div className="empty-state">
            <h2>Su primer pedido empieza aquí.</h2>
            <p>
              Cree una compra de demostración para ver el estado del dinero, la
              entrega y las reglas.
            </p>
            <Link className="button primary" href="/judge">
              Open judge demo →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
