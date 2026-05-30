import AppHeader from "./AppHeader";
import Link from "next/link";

interface Props {
  titulo: string;
  descripcion?: string;
  seccion?: string;
  backHref?: string;
}

export default function ModuloEnConstruccion({ titulo, descripcion, seccion, backHref = "/ordenes" }: Props) {
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <AppHeader backHref={backHref} />
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 65px)", padding: 24 }}>
        <div style={{
          background: "white", borderRadius: 16, padding: "48px 40px",
          boxShadow: "0 4px 24px rgba(15,40,71,0.08)", maxWidth: 480, width: "100%",
          textAlign: "center"
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", background: "#0f2847",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px"
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
              <path d="M9 11l2 2 4-4" />
            </svg>
          </div>
          {seccion && (
            <div style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              {seccion}
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f2847", marginBottom: 10 }}>{titulo}</h1>
          <p style={{ color: "#64748b", marginBottom: 32, lineHeight: 1.6 }}>
            {descripcion || "Este módulo está en construcción. Será habilitado en la próxima iteración del desarrollo."}
          </p>
          <Link href={backHref} style={{
            display: "inline-block", background: "#0f2847", color: "white",
            padding: "12px 32px", borderRadius: 8, textDecoration: "none",
            fontWeight: 700, fontSize: 14, letterSpacing: "0.03em"
          }}>
            ← Volver
          </Link>
        </div>
      </main>
    </div>
  );
}
