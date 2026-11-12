import type { Metadata } from "next";
import Link from "next/link";
import { Navigation, Brand } from "@/components/Navigation";
import { Icon } from "@/components/Icon";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3025"),
  title: {
    default: "Entrega Segura — El regalo llega. La tranquilidad también.",
    template: "%s · Entrega Segura",
  },
  description:
    "Un anticipo para crear. El saldo al recibir. Checkout con PayPal Sandbox e IA para tiendas que venden por WhatsApp.",
  openGraph: {
    title: "Entrega Segura",
    description: "Un anticipo para crear. El saldo al recibir.",
    images: [
      { url: "/images/delivery-editorial.webp", width: 1536, height: 1024 },
    ],
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-EC">
      <body>
        <Navigation />
        {children}
        <footer className="site-footer">
          <div className="footer-top">
            <Link href="/" aria-label="Entrega Segura, inicio">
              <Brand />
            </Link>
            <p>
              Para quienes crean algo especial.
              <br />Y quienes esperan recibirlo.
            </p>
            <div className="footer-links">
              <Link href="/judge">
                La demo <Icon name="northeast" size={14} />
              </Link>
              <Link href="/tienda">
                La tienda <Icon name="northeast" size={14} />
              </Link>
              <Link href="/design-system">
                Nuestro sistema visual <Icon name="northeast" size={14} />
              </Link>
              <a
                href="https://github.com/sheromdevvs/entrega-segura/tree/feat/delivery-checkout"
                target="_blank"
                rel="noreferrer"
              >
                GitHub <Icon name="northeast" size={14} />
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>Diseñado desde Ecuador. PayPal AI Hackathon 2026.</span>
            <span>
              Prototipo Sandbox · Sin dinero real · Imágenes creadas con IA
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
