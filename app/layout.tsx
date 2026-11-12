import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "Entrega Segura — Made with trust. Paid on delivery.",
  description:
    "A PayPal sandbox prototype for custom orders: fund production now, capture the balance on verified delivery.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="nav">
          <Link className="wordmark" href="/">
            <span className="brand-icon">
              e<span>✓</span>
            </span>
            entrega<span className="wordmark-light">segura</span>
            <sup>DEMO</sup>
          </Link>
          <nav aria-label="Navegación principal">
            <Link href="/judge">Judge demo</Link>
            <Link href="/tienda">Shop panel</Link>
            <a
              href="https://github.com/sheromdevvs/entrega-segura"
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
            </a>
          </nav>
        </header>
        {children}
        <footer>
          <span>
            Built around a real shop in Ecuador. All demo orders are fictional.
          </span>
          <span>PayPal Sandbox · No real money</span>
        </footer>
      </body>
    </html>
  );
}
