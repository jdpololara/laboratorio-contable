"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/ingreso/actions";
import { NAV } from "@/lib/lab/nav";

type NavItem = { href: string; id: string; label: string };
type NavGroup = { group: string; items: readonly NavItem[] };

function isCurrent(pathname: string, href: string) {
  return pathname === href;
}

export function LabFrame({
  title,
  subtitle,
  badge,
  navigation = true,
  nav = NAV,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  navigation?: boolean;
  nav?: readonly NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const groups = navigation ? nav : [];
  const home = groups[0]?.items[0]?.href ?? "/";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const bar = menuRef.current?.closest(".topbar");
    if (!(bar instanceof HTMLElement)) return;
    const apply = () => {
      document.documentElement.style.setProperty("--topbar-h", `${bar.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [groups.length]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (asideRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={navigation ? "layout" : "layout bare"}>
      {navigation ? (
      <aside className={`side${open ? " open" : ""}`} ref={asideRef}>
        <div className="side-top">
          <Link className="brand" href={home} onClick={() => setOpen(false)}>
            <div className="brand-mark">Σ</div>
            <div>
              <b>Laboratorio Contable</b>
              <span>Contaduría Pública · práctica</span>
            </div>
          </Link>
          {open ? (
            <button
              className="side-close"
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          ) : null}
        </div>
        {groups.map((group) => (
          <div className="navg" key={group.group}>
            <h4>{group.group}</h4>
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </aside>
      ) : null}
      {navigation && open ? (
        <button
          className="side-backdrop"
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div>
        <div className="topbar">
          {groups.length > 0 ? (
            <button
              ref={menuRef}
              className="btn quiet sm menu-btn"
              type="button"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Cerrar" : "☰ Menú"}
            </button>
          ) : null}
          <div className="co">
            <b>{title}</b>
            <span>{subtitle}</span>
          </div>
          {badge ? <span className="chip acc">{badge}</span> : null}
          <span className="chip ok">
            <span className="dot" />
            En línea
          </span>
          <form action={signOut}>
            <button className="btn quiet sm" type="submit">
              Salir
            </button>
          </form>
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
