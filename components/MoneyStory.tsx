"use client";
import { useState } from "react";
import { Icon } from "./Icon";
const scenarios = [
  {
    id: "delivered",
    label: "Lo recibe",
    title: "Recibe su regalo. Se cobra el saldo.",
    detail:
      "La entrega y el código coinciden. La tienda puede completar el cobro.",
    balance: "$12.00",
    state: "Al recibir",
    icon: "check" as const,
  },
  {
    id: "refused",
    label: "Lo rechaza",
    title: "No lo recibe. Se anula el saldo.",
    detail:
      "El anticipo cubre la producción personalizada. El saldo autorizado se libera.",
    balance: "$0.00",
    state: "Saldo anulado",
    icon: "undo" as const,
  },
  {
    id: "not_home",
    label: "No está en casa",
    title: "Una nueva oportunidad para entregarlo.",
    detail:
      "Se espera y se coordina otro intento. Después de dos ausencias, revisa la tienda.",
    balance: "$12.00",
    state: "En espera",
    icon: "clock" as const,
  },
];
export function MoneyStory() {
  const [active, setActive] = useState(0);
  const s = scenarios[active];
  return (
    <div className="money-story">
      <div
        className="story-tabs"
        role="tablist"
        aria-label="Resultado de la entrega"
      >
        {scenarios.map((item, i) => (
          <button
            key={item.id}
            id={`story-${item.id}`}
            role="tab"
            aria-controls="story-panel"
            aria-selected={active === i}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = (active + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                setActive(next);
                document.getElementById(`story-${scenarios[next].id}`)?.focus();
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div id="story-panel" role="tabpanel" aria-labelledby={`story-${s.id}`}>
        <div className="story-ledger">
          <div>
            <small>Para crearlo</small>
            <strong>
              $12<span>.00</span>
            </strong>
            <span>
              <Icon name="check" size={14} /> Anticipo
            </span>
          </div>
          <div className="story-connection">
            <span />
            <Icon name="arrow" size={23} />
            <span />
          </div>
          <div>
            <small>{s.state}</small>
            <strong>
              {s.balance.split(".")[0]}
              <span>.{s.balance.split(".")[1]}</span>
            </strong>
            <span>
              <Icon name={s.icon} size={14} /> Saldo
            </span>
          </div>
        </div>
        <h3>{s.title}</h3>
        <p>{s.detail}</p>
      </div>
      <div className="story-foot">
        <span className="tiny-dot" /> Ejemplo ilustrativo · Hoodie de $24 ·
        Envío no incluido
      </div>
    </div>
  );
}
