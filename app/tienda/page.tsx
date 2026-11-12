"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Reservation } from "@/lib/types";
import { previewShopOrders, previewStorageKey } from "@/lib/demo/preview";
import {
  usd,
  ledger,
  stateLabels,
  eventLabels,
  productImage,
} from "@/lib/presentation";
import { Icon } from "@/components/Icon";
export default function Shop() {
  const router = useRouter();
  const [guided, setGuided] = useState(true),
    [orders, setOrders] = useState<Reservation[]>([]),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [examples] = useState(() => previewShopOrders());
  useEffect(() => {
    if (guided) return;
    let active = true;
    async function load() {
      try {
        const r = await fetch("/api/orders"),
          d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) setOrders(d.orders);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar los pedidos.",
          );
      }
    }
    void load();
    const interval = setInterval(load, 6000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [guided]);
  const all = guided ? examples : orders;
  const filtered = useMemo(
    () =>
      all.filter((r) => {
        const term = query.toLocaleLowerCase();
        const matches = `${r.ref} ${r.product}`
          .toLocaleLowerCase()
          .includes(term);
        const review =
          r.decisions.at(-1)?.action === "ask_shop" || r.state === "review";
        return (
          matches &&
          (filter === "all" ||
            (filter === "review" && review) ||
            (filter === "held" && r.state === "held") ||
            (filter === "resolved" &&
              ["released", "voided", "refunded"].includes(r.state)))
        );
      }),
    [all, query, filter],
  );
  const stats = all.reduce(
    (n, r) => {
      const m = ledger(r);
      return {
        collected: n.collected + m.collected,
        held: n.held + m.held,
        reviews:
          n.reviews +
          (r.decisions.at(-1)?.action === "ask_shop" || r.state === "review"
            ? 1
            : 0),
      };
    },
    { collected: 0, held: 0, reviews: 0 },
  );
  const activity = all
    .flatMap((r) => r.events.map((e) => ({ order: r, event: e })))
    .sort((a, b) => Date.parse(b.event.at) - Date.parse(a.event.at))
    .slice(0, 4);
  function open(r: Reservation) {
    if (guided) {
      localStorage.setItem(previewStorageKey, JSON.stringify(r));
      router.push("/judge?mode=guided");
    } else router.push(`/judge?mode=sandbox&ref=${r.ref}`);
  }
  function exportOrders() {
    const safe = all.map((r) => ({
      reference: r.ref,
      product: r.product,
      total: r.total,
      state: r.state,
      decision: r.decisions.at(-1),
      ...ledger(r),
    }));
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { mode: guided ? "illustrative" : "sandbox", orders: safe },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "entrega-pedidos.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main id="content" className="workspace">
      <div className="workspace-top">
        <div className="breadcrumbs">
          <Link href="/">Entrega Segura</Link>
          <span>/</span>
          <span>Shop workspace</span>
        </div>
        <div className="mode-switch" aria-label="Origen de los pedidos">
          <button
            className={guided ? "is-selected" : ""}
            aria-pressed={guided}
            onClick={() => setGuided(true)}
          >
            Vista guiada
          </button>
          <button
            className={!guided ? "is-selected" : ""}
            aria-pressed={!guided}
            onClick={() => setGuided(false)}
          >
            Mis pedidos Sandbox
          </button>
        </div>
      </div>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">
            PASCAL STUDIO / TIENDA DE DEMOSTRACIÓN
          </span>
          <h1>
            Usted crea.
            <br />
            <span>El resto, en orden.</span>
          </h1>
        </div>
        <div className="workspace-intro">
          <p>
            El anticipo, el saldo y las incidencias de entrega, en un solo
            lugar. Sin revisar capturas de transferencias.
          </p>
          <div className="hero-actions">
            <Link
              className="button button-black"
              href={guided ? "/judge" : "/judge?mode=sandbox"}
            >
              <Icon name="plus" size={16} /> Nuevo pedido
            </Link>
            <button
              className="icon-button"
              aria-label="Exportar pedidos"
              onClick={exportOrders}
            >
              <Icon name="download" size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="mode-notice">
        <Icon name="eye" size={17} />
        <span>
          {guided
            ? "Pedidos y movimientos ilustrativos. Esta vista muestra cómo se vería la operación de una tienda."
            : "Solo aparecen los pedidos Sandbox de esta sesión. No hay pedidos comerciales ni datos de clientes reales."}
        </span>
      </div>
      {error && (
        <div className="feedback feedback-error" role="alert">
          <Icon name="info" />
          <p>{error}</p>
        </div>
      )}
      <section className="shop-metrics" aria-label="Resumen de la tienda">
        <div>
          <small>Pedidos</small>
          <strong>{all.length.toString().padStart(2, "0")}</strong>
          <span>
            {guided ? "Ejemplos de demostración" : "De esta sesión Sandbox"}
          </span>
        </div>
        <div>
          <small>Importe cobrado neto</small>
          <strong>{usd(stats.collected)}</strong>
          <span>Anticipos + saldos − reembolsos</span>
        </div>
        <div>
          <small>Saldo autorizado</small>
          <strong>{usd(stats.held)}</strong>
          <span>Pendiente de entregar</span>
        </div>
        <div>
          <small>Necesitan su revisión</small>
          <strong>{stats.reviews.toString().padStart(2, "0")}</strong>
          <span>Una decisión humana pendiente</span>
        </div>
      </section>
      <div className="shop-controls">
        <label className="shop-search">
          <Icon name="search" size={17} />
          <span className="sr-only">Buscar pedido o producto</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pedido o producto"
          />
        </label>
        <div className="shop-filters" aria-label="Filtrar pedidos">
          {[
            { id: "all", label: "Todos" },
            { id: "held", label: "Saldo autorizado" },
            { id: "review", label: "Por revisar" },
            { id: "resolved", label: "Resueltos" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={filter === f.id ? "is-selected" : ""}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="orders-table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Pedido / producto</th>
              <th>Total / anticipo</th>
              <th>Estado del dinero</th>
              <th>Entrega</th>
              <th>Última decisión</th>
              <th>
                <span className="sr-only">Abrir pedido</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.ref} onClick={() => open(r)}>
                <td>
                  <div className="table-product">
                    <img src={productImage(r.product)} alt="" />
                    <div>
                      <strong>{r.product}</strong>
                      <code>{r.ref}</code>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{usd(r.total)}</strong>
                  <small>Anticipo: {usd(r.deposit)}</small>
                </td>
                <td>
                  <span className={`status-badge state-${r.state}`}>
                    <span className="tiny-dot" />
                    {stateLabels[r.state]}
                  </span>
                </td>
                <td>
                  {r.events.at(-1)
                    ? eventLabels[r.events.at(-1)!.kind]
                    : "En preparación"}
                  <small>
                    {guided
                      ? "Courier simulado"
                      : r.lastWebhook
                        ? "PayPal verificado"
                        : "Esperando notificación"}
                  </small>
                </td>
                <td className="table-rule">
                  {r.decisions.at(-1)?.reason ||
                    "El saldo espera la confirmación de entrega."}
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Abrir pedido ${r.ref}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      open(r);
                    }}
                  >
                    <Icon name="northeast" size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="table-empty">
            <Icon name="box" size={32} />
            <h3>
              {all.length
                ? "No hay pedidos con este filtro."
                : "Cada regalo empieza con un pedido."}
            </h3>
            <p>
              {all.length
                ? "Pruebe otra búsqueda o consulte todos los pedidos."
                : "Cree su primer checkout Sandbox para ver su estado aquí."}
            </p>
            <Link href="/judge?mode=sandbox" className="button button-black">
              Crear un pedido <Icon name="arrow" size={16} />
            </Link>
          </div>
        )}
        <div className="table-footer">
          <span>
            {filtered.length} de {all.length} pedidos
          </span>
          <span>
            USD · {guided ? "Importes ilustrativos" : "PayPal Sandbox"}
          </span>
        </div>
      </div>
      <div className="shop-bottom">
        <section className="shop-activity">
          <h2>Lo último en las entregas.</h2>
          <p>Eventos claros. Decisiones que se pueden explicar.</p>
          {activity.length ? (
            activity.map(({ order: r, event: e }) => (
              <div key={`${r.ref}-${e.id}`} className="activity-row">
                <span>
                  <Icon
                    name={
                      e.kind === "delivered"
                        ? "check"
                        : e.kind === "refused"
                          ? "undo"
                          : "clock"
                    }
                    size={14}
                  />
                </span>
                <div>
                  <strong>{eventLabels[e.kind]}</strong>
                  <p>{e.decision?.reason || e.text}</p>
                  <code>{r.ref}</code>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-rule-note">
              <Icon name="clock" />
              <p>
                La actividad aparecerá al recibir el primer mensaje o evento del
                courier simulado.
              </p>
            </div>
          )}
        </section>
        <section className="shop-photo-note">
          <img
            src="/images/made-with-care.webp"
            alt="Preparación de un regalo personalizado; imagen creada con IA"
          />
          <div>
            <h3>
              Más tiempo
              <br />
              para lo que crea.
            </h3>
            <Link href="/judge">
              Recorrer un pedido completo <Icon name="arrow" size={16} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
