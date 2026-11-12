"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/ingreso/actions";
import { NAV } from "@/lib/lab/nav";

export function LabFrame({
  title,
  subtitle,
  badge,
  navigation = true,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  navigation?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="layout">
      <aside className={`side${open ? " open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <div className="brand-mark">Σ</div>
          <div>
            <b>Laboratorio Contable</b>
            <span>Contaduría Pública · práctica</span>
          </div>
        </Link>
        {navigation
          ? NAV.map((group) => (
          <div className="navg" key={group.group}>
            <h4>{group.group}</h4>
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))
          : null}
      </aside>
      <div>
        <div className="topbar">
          <button
            className="btn quiet sm menu-btn"
            type="button"
            aria-label="Abrir menú"
            onClick={() => setOpen((value) => !value)}
          >
            ☰ Menú
          </button>
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
