"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { useUser, rolNombre, puedeRevisar } from "@/context/AuthContext";

const MODULOS_BASE: {
  href: string; label: string; descripcion: string;
  roles: number[];
  badge?: string; disabled?: boolean;
  icon: React.ReactNode;
}[] = [
  {
    href: "/ordenes",
    label: "Órdenes de Trabajo",
    descripcion: "Registro, reportes y gestión de OTs",
    roles: [1, 2, 3, 4, 6],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: "#",
    label: "Formularios",
    descripcion: "Sistema de formularios (módulo externo)",
    badge: "Sistema externo",
    disabled: true,
    roles: [1, 2, 3, 4],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    ),
  },
];

const ROL_COLOR: Record<number, string> = {
  1: "#7c3aed",
  2: "#0891b2",
  3: "#2563eb",
  4: "#16a34a",
  6: "#d97706",
};

export default function InicioPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>Cargando…</p>
      </div>
    );
  }

  if (!user) return null;

  const modulos = MODULOS_BASE.filter((m) => m.roles.includes(user.rol));
  const esAdmin = user.rol === 1;
  void esAdmin;
  const rolColor = ROL_COLOR[user.rol] ?? "#64748b";

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <AppHeader />

      <main style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 65px)",
        padding: 24,
        gap: 20,
      }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f2847" }}>
            Bienvenido, {(() => { const p = user.nombre.split(" "); return p.length >= 4 ? p[p.length - 2] : p[p.length - 1]; })()}
          </h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 }}>
            <span style={{
              display: "inline-block",
              background: rolColor + "18",
              color: rolColor,
              border: `1px solid ${rolColor}40`,
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}>
              {rolNombre(user.rol).toUpperCase()}
            </span>
            {puedeRevisar(user.rol) && (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>· Acceso de revisión habilitado</span>
            )}
          </div>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>Seleccione un módulo para continuar</p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          width: "100%",
          maxWidth: 680,
        }}>
          {modulos.map((m) => (
            <Link
              key={m.href + m.label}
              href={m.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                background: "white",
                border: "2px solid",
                borderColor: m.disabled ? "#e2e8f0" : "#0f2847",
                borderRadius: 16,
                padding: "36px 28px",
                textDecoration: "none",
                transition: "all 0.2s",
                opacity: m.disabled ? 0.6 : 1,
                cursor: m.disabled ? "not-allowed" : "pointer",
                boxShadow: m.disabled ? "none" : "0 2px 12px rgba(15,40,71,0.08)",
                pointerEvents: m.disabled ? "none" : "auto",
              }}
            >
              <div style={{ color: m.disabled ? "#94a3b8" : "#0f2847" }}>{m.icon}</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: m.disabled ? "#94a3b8" : "#0f2847" }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{m.descripcion}</div>
                {m.badge && (
                  <span style={{
                    display: "inline-block", marginTop: 8,
                    background: "#f1f5f9", color: "#64748b",
                    fontSize: 11, fontWeight: 600, padding: "3px 10px",
                    borderRadius: 20, letterSpacing: "0.04em"
                  }}>
                    {m.badge}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
