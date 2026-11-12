"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Reservation, DeliveryEvent, EventKind } from "@/lib/types";
import type { ParsedMessage } from "@/lib/ai";
import {
  catalogue,
  usd,
  stateLabels,
  eventLabels,
  ledger,
  productImage,
} from "@/lib/presentation";
import {
  createPreview,
  previewEvent,
  previewRefund,
  previewStorageKey,
} from "@/lib/demo/preview";
import { Icon, type IconName } from "@/components/Icon";
import { MessageComposer } from "@/components/MessageComposer";
import {
  PaymentEvidence,
  downloadEvidence,
} from "@/components/PaymentEvidence";
import { ShopActions } from "@/components/ShopActions";
const tabs = [
  { id: "conversation", label: "La conversación", icon: "wave" },
  { id: "evidence", label: "Evidencia de pago", icon: "document" },
  { id: "operations", label: "Revisión de tienda", icon: "grid" },
] as const;
type Tab = (typeof tabs)[number]["id"];
export default function Judge() {
  const search = useSearchParams(),
    router = useRouter();
  const guided = search.get("mode") !== "sandbox" && !search.get("ref");
  const [preview, setPreview] = useState<Reservation>(() => createPreview()),
    [ready, setReady] = useState(false),
    [order, setOrder] = useState<Reservation | null>(null),
    [orders, setOrders] = useState<Reservation[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [product, setProduct] = useState("hoodie"),
    [strategy, setStrategy] = useState("single"),
    [tab, setTab] = useState<Tab>("conversation"),
    [preset, setPreset] = useState(""),
    [config, setConfig] = useState<{
      paypalConfigured: boolean;
      aiConfigured: boolean;
      webhookConfigured: boolean;
    }>();
  const current = guided ? preview : order;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(previewStorageKey);
      if (raw) {
        const r = JSON.parse(raw);
        if (
          r.owner === "browser-preview" &&
          Array.isArray(r.captures) &&
          Array.isArray(r.events) &&
          Array.isArray(r.decisions) &&
          Array.isArray(r.refunds) &&
          Number.isInteger(r.total) &&
          Number.isInteger(r.deposit) &&
          r.currency === "USD"
        ) {
          setPreview(r);
          setProduct(
            catalogue.find((p) => p.name === r.product)?.id || "hoodie",
          );
        }
      }
    } catch {}
    setReady(true);
    fetch("/api/health")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(previewStorageKey, JSON.stringify(preview));
  }, [preview, ready]);
  const load = useCallback(async () => {
    const response = await fetch("/api/orders"),
      data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setOrders(data.orders);
    return data.orders as Reservation[];
  }, []);
  useEffect(() => {
    if (guided) return;
    let active = true;
    load()
      .then((items) => {
        if (!active) return;
        const ref = search.get("ref");
        const selected =
          items.find((x) => x.ref === ref) || (!ref ? items[0] : undefined);
        setOrder(selected || null);
        if (ref && !selected)
          setError(
            "Este pedido pertenece a otra sesión o ya no está disponible. Puede crear uno nuevo.",
          );
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [guided, load, search]);
  useEffect(() => {
    if (guided || !order?.ref) return;
    let active = true;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/orders/${order.ref}`);
        if (r.ok && active) setOrder(await r.json());
      } catch {}
    }, 6000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [guided, order?.ref]);
  function newExample(id: string) {
    return {
      ...createPreview(id),
      ref: `VISTA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    };
  }
  function reset() {
    setPreview(newExample(product));
    setTab("conversation");
    setError("");
    setNotice("Nuevo ejemplo listo. No se ha llamado a PayPal.");
    setPreset("");
  }
  async function create() {
    setError("");
    setNotice("");
    if (guided) {
      reset();
      return;
    }
    setBusy("create");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product, paymentStrategy: strategy }),
      });
      const d = await response.json();
      if (!response.ok) throw new Error(d.error);
      setOrder(d);
      setTab("conversation");
      await load();
      router.replace(`/judge?mode=sandbox&ref=${d.ref}`, { scroll: false });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo crear el checkout.",
      );
      await load().catch(() => {});
    } finally {
      setBusy("");
    }
  }
  async function action(body: Record<string, unknown>) {
    if (!current) return;
    setError("");
    setNotice("");
    if (guided) {
      try {
        if (body.action === "refund")
          setPreview(previewRefund(current, Number(body.amount)));
        if (body.action === "maintenance")
          setPreview({
            ...current,
            maintenance: {
              checkedAt: new Date().toISOString(),
              status: "ok",
              message:
                "La vista guiada usa una autorización ilustrativa vigente. La revisión real está disponible en Sandbox.",
            },
          });
        if (body.action === "refresh")
          setNotice(
            "Los importes de esta vista son ilustrativos. PayPal no se ha consultado.",
          );
        if (body.action === "payout") {
          if (
            !current.captures.some(
              (c) => c.role === "balance" && c.status === "COMPLETED",
            )
          )
            throw new Error("Primero debe completarse una entrega.");
          const amount = Number(body.amount);
          if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 650)
            throw new Error(
              "El pago de demostración debe estar entre $0.01 y $6.50.",
            );
          setPreview({
            ...current,
            payout: {
              mode: "ILLUSTRATIVE",
              status: "SIMULATED",
              amount: usd(amount),
              note: String(body.note),
            },
          });
        }
        return;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Revise la acción.");
        return;
      }
    }
    setBusy(String(body.action));
    try {
      const response = await fetch(`/api/orders/${current.ref}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await response.json();
      if (d.order) setOrder(d.order);
      if (!response.ok) throw new Error(d.error);
      setNotice(
        body.action === "approve"
          ? "Aprobación comprobada y estado de pago actualizado."
          : "La operación se actualizó.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "La acción necesita revisión.");
    } finally {
      setBusy("");
    }
  }
  async function message(text: string, photo?: string) {
    if (!current) return;
    setBusy("message");
    setError("");
    setNotice("");
    try {
      if (guided) {
        const response = await fetch("/api/ai/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, photo }),
        });
        const d = await response.json();
        if (!response.ok) throw new Error(d.error);
        const interpretation = d.ai as ParsedMessage;
        const eventId = crypto.randomUUID();
        const next = previewEvent(current, {
          id: eventId,
          kind: interpretation.kind,
          code: text.match(/\b\d{4}\b/)?.[0],
          at: new Date().toISOString(),
          source: "chat",
          text,
          photo,
          hasPhoto: !!photo,
          interpretation,
        });
        setPreview(next);
        try {
          const explanationResponse = await fetch("/api/ai/explain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next.events.at(-1)?.decision),
          });
          if (explanationResponse.ok) {
            const explained = await explanationResponse.json();
            if (explained.explanation)
              setPreview((previous) => ({
                ...previous,
                events: previous.events.map((e) =>
                  e.id === eventId
                    ? { ...e, gateExplanation: explained.explanation }
                    : e,
                ),
              }));
          }
        } catch {}
      } else {
        const response = await fetch(`/api/orders/${current.ref}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "message", text, photo }),
        });
        const d = await response.json();
        if (d.order) setOrder(d.order);
        if (!response.ok) throw new Error(d.error);
        await load();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo interpretar el mensaje.",
      );
    } finally {
      setBusy("");
    }
  }
  function scenario(kind: EventKind) {
    if (!current) return;
    setError("");
    setNotice("");
    if (!guided) {
      if (kind === "defect_reported") {
        setPreset("El producto llegó roto. Adjunto una foto del daño.");
        document.getElementById("delivery-message")?.focus();
        return;
      }
      void action({ action: "scenario", scenario: kind });
      return;
    }
    const e = (
      type: EventKind,
      text: string,
      code?: string,
    ): DeliveryEvent => ({
      id: crypto.randomUUID(),
      kind: type,
      at: new Date().toISOString(),
      source: "simulated_laar",
      text,
      code,
    });
    let r = current;
    if (kind === "defect_reported") {
      r = newExample("mug");
      setProduct("mug");
      r = previewEvent(
        r,
        e("delivered", "El comprador recibió el pedido completo.", r.code),
      );
      r = previewEvent(r, {
        ...e(
          kind,
          "La taza llegó con una grieta. Adjunto una imagen sintética para revisar el ejemplo.",
        ),
        hasPhoto: true,
        photo: "/images/defect-evidence.webp",
      });
      setPreview(r);
      setTab("operations");
      return;
    }
    if (["released", "voided", "refunded"].includes(r.state)) {
      r = newExample(
        catalogue.find((p) => p.name === r.product)?.id || product,
      );
      setNotice("Se cargó otro ejemplo para explorar este desenlace.");
    }
    const texts: Partial<Record<EventKind, string>> = {
      delivered: `Ya entregué el pedido completo. El código es ${r.code}.`,
      refused: "El comprador rechazó la entrega en la puerta.",
      not_home: "No había nadie en casa. Dejé un aviso.",
      partial_delivery:
        "Solo se entregó una parte del pedido; falta un artículo.",
    };
    setPreview(
      previewEvent(
        r,
        e(
          kind,
          texts[kind] || "Mensaje por revisar",
          kind === "delivered" ? r.code : undefined,
        ),
      ),
    );
    setTab("conversation");
  }
  const amounts = current ? ledger(current) : null,
    last = current?.events.at(-1),
    decision = last?.decision || current?.decisions.at(-1),
    ai = last?.interpretation;
  const awaiting =
    current &&
    ["awaiting_approval", "awaiting_balance_approval", "authorized"].includes(
      current.state,
    );
  const done =
    current && ["released", "voided", "refunded"].includes(current.state);
  const phases = [
    {
      title: "Aprobar la compra",
      description: guided
        ? "Ejemplo de una aprobación"
        : current?.paypalOrderId || "Checkout del comprador",
      done: guided || !!current?.authorizationId,
    },
    {
      title: "Empezar a crear",
      description: "Anticipo para producción",
      done: !!amounts?.deposit,
    },
    {
      title: "Entender la entrega",
      description: "Mensaje, nota de voz o imagen",
      done: !!current?.events.length,
    },
    {
      title: "Resolver el saldo",
      description: "Regla de entrega aplicada",
      done: !!done,
    },
    ...(!guided
      ? [
          {
            title: "Verificar la notificación",
            description: current?.lastWebhook
              ? "Firma confirmada por PayPal"
              : "Esperando webhook auténtico",
            done: !!current?.lastWebhook,
          },
        ]
      : []),
  ];
  return (
    <main id="content" className="workspace">
      <div className="workspace-top">
        <div className="breadcrumbs">
          <Link href="/">Entrega Segura</Link>
          <span>/</span>
          <span>Judge demo</span>
        </div>
        <div className="mode-switch" aria-label="Modo de demostración">
          <button
            className={guided ? "is-selected" : ""}
            aria-pressed={guided}
            onClick={() => {
              router.push("/judge?mode=guided");
              setError("");
              setNotice("");
            }}
          >
            Vista guiada
          </button>
          <button
            className={!guided ? "is-selected" : ""}
            aria-pressed={!guided}
            onClick={() => {
              router.push("/judge?mode=sandbox");
              setError("");
              setNotice("");
            }}
          >
            PayPal Sandbox <Icon name="northeast" size={12} />
          </button>
        </div>
      </div>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">UN PEDIDO, DE PRINCIPIO A FIN</span>
          <h1>
            Todo llega.
            <br />
            <span>Todo queda claro.</span>
          </h1>
        </div>
        <div className="workspace-intro">
          <p>
            {guided
              ? "Recorra la compra, la entrega y sus posibles desenlaces. Sin entrar a PayPal."
              : "Siga una orden real de PayPal Sandbox. Cada movimiento conserva su respuesta y sus IDs."}
          </p>
          <span className="mode-caption">
            <span className="tiny-dot" />
            {guided
              ? "Movimientos ilustrativos · IA real al escribir"
              : "Integración Sandbox · Sin dinero real"}
          </span>
        </div>
      </div>
      <div className={`mode-notice ${guided ? "is-guided" : ""}`}>
        <Icon name={guided ? "eye" : "shield"} size={17} />
        <span>
          {guided
            ? "Vista guiada: puede explorar todas las reglas. Los cobros y reembolsos se ilustran en este navegador; no se envían a PayPal."
            : "Entorno de prueba: la aprobación debe ocurrir en PayPal Sandbox. No se simulan cobros ni firmas verificadas."}
        </span>
      </div>
      <div className="order-toolbar">
        <div className="toolbar-fields">
          <label>
            Producto
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              {catalogue.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {usd(p.total)}
                </option>
              ))}
            </select>
          </label>
          {!guided && (
            <label>
              Aprobación
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                <option value="single">Una aprobación</option>
                <option value="split">Dos aprobaciones · compatibilidad</option>
              </select>
            </label>
          )}
        </div>
        <div className="toolbar-actions">
          {!guided && orders.length > 0 && (
            <select
              aria-label="Elegir pedido Sandbox"
              value={order?.ref || ""}
              onChange={(e) =>
                router.replace(`/judge?mode=sandbox&ref=${e.target.value}`, {
                  scroll: false,
                })
              }
            >
              <option value="" disabled>
                Sus pedidos
              </option>
              {orders.map((r) => (
                <option key={r.ref} value={r.ref}>
                  {r.ref} · {stateLabels[r.state]}
                </option>
              ))}
            </select>
          )}
          <button
            className="button button-black"
            disabled={!!busy}
            onClick={create}
          >
            {busy === "create" ? (
              <span className="spinner" />
            ) : (
              <Icon name="plus" size={16} />
            )}{" "}
            {guided ? "Reiniciar ejemplo" : "Crear pedido Sandbox"}
          </button>
        </div>
      </div>
      {error && (
        <div className="feedback feedback-error" role="alert">
          <Icon name="info" size={19} />
          <div>
            <strong>Hace falta revisar un detalle.</strong>
            <p>{error}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar aviso"
            onClick={() => setError("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="feedback" role="status">
          <Icon name="check" size={17} />
          <p>{notice}</p>
          <button
            className="icon-button"
            aria-label="Cerrar aviso"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {!current ? (
        <section className="workspace-empty">
          <div className="empty-photo">
            <img
              src="/images/delivery-editorial.webp"
              alt="Una entrega de regalo personalizada"
            />
          </div>
          <div>
            <span className="eyebrow">PAYPAL SANDBOX</span>
            <h2>
              El primer pedido
              <br />
              empieza con una aprobación.
            </h2>
            <p>
              Elija un producto y cree el checkout. La tienda recibe el anticipo
              después de que el comprador apruebe el pago de prueba.
            </p>
            <button
              className="button button-black"
              onClick={create}
              disabled={!!busy}
            >
              Crear pedido <Icon name="arrow" size={17} />
            </button>
            <div className="setup-summary">
              <span>
                <Icon
                  name={config?.paypalConfigured ? "check" : "clock"}
                  size={14}
                />{" "}
                PayPal{" "}
                {config?.paypalConfigured ? "configurado" : "por configurar"}
              </span>
              <span>
                <Icon
                  name={config?.aiConfigured ? "check" : "clock"}
                  size={14}
                />{" "}
                IA {config?.aiConfigured ? "configurada" : "por configurar"}
              </span>
            </div>
            <p className="fine-print">
              Use una cuenta personal de PayPal Sandbox. La vista guiada está
              disponible sin esa aprobación.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="selected-order">
            <div className="selected-order-product">
              <img src={productImage(current.product)} alt={current.product} />
              <div>
                <span>
                  {current.source === "pascal"
                    ? "PASCAL STUDIO / INTEGRACIÓN"
                    : "PASCAL STUDIO / PEDIDO FICTICIO"}
                </span>
                <strong>{current.product}</strong>
                <code>{current.ref}</code>
              </div>
            </div>
            <div className="selected-order-end">
              <span className={`status-badge state-${current.state}`}>
                <span className="tiny-dot" />
                {stateLabels[current.state]}
              </span>
              {current.source === "pascal" && (
                <a href="/api/integrations/pascal/return" className="text-link">
                  Ver en Pascal <Icon name="northeast" size={14} />
                </a>
              )}
              <button
                className="icon-button"
                aria-label="Exportar evidencia del pedido"
                onClick={() => downloadEvidence(current, guided)}
              >
                <Icon name="download" size={18} />
              </button>
            </div>
          </div>
          <section className="money-overview" aria-label="Estado del dinero">
            <div>
              <span>Total del producto</span>
              <strong>{usd(current.total)}</strong>
              <small>USD · Envío no incluido</small>
            </div>
            <div>
              <span>Anticipo para crear</span>
              <strong>{usd(amounts!.deposit)}</strong>
              <small>
                {amounts!.deposit
                  ? guided
                    ? "Cobro ilustrativo"
                    : "Capturado"
                  : "Pendiente de aprobación"}
              </small>
            </div>
            <div>
              <span>Saldo autorizado</span>
              <strong>{usd(amounts!.held)}</strong>
              <small>
                {current.state === "voided"
                  ? "Autorización anulada"
                  : "Autorización con plazo limitado"}
              </small>
            </div>
            <div>
              <span>
                {amounts!.refunded ? "Importe devuelto" : "Saldo al recibir"}
              </span>
              <strong>{usd(amounts!.refunded || amounts!.balance)}</strong>
              <small>
                {amounts!.refunded
                  ? "Reembolso parcial"
                  : amounts!.balance
                    ? guided
                      ? "Cobro ilustrativo"
                      : "Capturado"
                    : "Pendiente de entrega"}
              </small>
            </div>
          </section>
          <div className="workspace-grid">
            <aside className="journey-nav">
              <span className="eyebrow">EL RECORRIDO</span>
              <ol>
                {phases.map((phase, i) => (
                  <li
                    key={phase.title}
                    className={phase.done ? "is-complete" : ""}
                  >
                    <span>
                      {phase.done ? (
                        <Icon name="check" size={13} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <div>
                      <strong>{phase.title}</strong>
                      <small>{phase.description}</small>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="journey-note">
                <Icon name="shield" size={20} />
                <h3>Lo importante, a la vista.</h3>
                <p>
                  {guided
                    ? "Pruebe los desenlaces. Las reglas son las mismas que en el modo Sandbox."
                    : "Un movimiento solo se muestra como completado después de confirmarlo con PayPal."}
                </p>
              </div>
              <button className="text-link" onClick={() => setTab("evidence")}>
                Ver la evidencia <Icon name="arrow" size={14} />
              </button>
            </aside>
            <div className="workspace-main">
              <div
                className="workspace-tabs"
                role="tablist"
                aria-label="Detalle del pedido"
              >
                {tabs.map((item, i) => (
                  <button
                    key={item.id}
                    id={`tab-${item.id}`}
                    role="tab"
                    aria-selected={tab === item.id}
                    aria-controls={`panel-${item.id}`}
                    tabIndex={tab === item.id ? 0 : -1}
                    className={tab === item.id ? "is-selected" : ""}
                    onClick={() => setTab(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        const next =
                          (i + (e.key === "ArrowRight" ? 1 : 2)) % tabs.length;
                        setTab(tabs[next].id);
                        document
                          .getElementById(`tab-${tabs[next].id}`)
                          ?.focus();
                      }
                    }}
                  >
                    <Icon name={item.icon} size={16} />
                    {item.label}
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
              >
                {tab === "conversation" ? (
                  <>
                    {awaiting && (
                      <section className="buyer-approval">
                        <div className="approval-icon">
                          <Icon name="wallet" size={25} />
                        </div>
                        <div>
                          <span className="eyebrow">
                            PRIMERO, LA APROBACIÓN
                          </span>
                          <h2>
                            {current.state === "awaiting_balance_approval"
                              ? "El anticipo está listo. Falta autorizar el saldo."
                              : "Una compra con las condiciones claras."}
                          </h2>
                          <p>
                            El total es {usd(current.total)}. El anticipo de{" "}
                            {usd(current.deposit)} financia la producción; el
                            saldo se cobra al confirmar la entrega completa.
                          </p>
                          <p className="policy-disclosure">
                            Si rechaza la entrega de un producto personalizado,
                            se anula el saldo y se conserva el anticipo
                            informado. Un defecto requiere revisión. Los
                            derechos del comprador y las disputas de PayPal
                            siguen aplicando.
                          </p>
                          <div className="approval-actions">
                            {current.approvalUrl ? (
                              <a
                                href={current.approvalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="button button-black"
                              >
                                Aprobar en PayPal Sandbox{" "}
                                <Icon name="northeast" size={16} />
                              </a>
                            ) : (
                              <button
                                className="button button-black"
                                disabled={!!busy}
                                onClick={() =>
                                  action({ action: "retry_checkout" })
                                }
                              >
                                Reintentar checkout
                              </button>
                            )}
                            <button
                              className="button button-outline"
                              disabled={!!busy}
                              onClick={() => action({ action: "approve" })}
                            >
                              {busy === "approve" ? (
                                <span className="spinner" />
                              ) : (
                                <Icon name="refresh" size={16} />
                              )}{" "}
                              Ya aprobé · comprobar
                            </button>
                          </div>
                        </div>
                      </section>
                    )}
                    <div className="conversation-grid">
                      <section className="buyer-receipt">
                        <div className="conversation-person">
                          <span className="person-avatar">D</span>
                          <div>
                            <strong>Daniela R.</strong>
                            <small>Compradora · Chat simulado</small>
                          </div>
                          <Icon name="dots" size={19} />
                        </div>
                        <div className="buyer-messages">
                          <div className="chat-bubble">
                            Quisiera un regalo personalizado. ¿Cómo funciona el
                            pago?
                          </div>
                          <div className="chat-bubble from-shop">
                            El anticipo es {usd(current.deposit)}. El saldo se
                            cobra cuando usted reciba el pedido completo.
                          </div>
                        </div>
                        <div className="delivery-code">
                          <Icon name="box" size={23} />
                          <span>SU CÓDIGO DE ENTREGA</span>
                          <strong>
                            {current.code.split("").map((n, i) => (
                              <span key={i}>{n}</span>
                            ))}
                          </strong>
                          <p>
                            Compártalo al recibir
                            <br />
                            el pedido completo.
                          </p>
                        </div>
                        <div className="buyer-proof">
                          <Icon name="shield" size={15} />
                          {guided
                            ? "Condiciones ilustradas en la demo"
                            : "Condiciones informadas antes de aprobar"}
                        </div>
                      </section>
                      <section className="courier-conversation">
                        <div className="conversation-person">
                          <span className="person-avatar dark-avatar">
                            <Icon name="truck" size={18} />
                          </span>
                          <div>
                            <strong>Lo que pasó en la entrega</strong>
                            <small>
                              Comprador o repartidor · Chat simulado
                            </small>
                          </div>
                          <span className="conversation-ai">
                            <Icon name="sparkle" size={15} /> IA
                          </span>
                        </div>
                        <div className="delivery-messages" aria-live="polite">
                          {!current.events.length ? (
                            <div className="conversation-welcome">
                              <Icon name="wave" size={32} />
                              <h3>Con sus palabras.</h3>
                              <p>
                                “Ya entregué”, “no había nadie” o “llegó con un
                                daño”. Cuéntenos qué ocurrió.
                              </p>
                              <span>
                                Escriba un mensaje, grabe una nota o adjunte una
                                imagen.
                              </span>
                            </div>
                          ) : (
                            current.events.slice(-3).map((event) => (
                              <div className="delivery-message" key={event.id}>
                                <div className="message-provenance">
                                  <span>
                                    {event.source === "simulated_laar"
                                      ? "Courier simulado"
                                      : "Mensaje recibido"}
                                  </span>
                                  <span>{eventLabels[event.kind]}</span>
                                </div>
                                <p>{event.text}</p>
                                {event.photo && (
                                  <img
                                    className="message-photo"
                                    src={event.photo}
                                    alt={
                                      guided
                                        ? "Imagen sintética del defecto en la demostración"
                                        : "Imagen adjunta a la entrega"
                                    }
                                  />
                                )}
                              </div>
                            ))
                          )}
                          {busy === "message" && (
                            <div className="thinking" role="status">
                              <span />
                              <span />
                              <span /> Interpretando el mensaje…
                            </div>
                          )}
                        </div>
                        <MessageComposer
                          busy={!!busy}
                          code={current.code}
                          preset={preset}
                          onError={setError}
                          onSend={message}
                        />
                      </section>
                    </div>
                    {ai && (
                      <div className="ai-interpretation">
                        <div className="ai-interpretation-label">
                          <Icon name="sparkle" size={17} />
                          <span>INTERPRETACIÓN DE IA</span>
                          <code>{ai.kind}</code>
                        </div>
                        <p>{ai.explanation}</p>
                        <details>
                          <summary>
                            Respuesta sugerida <Icon name="down" size={13} />
                          </summary>
                          <blockquote>{ai.reply}</blockquote>
                          <button
                            className="text-link"
                            onClick={() => {
                              navigator.clipboard
                                .writeText(ai.reply)
                                .then(() =>
                                  setNotice(
                                    "Respuesta copiada. No se envió ningún WhatsApp.",
                                  ),
                                )
                                .catch(() =>
                                  setError(
                                    "No se pudo copiar; puede seleccionar el texto.",
                                  ),
                                );
                            }}
                          >
                            Copiar respuesta
                          </button>
                        </details>
                        <span className="model-provenance">
                          {ai.provider} / {ai.model} · El modelo no ejecuta
                          pagos
                        </span>
                      </div>
                    )}
                    <div className="gate-result">
                      <span className="gate-icon">
                        <Icon
                          name={
                            decision?.action === "release"
                              ? "check"
                              : decision?.action === "cancel"
                                ? "undo"
                                : decision?.action === "ask_shop"
                                  ? "eye"
                                  : "clock"
                          }
                          size={22}
                        />
                      </span>
                      <div>
                        <span className="eyebrow">REGLA DETERMINISTA</span>
                        <h3>
                          {decision
                            ? {
                                release: "Entrega confirmada. Saldo resuelto.",
                                cancel: "Entrega rechazada. Saldo anulado.",
                                wait: "Esperar también es una decisión.",
                                ask_shop: "Ahora, revisa la tienda.",
                                refund_partial:
                                  "Reembolso aprobado por la tienda.",
                              }[decision.action]
                            : "La siguiente decisión empieza con evidencia."}
                        </h3>
                        <p>
                          {decision?.reason ||
                            "El mensaje, el código y el estado del pedido determinan qué puede ocurrir con el saldo."}
                        </p>
                        {last?.gateExplanation && (
                          <p className="gate-ai-explanation">
                            {last.gateExplanation.text}
                            <small>
                              {last.gateExplanation.provider} · Explicación de
                              la regla
                            </small>
                          </p>
                        )}
                      </div>
                      <span className="rule-label">
                        {decision
                          ? {
                              release: "Cobrar saldo",
                              cancel: "Anular saldo",
                              wait: "En espera",
                              ask_shop: "Revisar",
                              refund_partial: "Reembolsar",
                            }[decision.action]
                          : "Por recibir"}
                      </span>
                    </div>
                    {current.lastError && (
                      <div className="feedback feedback-error">
                        <Icon name="info" />
                        <div>
                          <p>{current.lastError}</p>
                          <button
                            className="text-link"
                            onClick={() => action({ action: "retry_event" })}
                            disabled={!!busy}
                          >
                            Reintentar la misma operación
                          </button>
                        </div>
                      </div>
                    )}
                    <section className="scenario-section">
                      <div>
                        <span className="eyebrow">
                          OTRA ENTREGA, OTRO DESENLACE
                        </span>
                        <p>
                          {guided
                            ? "Explore las reglas con eventos e imágenes de demostración."
                            : "Estos botones generan eventos de courier simulados. Los pagos siguen siendo llamadas reales al Sandbox."}
                        </p>
                      </div>
                      <div className="scenario-grid">
                        {(
                          [
                            {
                              kind: "delivered",
                              name: "Entrega confirmada",
                              detail: "Código correcto",
                              icon: "check",
                            },
                            {
                              kind: "refused",
                              name: "Rechazo en la puerta",
                              detail: "Anular solo el saldo",
                              icon: "undo",
                            },
                            {
                              kind: "not_home",
                              name: "No está en casa",
                              detail: `Intento ${Math.min((current.events.filter((e) => e.kind === "not_home").length || 0) + 1, 2)} de 2`,
                              icon: "clock",
                            },
                            {
                              kind: "partial_delivery",
                              name: "Entrega incompleta",
                              detail: "Revisión de la tienda",
                              icon: "box",
                            },
                            {
                              kind: "defect_reported",
                              name: "Un defecto al recibir",
                              detail: guided
                                ? "Imagen sintética incluida"
                                : "Adjuntar imagen",
                              icon: "image",
                            },
                          ] as {
                            kind: EventKind;
                            name: string;
                            detail: string;
                            icon: IconName;
                          }[]
                        ).map((s) => (
                          <button
                            key={s.kind}
                            disabled={
                              !!busy ||
                              (!guided &&
                                (s.kind === "defect_reported"
                                  ? current.state !== "released"
                                  : current.state !== "held"))
                            }
                            onClick={() => scenario(s.kind)}
                          >
                            <Icon name={s.icon} size={18} />
                            <span>
                              <strong>{s.name}</strong>
                              <small>{s.detail}</small>
                            </span>
                            <Icon name="northeast" size={14} />
                          </button>
                        ))}
                      </div>
                    </section>
                  </>
                ) : tab === "evidence" ? (
                  <PaymentEvidence order={current} guided={guided} />
                ) : (
                  <ShopActions
                    order={current}
                    guided={guided}
                    busy={!!busy}
                    onAction={action}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <div className="workspace-endnote">
        <span>Datos ficticios. Interacciones humanas simuladas.</span>
        <Link href="/tienda">
          Abrir el panel de la tienda <Icon name="arrow" size={15} />
        </Link>
      </div>
    </main>
  );
}
