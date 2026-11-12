import Link from "next/link";
export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> PAYPAL AI HACKATHON / ECUADOR
          </div>
          <h1>
            Made with care.
            <br />
            Paid with <em>trust.</em>
          </h1>
          <p className="hero-intro">
            El anticipo pone su pedido en marcha.
            <br />
            El saldo se cobra cuando llega a sus manos.
          </p>
          <p className="hero-detail">
            Delivery-aware checkout for shops that sell over WhatsApp. PayPal
            handles the money. AI understands the conversation. Clear rules
            connect the two.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/judge">
              Try the judge demo <span>↗</span>
            </Link>
            <a
              className="text-link"
              href="https://github.com/sheromdevvs/entrega-segura"
            >
              Explore the code →
            </a>
          </div>
          {process.env.PASCAL_DEMO_URL && (
            <a
              className="text-link"
              style={{ display: "block", marginTop: 16 }}
              href={process.env.PASCAL_DEMO_URL}
            >
              Try the Pascal Studio integration ↗
            </a>
          )}
          <div className="hero-note">
            <span>◈ Real PayPal Sandbox</span>
            <span>◌ Simulated delivery & chats</span>
          </div>
        </div>
        <div
          className="flow-art"
          role="img"
          aria-label="A 24 dollar custom order: 12 dollars captured for production, 12 dollars authorized until delivery"
        >
          <div className="art-top">
            <span>PASCAL STUDIO</span>
            <span className="pill">Fictional order</span>
          </div>
          <div className="gift-illustration">
            <div className="gift-shadow" />
            <div className="gift-box">
              <span className="gift-ribbon" />
              <span className="gift-label">
                hecho
                <br />
                <i>para usted.</i>
                <small>♡ PASCAL STUDIO</small>
              </span>
            </div>
            <span className="floating-check">✓</span>
          </div>
          <div className="art-product">
            <div>
              <small>UN REGALO QUE TIENE HISTORIA</small>
              <h3>Hoodie personalizado</h3>
            </div>
            <strong>
              $24<span>.00</span>
            </strong>
          </div>
          <div className="money-flow">
            <div>
              <span className="step-dot">1</span>
              <strong>$12</strong>
              <small>Para crearlo</small>
              <span className="mini-tag">Captured now</span>
            </div>
            <div className="flow-line">→</div>
            <div>
              <span className="step-dot outline">2</span>
              <strong>$12</strong>
              <small>Cuando lo reciba</small>
              <span className="mini-tag light">Authorized until delivery</span>
            </div>
          </div>
          <div className="art-bottom">
            <span>✓ Código de entrega verificado</span>
            <span>Saldo → tienda</span>
          </div>
        </div>
      </section>
      <section className="principles">
        <div className="section-label">THE JOURNEY, WITHOUT THE GUESSWORK</div>
        <div className="principle-grid">
          <article>
            <span>01 / APPROVE</span>
            <h2>
              Una aprobación.
              <br />
              Dos momentos de cobro.
            </h2>
            <p>
              El comprador autoriza el total. El 50 % financia la producción
              personalizada; el saldo queda pendiente.
            </p>
          </article>
          <article>
            <span>02 / UNDERSTAND</span>
            <h2>
              Mensajes humanos.
              <br />
              Eventos claros.
            </h2>
            <p>
              “No había nadie en casa” se convierte en un intento fallido. La IA
              interpreta y propone un mensaje para usted.
            </p>
          </article>
          <article>
            <span>03 / RESOLVE</span>
            <h2>
              Entregas verificadas.
              <br />
              Reglas visibles.
            </h2>
            <p>
              Código correcto: cobrar saldo. Rechazo: anular saldo. Un reclamo o
              una entrega incompleta: revisión de la tienda.
            </p>
          </article>
        </div>
      </section>
      <section className="honest-note">
        <div>
          <div className="eyebrow">WHAT THIS PROTOTYPE PROVES</div>
          <h2>
            Real payment rails.
            <br />
            An honest demo.
          </h2>
        </div>
        <p>
          PayPal calls use the real sandbox. Courier updates and WhatsApp
          conversations are simulated. Authorization limits, failures and
          verified webhook status are shown. A hold is time-limited; it is not a
          guarantee against every payment failure.
        </p>
        <Link href="/judge" className="text-link">
          Follow the money →
        </Link>
      </section>
    </main>
  );
}
