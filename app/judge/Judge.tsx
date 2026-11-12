"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Reservation } from "@/lib/types";
import type { ParsedMessage } from "@/lib/ai";
const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
const labels: Record<string, string> = {
  awaiting_approval: "Esperando aprobación",
  authorized: "Autorizado",
  deposit_pending: "Anticipo pendiente",
  held: "Saldo autorizado",
  released: "Saldo cobrado",
  voided: "Saldo anulado",
  refunded: "Reembolso registrado",
  review: "Revisión necesaria",
};
export default function Judge() {
  const search = useSearchParams();
  const [order, setOrder] = useState<Reservation | null>(null),
    [orders, setOrders] = useState<Reservation[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [product, setProduct] = useState("hoodie"),
    [text, setText] = useState("Ya entregué el pedido. El código es "),
    [ai, setAi] = useState<ParsedMessage | null>(null),
    [photo, setPhoto] = useState<string>(),
    [photoName, setPhotoName] = useState(""),
    [refundAmount, setRefundAmount] = useState("3.00");
  const load = useCallback(async () => {
    const r = await fetch("/api/orders");
    const d = await r.json();
    if (d.orders) setOrders(d.orders);
    return d.orders as Reservation[] | undefined;
  }, []);
  useEffect(() => {
    load()
      .then((items) => {
        const ref = search.get("ref");
        const found =
          items?.find((x) => x.ref === ref) || (!ref ? items?.[0] : undefined);
        if (found) {
          setOrder(found);
          setAi(
            found.events.findLast((e) => e.interpretation)?.interpretation ||
              null,
          );
        }
      })
      .catch(() => setError("No se pudieron cargar los pedidos."));
  }, [load, search]);
  useEffect(() => {
    if (!order?.ref) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/orders/${order.ref}`);
        if (r.ok) setOrder(await r.json());
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [order?.ref]);
  async function action(body: Record<string, unknown>) {
    if (!order) return;
    setBusy(String(body.action));
    setError("");
    try {
      const r = await fetch(`/api/orders/${order.ref}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.order) setOrder(d.order);
      if (!r.ok) throw new Error(d.error);
      if (d.ai) setAi(d.ai);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy("");
    }
  }
  async function create() {
    setBusy("create");
    setError("");
    setAi(null);
    setPhoto(undefined);
    setPhotoName("");
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setOrder(d);
      await load();
      window.history.replaceState(null, "", `/judge?ref=${d.ref}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      await load();
    } finally {
      setBusy("");
    }
  }
  async function attach(file: File | undefined) {
    if (!file) {
      setPhoto(undefined);
      setPhotoName("");
      return;
    }
    if (
      file.size > 5 * 1024 * 1024 ||
      !/^image\/(png|jpeg|webp)$/.test(file.type)
    ) {
      setError("Use una imagen PNG, JPG o WebP de hasta 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  }
  async function audio(file: File | undefined) {
    if (!file) return;
    setBusy("audio");
    setError("");
    try {
      const form = new FormData();
      form.set("audio", file);
      const r = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setText(d.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audio failed");
    } finally {
      setBusy("");
    }
  }
  const deposit =
    order?.captures
      .filter((x) => x.role === "deposit" && x.status === "COMPLETED")
      .reduce((a, c) => a + c.amount, 0) || 0;
  const balance =
    order?.captures
      .filter((x) => x.role === "balance" && x.status === "COMPLETED")
      .reduce((a, c) => a + c.amount, 0) || 0;
  const held =
    order && ["held", "authorized", "deposit_pending"].includes(order.state)
      ? order.total - deposit
      : 0;
  const decision = order?.decisions.at(-1);
  const canEvent = order?.state === "held";
  const canDefect = order?.state === "released" || order?.state === "held";
  return (
    <main className="workspace">
      <div className="workspace-head">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> INTERACTIVE SANDBOX / JUDGE DEMO
          </div>
          <h1>
            Follow the <em>money.</em>
          </h1>
          <p>A custom order, from one approval to a verified delivery.</p>
        </div>
        <div className="sandbox-badge">
          <span>◈</span>
          <div>
            PayPal Sandbox<small>Fictional orders · No real money</small>
          </div>
        </div>
      </div>
      <div className="demo-toolbar">
        <div className="toolbar-product">
          <span className="product-thumb">♧</span>
          <label>
            Pedido de demostración
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              <option value="hoodie">Hoodie personalizado · $24</option>
              <option value="mug">Taza personalizada · $12</option>
              <option value="frame">Cuadro de mascota · $13</option>
            </select>
          </label>
        </div>
        <div className="toolbar-controls">
          {orders.length > 0 && (
            <select
              aria-label="Cambiar pedido"
              value={order?.ref || ""}
              onChange={(e) => {
                setOrder(orders.find((x) => x.ref === e.target.value) || null);
                setAi(null);
              }}
            >
              {!order && <option value="">Seleccione un pedido</option>}
              {orders.map((r) => (
                <option key={r.ref} value={r.ref}>
                  {r.ref} · {labels[r.state]}
                </option>
              ))}
            </select>
          )}
          <button className="button primary" disabled={!!busy} onClick={create}>
            {busy === "create"
              ? "Creating sandbox checkout…"
              : "+ Start a new journey"}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="error">
          <strong>Action needs attention</strong>
          <span>{error}</span>
        </div>
      )}
      {!order ? (
        <section className="empty-state">
          <div className="empty-orbit">↗</div>
          <h2>One order. Every step visible.</h2>
          <p>
            Start a journey to create a real PayPal Sandbox order. Approve with
            a sandbox buyer, then choose a delivery outcome.
          </p>
          <button className="button primary" onClick={create} disabled={!!busy}>
            Create the first sandbox order →
          </button>
          <small>
            Needs sandbox buyer approval. No auto-approval is simulated.
          </small>
        </section>
      ) : (
        <>
          {order.source === "pascal" && (
            <a
              className="text-link"
              style={{ display: "inline-block", marginBottom: 18 }}
              href="/api/integrations/pascal/return"
            >
              ← View this order in Pascal Studio
            </a>
          )}
          <section className="money-strip">
            <div className="order-identity">
              <small>
                {order.source === "pascal"
                  ? "PASCAL INTEGRATION"
                  : "FICTIONAL PASCAL ORDER"}
              </small>
              <strong>{order.product}</strong>
              <code>{order.ref}</code>
              <span className={`state-tag ${order.state}`}>
                {labels[order.state]}
              </span>
            </div>
            <div>
              <small>Order total</small>
              <strong>{usd(order.total)}</strong>
              <span>USD · sin envío</span>
            </div>
            <div>
              <small>Production deposit</small>
              <strong>{usd(deposit)}</strong>
              <span>{deposit ? "Captured" : "Pending approval"}</span>
            </div>
            <div>
              <small>Balance authorized</small>
              <strong>{usd(held)}</strong>
              <span>Time-limited hold</span>
            </div>
            <div>
              <small>Balance collected</small>
              <strong className={balance ? "green" : ""}>{usd(balance)}</strong>
              <span>
                {order.state === "voided"
                  ? "Remaining hold voided"
                  : "On verified delivery"}
              </span>
            </div>
          </section>
          <div className="journey-layout">
            <aside className="journey-sidebar">
              <div className="section-label">THE PAYMENT JOURNEY</div>
              {[
                {
                  title: "Buyer approval",
                  desc: order.paypalOrderId || "Create order",
                  done: !!order.authorizationId,
                },
                {
                  title: "Fund production",
                  desc:
                    order.captures.find((c) => c.role === "deposit")?.id ||
                    "Capture 50% · final_capture: false",
                  done: !!deposit,
                },
                {
                  title: "Delivery evidence",
                  desc: order.events.length
                    ? `${order.events.length} event(s) received`
                    : "Chat + code or courier event",
                  done: !!order.events.length,
                },
                {
                  title: "Resolve the balance",
                  desc:
                    order.captures.find((c) => c.role === "balance")?.id ||
                    (order.state === "voided"
                      ? "Authorization voided"
                      : "Deterministic gate decides"),
                  done: !!balance || order.state === "voided",
                },
                {
                  title: "Verified webhook",
                  desc:
                    order.lastWebhook?.type ||
                    "Waiting for PayPal notification",
                  done: !!order.lastWebhook,
                },
              ].map((s, i) => (
                <div
                  className={`journey-step ${s.done ? "done" : ""}`}
                  key={s.title}
                >
                  <span>{s.done ? "✓" : `0${i + 1}`}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>{s.desc}</small>
                  </div>
                </div>
              ))}
              <div className="sidebar-note">
                <strong>No screenshots to check.</strong>
                <p>
                  PayPal IDs and the payment ledger are shown below. A webhook
                  counts only after signature verification succeeds.
                </p>
              </div>
            </aside>
            <div className="journey-content">
              {order.state === "awaiting_approval" ||
              order.state === "authorized" ? (
                <section className="approval-panel">
                  <span className="eyebrow">01 / BUYER APPROVAL</span>
                  <h2>Primero, su aprobación.</h2>
                  <p>
                    Autorice {usd(order.total)} en PayPal Sandbox. Se cobrará un
                    anticipo de {usd(order.deposit)} para fabricar su producto.
                    El saldo se cobrará al confirmar la entrega.
                  </p>
                  <div className="policy-note">
                    Si rechaza la entrega de un producto personalizado, se anula
                    el saldo. El anticipo se conserva para cubrir la producción.
                    Un defecto requiere revisión de la tienda; sus derechos y
                    las disputas de PayPal siguen aplicando.
                  </div>
                  <div className="hero-actions">
                    {order.approvalUrl ? (
                      <a
                        className="button paypal"
                        href={order.approvalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Approve in PayPal Sandbox ↗
                      </a>
                    ) : (
                      <button
                        className="button primary"
                        onClick={() => action({ action: "retry_checkout" })}
                        disabled={!!busy}
                      >
                        Retry checkout creation
                      </button>
                    )}
                    <button
                      className="button secondary"
                      onClick={() => action({ action: "approve" })}
                      disabled={!!busy}
                    >
                      {busy === "approve"
                        ? "Checking approval…"
                        : "I approved → Check & capture deposit"}
                    </button>
                  </div>
                  <small className="muted">
                    Use a PayPal sandbox personal account. Your normal PayPal
                    login will not work here.
                  </small>
                </section>
              ) : null}
              <div className="chat-grid">
                <section className="phone">
                  <div className="phone-header">
                    <span className="avatar">D</span>
                    <div>
                      Daniela R.<small>Buyer · Chat simulator</small>
                    </div>
                    <span className="phone-menu">···</span>
                  </div>
                  <div className="phone-body">
                    <span className="chat-date">PEDIDO FICTICIO · QUITO</span>
                    <div className="bubble">
                      Buenas tardes, quisiera mi regalo personalizado.
                      <small>10:02</small>
                    </div>
                    <div className="bubble outgoing">
                      Con gusto. Su total es {usd(order.total)}. El anticipo es{" "}
                      {usd(order.deposit)} y el saldo se cobra cuando reciba el
                      pedido.<small>10:03 ✓✓</small>
                    </div>
                    <div className="bubble">
                      ¿Y si no me lo entregan?<small>10:03</small>
                    </div>
                    <div className="bubble outgoing">
                      Sin entrega confirmada, no se cobra el saldo. Si hay un
                      problema, revisamos su caso.<small>10:04 ✓✓</small>
                    </div>
                    {deposit > 0 && (
                      <div className="chat-receipt">
                        <span>✓</span>
                        <strong>Anticipo registrado</strong>
                        <small>{usd(deposit)} · PayPal Sandbox</small>
                      </div>
                    )}
                    <div className="code-card">
                      <small>SU CÓDIGO DE ENTREGA</small>
                      <strong>
                        {order.code.split("").map((n, i) => (
                          <span key={i}>{n}</span>
                        ))}
                      </strong>
                      <p>Compártalo al recibir el pedido completo.</p>
                    </div>
                  </div>
                  <div className="phone-foot">
                    ◌ Simulated WhatsApp · no messages sent
                  </div>
                </section>
                <section className="phone courier">
                  <div className="phone-header">
                    <span className="avatar courier-avatar">↗</span>
                    <div>
                      Entrega en camino
                      <small>Courier / buyer · Chat simulator</small>
                    </div>
                    <span className="phone-menu">···</span>
                  </div>
                  <div className="phone-body">
                    <span className="chat-date">
                      MESSAGES → AI → DELIVERY EVENT
                    </span>
                    <div className="bubble">
                      Entiendo lo que pasó en la entrega. Cuénteme con sus
                      palabras o adjunte una nota de voz.
                    </div>
                    {order.events.slice(-3).map((e) => (
                      <div className="bubble outgoing" key={e.id}>
                        {e.text}
                        <small>
                          {e.source === "simulated_laar"
                            ? "SIMULATED LAAR"
                            : e.kind}
                        </small>
                      </div>
                    ))}
                    {ai && (
                      <div className="ai-card">
                        <span>✳ AI INTERPRETATION</span>
                        <strong>{ai.kind}</strong>
                        <p>{ai.explanation}</p>
                        <small>Draft reply: “{ai.reply}”</small>
                        <small>
                          {ai.provider} · {ai.model}
                        </small>
                      </div>
                    )}
                  </div>
                  <div className="chat-compose">
                    <label className="sr-only" htmlFor="message">
                      Mensaje de comprador o repartidor
                    </label>
                    <textarea
                      id="message"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Ej.: No había nadie, dejé aviso."
                    />
                    <div className="compose-bottom">
                      <div className="attachments">
                        <label title="Adjuntar foto">
                          ▧
                          <input
                            aria-label="Adjuntar foto del defecto"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => attach(e.target.files?.[0])}
                          />
                        </label>
                        <label title="Transcribir nota de voz">
                          ♫
                          <input
                            aria-label="Transcribir nota de voz"
                            type="file"
                            accept="audio/*"
                            onChange={(e) => audio(e.target.files?.[0])}
                          />
                        </label>
                        {photoName && <small>{photoName}</small>}
                      </div>
                      <button
                        className="send"
                        aria-label="Interpretar mensaje y aplicar reglas"
                        disabled={!!busy || !text.trim()}
                        onClick={() =>
                          action({ action: "message", text, photo })
                        }
                      >
                        {busy === "message" ? "…" : "↑"}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
              <section className="gate-panel">
                <div className="gate-title">
                  <span className="gate-symbol">⌘</span>
                  <div>
                    <span className="eyebrow">DETERMINISTIC DELIVERY GATE</span>
                    <h3>
                      {decision
                        ? decision.action.replace("_", " ")
                        : "Waiting for delivery evidence"}
                    </h3>
                  </div>
                  <span className="pill">Rules, never the model</span>
                </div>
                <p>
                  {decision?.reason ||
                    "La IA interpreta el mensaje. El código, el estado del pago y la política determinan si se cobra, se espera o se pide revisión."}
                </p>
                {order.lastError && (
                  <>
                    <p className="error-inline">{order.lastError}</p>
                    <button
                      className="button secondary"
                      disabled={!!busy}
                      onClick={() => action({ action: "retry_event" })}
                    >
                      Retry pending action safely
                    </button>
                  </>
                )}
              </section>
              <section className="scenarios">
                <div>
                  <span className="section-label">EXPLORE ANOTHER OUTCOME</span>
                  <p>
                    These buttons inject labelled simulated courier events.
                    Start a new order for each final outcome.
                  </p>
                </div>
                <div className="scenario-buttons">
                  <button
                    disabled={!!busy || !canEvent}
                    onClick={() =>
                      action({ action: "scenario", scenario: "delivered" })
                    }
                  >
                    ✓ Delivered + correct code
                  </button>
                  <button
                    disabled={!!busy || !canEvent}
                    onClick={() =>
                      action({ action: "scenario", scenario: "refused" })
                    }
                  >
                    ↩ Refused at the door
                  </button>
                  <button
                    disabled={!!busy || !canEvent}
                    onClick={() =>
                      action({ action: "scenario", scenario: "not_home" })
                    }
                  >
                    ◷ Not home · attempt{" "}
                    {Math.min(
                      (order.events.filter((x) => x.kind === "not_home")
                        .length || 0) + 1,
                      2,
                    )}
                    /2
                  </button>
                  <button
                    disabled={!!busy || !canEvent}
                    onClick={() =>
                      action({
                        action: "scenario",
                        scenario: "partial_delivery",
                      })
                    }
                  >
                    ◐ Partial delivery
                  </button>
                  <button
                    disabled={!!busy || !canDefect}
                    onClick={() => {
                      setText(
                        "El producto llegó roto. Adjunto una foto del daño.",
                      );
                      document.getElementById("message")?.focus();
                    }}
                  >
                    ▧ Report defect · attach photo
                  </button>
                </div>
              </section>
              {order.events.some((x) => x.kind === "defect_reported") && (
                <section className="review-panel">
                  <span className="section-label">
                    SHOP REVIEW · HUMAN APPROVAL
                  </span>
                  <p>
                    Revise el reclamo y la foto adjunta antes de aprobar un
                    reembolso. En esta demo usted representa a la tienda.
                  </p>
                  {order.events
                    .filter((e) => e.photo)
                    .map((e) => (
                      <img
                        key={e.id}
                        src={e.photo}
                        alt="Foto adjunta del reclamo de demostración"
                        style={{
                          display: "block",
                          maxWidth: 240,
                          maxHeight: 220,
                          objectFit: "contain",
                          marginBottom: 15,
                        }}
                      />
                    ))}
                  <label>
                    Reembolso parcial (USD){" "}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                  </label>
                  <button
                    className="button secondary"
                    disabled={!!busy || !!order.refunds.length}
                    onClick={() =>
                      action({
                        action: "refund",
                        amount: Math.round(Number(refundAmount) * 100),
                      })
                    }
                  >
                    Approve sandbox refund
                  </button>
                </section>
              )}
            </div>
          </div>
          <section className="audit-panel">
            <div className="audit-header">
              <div>
                <span className="section-label">PAYMENT EVIDENCE</span>
                <h2>Every call leaves a trace.</h2>
              </div>
              <div>
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => action({ action: "refresh" })}
                >
                  Refresh payment status ↻
                </button>
                <button
                  className="text-button"
                  disabled={!!busy || order.state !== "held"}
                  onClick={() => action({ action: "reauthorize" })}
                >
                  Check / reauthorize hold
                </button>
              </div>
            </div>
            {order.refunds.map((r) => (
              <p key={r.id}>
                Refund: <code>{r.id}</code> · {usd(r.amount)} · {r.status}
              </p>
            ))}
            <div className="webhook-line">
              <span
                className={order.lastWebhook ? "live-dot" : "waiting-dot"}
              />
              {order.lastWebhook ? (
                <>
                  verification_status: <strong>SUCCESS</strong> ·{" "}
                  {order.lastWebhook.type} · <code>{order.lastWebhook.id}</code>
                </>
              ) : (
                "Verified webhook not received yet. No success is simulated."
              )}
            </div>
            <div className="audit-calls">
              {order.calls.map((c, i) => (
                <details key={i}>
                  <summary>
                    <span
                      className={`http-status ${c.status >= 400 ? "bad" : ""}`}
                    >
                      {c.status}
                    </span>
                    <code>
                      {c.method} {c.path}
                    </code>
                    <small>{c.debugId || "no debug ID"}</small>
                    <span>＋</span>
                  </summary>
                  <pre>{JSON.stringify(c, null, 2)}</pre>
                </details>
              ))}
            </div>
            <p className="muted">
              Original API responses with personal fields redacted. Request IDs
              are deterministic; repeated money actions reuse the same
              operation.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
