"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";
export function Brand() {
  return (
    <span className="brand">
      <svg
        width="30"
        height="32"
        viewBox="0 0 30 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 6h13v13H3V6Zm11 7h13v13H14V13Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="m10 15 5 5 10-11" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>
        entrega<span>segura</span>
      </span>
    </span>
  );
}
export function Navigation() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <a className="skip-link" href="#content">
        Saltar al contenido
      </a>
      <header className="site-nav">
        <Link
          href="/"
          className="brand-link"
          aria-label="Entrega Segura, inicio"
          onClick={() => setOpen(false)}
        >
          <Brand />
        </Link>
        <nav
          className={open ? "nav-links is-open" : "nav-links"}
          aria-label="Navegación principal"
        >
          <Link href="/#como-funciona" onClick={() => setOpen(false)}>
            Cómo funciona
          </Link>
          <Link
            href="/judge"
            className={path === "/judge" ? "is-active" : ""}
            onClick={() => setOpen(false)}
          >
            Explorar la demo
          </Link>
          <Link
            href="/tienda"
            className={path === "/tienda" ? "is-active" : ""}
            onClick={() => setOpen(false)}
          >
            Para la tienda
          </Link>
        </nav>
        <div className="nav-end">
          <a
            href="https://github.com/sheromdevvs/entrega-segura/tree/feat/delivery-checkout"
            className="nav-source"
            target="_blank"
            rel="noreferrer"
          >
            Código abierto <Icon name="northeast" size={14} />
          </a>
          <Link
            href="/judge?mode=sandbox"
            className="button button-black nav-cta"
          >
            Abrir Sandbox <Icon name="northeast" size={15} />
          </Link>
          <button
            className="icon-button nav-toggle"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </header>
    </>
  );
}
