import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Brand } from "@/components/Navigation";
export const metadata = { title: "Sistema visual" };
export default function Design() {
  return (
    <main id="content" className="system-page">
      <span className="eyebrow">
        ENTREGA SEGURA / DESIGN FOUNDATIONS / V.02
      </span>
      <h1>
        Menos ruido.
        <br />
        Más intención.
      </h1>
      <p className="system-lead">
        Un sistema en blanco y negro, construido alrededor de conversaciones
        humanas y decisiones claras. La fotografía cuenta el cuidado; la
        interfaz explica qué está pasando.
      </p>
      <section className="system-section">
        <span className="eyebrow">01 / COLOR</span>
        <h2>El contraste es el acento.</h2>
        <div className="token-swatches">
          {[
            { name: "Ink", hex: "#111111" },
            { name: "White", hex: "#FFFFFF" },
            { name: "Surface", hex: "#F6F6F6" },
            { name: "Line", hex: "#E7E7E7" },
            { name: "Muted", hex: "#737373" },
          ].map((c) => (
            <div key={c.name}>
              <span style={{ background: c.hex }} />
              <strong>{c.name}</strong>
              <code>{c.hex}</code>
            </div>
          ))}
        </div>
      </section>
      <section className="system-section">
        <span className="eyebrow">02 / TIPOGRAFÍA</span>
        <div className="type-samples">
          <h3>
            El regalo llega.
            <br />
            La tranquilidad también.
          </h3>
          <p>
            DM Sans. Una sola familia, dos ritmos: expresiva para contar y
            precisa para operar.
          </p>
          <code>
            Display / 82–44 px · Body / 14–16 px · UI / 11–13 px · Labels / 8–10
            px
          </code>
        </div>
      </section>
      <section className="system-section">
        <span className="eyebrow">03 / COMPONENTES</span>
        <h2>El mismo lenguaje, en cada paso.</h2>
        <div className="component-samples">
          <Brand />
          <Link href="/judge" className="button button-black">
            Acción principal <Icon name="arrow" size={17} />
          </Link>
          <Link href="/tienda" className="button button-outline">
            Acción secundaria
          </Link>
        </div>
        <div className="component-samples">
          <span className="status-badge state-held">
            <span className="tiny-dot" />
            Saldo autorizado
          </span>
          <span className="status-badge state-released">
            <Icon name="check" size={12} />
            Entregado y cobrado
          </span>
          <span className="status-badge state-review">
            <Icon name="eye" size={12} />
            Requiere revisión
          </span>
          <span className="status-badge state-voided">Saldo anulado</span>
        </div>
        <p>
          El estado se comunica con texto, iconos y forma; nunca depende solo
          del color. Los controles tienen foco visible, nombres accesibles y una
          alternativa con movimiento reducido.
        </p>
      </section>
      <section className="system-section">
        <span className="eyebrow">04 / FOTOGRAFÍA</span>
        <h2>El cuidado tiene textura.</h2>
        <p>
          Manos, papel, cerámica y tela. Luz natural, encuadres cercanos y
          blanco y negro. Imágenes originales creadas con IA para esta
          demostración, sin clientes ni pedidos reales.
        </p>
        <div className="system-photo-grid">
          <img
            src="/images/delivery-editorial.webp"
            alt="Entrega de un regalo personalizado, imagen creada con IA"
          />
          <img
            src="/images/made-with-care.webp"
            alt="Preparación artesanal, imagen creada con IA"
          />
        </div>
      </section>
      <section className="system-section">
        <span className="eyebrow">05 / REFERENCIAS</span>
        <h2>Principios compartidos. Una identidad propia.</h2>
        <p>
          Las referencias públicas de Nubank orientan la jerarquía, la
          fotografía humana y la consistencia. ElevenLabs inspira la sobriedad
          de los controles y las superficies. No se han copiado sus logotipos,
          fuentes propietarias ni componentes internos.
        </p>
        <div className="system-reference-links">
          <a
            href="https://building.nu.com/nu-brand-system/"
            target="_blank"
            rel="noreferrer"
          >
            Nu Brand System ↗
          </a>
          <a href="https://elevenlabs.io/" target="_blank" rel="noreferrer">
            ElevenLabs ↗
          </a>
        </div>
      </section>
    </main>
  );
}
