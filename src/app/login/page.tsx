"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { refetch } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Ingrese su correo y contraseña.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Credenciales incorrectas.");
        return;
      }
      await refetch();
      router.push("/inicio");
    } catch {
      setError("Error de conexión. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #061322 0%, #0f2847 30%, #1a3d6b 65%, #2a5a8a 100%)",
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/LOGO1.png" alt="Sync MSC" style={{ width: 110, height: 110, objectFit: "contain" }} />
      </div>

      <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 40, letterSpacing: "0.04em" }}>
        Sistema de Gestión de Mantenimiento Planta
      </p>

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: "36px 32px",
          backdropFilter: "blur(20px)",
        }}
      >
        <h2 style={{ color: "white", fontWeight: 700, fontSize: 18, marginBottom: 24, textAlign: "center" }}>
          Iniciar Sesión
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
              CORREO CORPORATIVO
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@minera.com"
              autoComplete="email"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 8,
                padding: "12px 14px",
                color: "white",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
              CONTRASEÑA
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 8,
                padding: "12px 14px",
                color: "white",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{ color: "#fca5a5", fontSize: 13, background: "rgba(239,68,68,0.15)", borderRadius: 6, padding: "8px 12px" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              background: loading ? "#2563eb99" : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "13px 0",
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.04em",
              transition: "background 0.2s",
            }}
          >
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </form>
      </div>

      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 40 }}>
        MANTENIMIENTO PLANTA
      </p>
    </div>
  );
}
