import Link from "next/link";
import { Icon } from "@/components/Icon";
import { VoiceExample } from "@/components/VoiceExample";
import { MoneyStory } from "@/components/MoneyStory";
export default function Home() {
  return (
    <main id="content" className="landing">
      <section className="editorial-hero">
        <div className="hero-topline">
          <span>
            <span className="tiny-dot" /> CONFIANZA, DE PRINCIPIO A FIN
          </span>
          <span>DISEÑADO DESDE ECUADOR</span>
        </div>
        <div className="hero-heading">
          <h1>
            El regalo llega.
            <br />
            <span>La tranquilidad también.</span>
          </h1>
          <div className="hero-summary">
            <p>
              Un anticipo para crear.
              <br />
              El saldo cuando lo reciba.
            </p>
            <span>
              Una forma más clara de comprar y vender regalos personalizados por
              WhatsApp.
            </span>
            <div className="hero-actions">
              <Link className="button button-black" href="/judge">
                Explorar la demo <Icon name="arrow" size={18} />
              </Link>
              <a className="button button-text" href="#como-funciona">
                Así funciona <Icon name="down" size={16} />
              </a>
            </div>
          </div>
        </div>
        <div className="hero-photograph">
          <img
            src="/images/delivery-editorial.webp"
            width="1536"
            height="1024"
            alt="Manos que entregan una caja con una prenda personalizada; fotografía editorial creada con IA"
            fetchPriority="high"
          />
          <div className="photograph-caption">
            <span>
              Una compra pequeña.
              <br />
              Una gran diferencia.
            </span>
            <span>01 — EL MOMENTO DE RECIBIR</span>
          </div>
          <div className="hero-receipt">
            <div>
              <span className="receipt-mark">
                <Icon name="box" size={17} />
              </span>
              <span>
                Un regalo, hecho para usted.
                <small>PASCAL STUDIO · EJEMPLO</small>
              </span>
              <Icon name="northeast" size={17} />
            </div>
            <div className="receipt-amounts">
              <span>
                Para crearlo<strong>$12.00</strong>
              </span>
              <span>
                Al recibirlo<strong>$12.00</strong>
              </span>
            </div>
            <div className="receipt-bottom">
              <Icon name="shield" size={14} />
              <span>Una aprobación. Dos momentos de cobro.</span>
            </div>
          </div>
        </div>
        <div className="hero-bottomline">
          <span>
            <Icon name="shield" size={15} /> PayPal Sandbox
          </span>
          <span>
            <Icon name="wave" size={17} /> IA para entender las conversaciones
          </span>
          <span>
            <Icon name="code" size={16} /> Reglas claras para el dinero
          </span>
          <span>DEMO · SIN DINERO REAL</span>
        </div>
      </section>
      <section className="how-section" id="como-funciona">
        <div className="section-intro">
          <span className="eyebrow">01 / EL RECORRIDO</span>
          <h2>
            Una aprobación.
            <br />
            Dos momentos.
          </h2>
          <p>
            La tienda necesita empezar a crear.
            <br />
            Usted quiere recibir antes de pagar el saldo.
            <br />
            Ahora, las dos cosas pueden convivir.
          </p>
        </div>
        <MoneyStory />
        <div className="journey-explainer">
          <article>
            <span>01</span>
            <div>
              <h3>Apruebe una vez.</h3>
              <p>
                Autorice el total en PayPal. El 50 % se cobra para fabricar su
                producto personalizado.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Espere algo suyo.</h3>
              <p>
                El saldo queda autorizado mientras se prepara y entrega el
                pedido, dentro del plazo de PayPal.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Reciba. Confirme. Listo.</h3>
              <p>
                Comparta su código al recibir el pedido completo. Esa
                confirmación permite cobrar el saldo.
              </p>
            </div>
          </article>
        </div>
      </section>
      <section className="craft-section">
        <div className="craft-image">
          <img
            src="/images/made-with-care.webp"
            width="1100"
            height="1375"
            loading="lazy"
            alt="Preparación de una taza personalizada en un pequeño taller; fotografía editorial creada con IA"
          />
          <span>02 — EL CUIDADO ANTES DE LA ENTREGA</span>
        </div>
        <div className="craft-copy">
          <span className="eyebrow">PARA TIENDAS QUE HACEN ALGO ESPECIAL</span>
          <h2>
            Hecho a mano.
            <br />
            Sin revisar pagos
            <br />
            <span>a mano.</span>
          </h2>
          <p>
            Un regalo personalizado lleva tiempo, materiales y cuidado. El
            anticipo pone ese trabajo en marcha. El saldo, la entrega y cada
            incidencia quedan en el mismo recorrido.
          </p>
          <div className="merchant-signature">
            <span className="merchant-logo">
              P<span>✳</span>
            </span>
            <div>
              <strong>Inspirado en Pascal Studio</strong>
              <small>Regalos personalizados · Ecuador</small>
            </div>
          </div>
          <p className="small-note">
            Basado en su proceso de venta. La demo usa pedidos ficticios y una
            integración independiente de las operaciones comerciales.
          </p>
          <div className="hero-actions">
            <Link href="/tienda" className="button button-black">
              Conocer el panel <Icon name="arrow" size={18} />
            </Link>
            {process.env.PASCAL_DEMO_URL && (
              <a
                href={process.env.PASCAL_DEMO_URL}
                className="button button-text"
              >
                Demo en Pascal <Icon name="northeast" size={16} />
              </a>
            )}
          </div>
        </div>
      </section>
      <section className="intelligence-section">
        <div className="intelligence-heading">
          <span className="eyebrow">02 / CONVERSACIONES CON CONTEXTO</span>
          <h2>
            La IA entiende.
            <br />
            Las reglas deciden.
          </h2>
          <p>
            Una nota de voz, un mensaje o una foto pueden contar lo que pasó. El
            modelo lo interpreta; el código determina el siguiente paso.
          </p>
          <Link href="/judge" className="button button-outline">
            Probar una conversación <Icon name="arrow" size={18} />
          </Link>
        </div>
        <div className="intelligence-example">
          <VoiceExample />
          <blockquote>
            “No había nadie en casa.
            <br />
            Dejé un aviso y vuelvo mañana.”
          </blockquote>
          <div className="inference-row">
            <span>
              <Icon name="sparkle" size={16} /> Interpretación
            </span>
            <code>not_home</code>
          </div>
          <div className="inference-rule">
            <Icon name="clock" size={21} />
            <div>
              <strong>Esperar. Volver a intentarlo.</strong>
              <p>
                El saldo sigue pendiente. No se cobra una entrega que aún no
                ocurrió.
              </p>
            </div>
          </div>
          <div className="example-provenance">
            Ejemplo ilustrativo del evento y su regla · La demo permite usar el
            modelo real.
          </div>
        </div>
      </section>
      <section className="honesty-section">
        <div>
          <span className="eyebrow">SIN LETRA PEQUEÑA</span>
          <h2>Sepa qué está probando.</h2>
        </div>
        <div className="honesty-rows">
          <div>
            <span>Pagos</span>
            <p>
              Integración con PayPal Sandbox. Ningún movimiento usa dinero real.
            </p>
          </div>
          <div>
            <span>Conversaciones y entregas</span>
            <p>
              WhatsApp y courier simulados. Puede probar mensajes, voz e
              imágenes con IA.
            </p>
          </div>
          <div>
            <span>Autorizaciones</span>
            <p>
              Tienen un plazo limitado y el cobro puede fallar. Se vigila el
              estado; no es una cuenta de escrow.
            </p>
          </div>
          <div>
            <span>Incidencias</span>
            <p>
              Un rechazo anula el saldo; un defecto o una entrega incompleta
              requiere revisión de la tienda.
            </p>
          </div>
        </div>
      </section>
      <section className="closing-section">
        <span className="eyebrow">EL SIGUIENTE PASO ES SENCILLO</span>
        <h2>
          Algo personal.
          <br />
          Una forma más clara de pagarlo.
        </h2>
        <Link href="/judge" className="button button-white">
          Recorrer la demo <Icon name="northeast" size={20} />
        </Link>
        <p>
          Vista guiada sin aprobación de PayPal.
          <br />
          Sandbox disponible cuando quiera explorar la integración.
        </p>
      </section>
    </main>
  );
}
