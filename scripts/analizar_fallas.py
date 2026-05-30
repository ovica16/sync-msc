"""
Análisis del Excel "MODULO ANÁLISIS DE FALLAS.xlsx".

Estructura real detectada:
  - Hoja "MODOS DE FALLO": catálogo de modos ISO 14224 (código + descripción).
  - Hoja "CAUSAS DE FALLA": catálogo de causas raíz (código MSC + descripción).
  - Hojas "ARBOL FALLAS <TIPO>": MATRIZ donde
        filas    = causas (código MSC en col B, descripción en col C)
        columnas = códigos de modo de falla ISO (BRD, ELP, FTS, ...)
        celdas   = marca (X / 1 / valor) cuando la causa aplica al modo.

Salidas en scripts/out/:
  - catalogo_modos.json        — todos los modos de falla ISO encontrados
  - catalogo_causas.json       — todas las causas con código MSC
  - arbol_fallas.json          — registros normalizados (tipoEquipo, modoFalla,
                                 causa, codigoCausa, codigoModo) listo para sembrar
  - resumen_fallas.md          — resumen humano

Uso:
    python scripts/analizar_fallas.py
    python scripts/analizar_fallas.py --excel "ruta/al/archivo.xlsx"
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd

# Forzar UTF-8 en stdout (consola Windows cp1252 rompe con flechas / acentos)
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = ROOT / "MODULO ANÁLISIS DE FALLAS.xlsx"
OUT_DIR = ROOT / "scripts" / "out"


def norm(s: Any) -> str:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


# Códigos de modo ISO 14224 conocidos (3 letras mayúsculas). Sirve para
# distinguir columnas-de-modo del resto.
RE_MODO_CODE = re.compile(r"^[A-Z]{3,4}$")


# ── Carga cruda + detección de fila de encabezado ─────────────────────────
def cargar_hojas(xlsx: Path) -> dict[str, pd.DataFrame]:
    if not xlsx.exists():
        sys.exit(f"No se encontró el archivo: {xlsx}")
    print(f"Archivo: {xlsx.name}")
    return pd.read_excel(xlsx, sheet_name=None, dtype=str, header=None)


def reubicar_header(raw: pd.DataFrame, hints: list[str], max_scan: int = 15) -> pd.DataFrame:
    """Encuentra la fila con más hints y la usa como encabezado."""
    best_idx, best_score = 0, 0
    for i in range(min(max_scan, len(raw))):
        fila = [norm(c).lower() for c in raw.iloc[i].tolist()]
        score = sum(1 for c in fila for h in hints if h and h in c)
        if score > best_score:
            best_score, best_idx = score, i
    headers = [norm(c) for c in raw.iloc[best_idx].tolist()]
    df = raw.iloc[best_idx + 1:].copy()
    seen: dict[str, int] = {}
    cols: list[str] = []
    for c in headers:
        base = c or "col"
        seen[base] = seen.get(base, 0) + 1
        cols.append(base if seen[base] == 1 else f"{base}_{seen[base]}")
    df.columns = cols
    return df.dropna(how="all").reset_index(drop=True)


# ── 1. Catálogo de MODOS de falla ─────────────────────────────────────────
def extraer_modos(crudas: dict[str, pd.DataFrame]) -> dict[str, dict]:
    """
    Hoja 'MODOS DE FALLO': busca filas con un código de 3-4 letras y descripción.
    Retorna { codigoISO: {codigo, sigla, nombreEs, descripcion} }
    """
    modos: dict[str, dict] = {}
    raw = crudas.get("MODOS DE FALLO")
    if raw is None:
        return modos
    for _, row in raw.iterrows():
        cells = [norm(c) for c in row.tolist()]
        # buscar la primera celda que sea un código tipo "BRD", "PFA008", etc.
        for j, val in enumerate(cells):
            if RE_MODO_CODE.match(val):
                resto = [c for c in cells[j + 1:] if c]
                modos[val] = {
                    "codigo": val,
                    "nombre": resto[0] if resto else "",
                    "nombreEs": resto[1] if len(resto) > 1 else "",
                    "descripcion": resto[2] if len(resto) > 2 else "",
                }
                break
    return modos


# ── 2. Catálogo de CAUSAS ─────────────────────────────────────────────────
def extraer_causas(crudas: dict[str, pd.DataFrame]) -> dict[str, dict]:
    """
    Hoja 'CAUSAS DE FALLA': columnas (CÓDIGO MSC | CAUSA DE FALLA | DESCRIPCIÓN).
    Retorna { codigoMSC: {codigo, nombre, descripcion} }
    """
    causas: dict[str, dict] = {}
    raw = crudas.get("CAUSAS DE FALLA")
    if raw is None:
        return causas
    df = reubicar_header(raw, hints=["código", "codigo", "causa", "descripción", "descripcion"])
    # localizar columnas por nombre flexible
    cols_low = {c.lower(): c for c in df.columns}

    def find(*aliases: str) -> str | None:
        for a in aliases:
            for low, orig in cols_low.items():
                if a in low:
                    return orig
        return None

    c_cod = find("código msc", "codigo msc", "código", "codigo")
    c_nom = find("causa de falla", "causa")
    c_des = find("descripción", "descripcion")

    if not c_cod:
        return causas
    for _, row in df.iterrows():
        cod = norm(row.get(c_cod, ""))
        if not cod or not re.match(r"^[A-Z0-9\-]{2,}$", cod):
            continue
        causas[cod] = {
            "codigo": cod,
            "nombre": norm(row.get(c_nom, "")) if c_nom else "",
            "descripcion": norm(row.get(c_des, "")) if c_des else "",
        }
    return causas


# ── 3. Árbol por tipo de equipo (matriz causas × modos) ───────────────────
def extraer_arbol(
    crudas: dict[str, pd.DataFrame],
    modos: dict[str, dict],
    causas: dict[str, dict],
) -> list[dict]:
    """
    Para cada hoja 'ARBOL FALLAS X':
      - localiza fila de encabezado (la que contiene varios códigos de modo).
      - cada fila de datos representa una causa (código + descripción).
      - una celda no vacía en columna-de-modo significa que la causa aplica.
    Genera un registro por (tipoEquipo, codigoModo, codigoCausa).
    """
    registros: list[dict] = []
    for nombre, raw in crudas.items():
        if not nombre.upper().startswith("ARBOL FALLAS"):
            continue
        tipo_equipo = nombre.replace("ARBOL FALLAS", "").strip()

        # Encontrar fila con más códigos de modo ISO
        best_idx, best_count = 0, 0
        for i in range(min(8, len(raw))):
            fila = [norm(c) for c in raw.iloc[i].tolist()]
            count = sum(1 for c in fila if RE_MODO_CODE.match(c))
            if count > best_count:
                best_count, best_idx = count, i
        if best_count < 2:
            print(f"  · '{nombre}': no se detectó fila de modos — saltada")
            continue

        header = [norm(c) for c in raw.iloc[best_idx].tolist()]
        modo_cols: dict[int, str] = {
            j: header[j] for j in range(len(header)) if RE_MODO_CODE.match(header[j])
        }

        # Heurística: la columna con código de causa y la de descripción
        # suelen estar antes de las columnas-de-modo.
        primera_modo = min(modo_cols)
        col_cod_causa = None
        col_desc_causa = None
        for j in range(primera_modo):
            valores = [norm(raw.iat[r, j]) for r in range(best_idx + 1, len(raw))]
            if any(re.match(r"^[A-Z0-9\-]{2,}$", v) for v in valores):
                col_cod_causa = col_cod_causa if col_cod_causa is not None else j
            elif any(len(v) > 6 for v in valores):
                col_desc_causa = col_desc_causa if col_desc_causa is not None else j

        # Patrón de código de causa real: 2-3 letras + dígitos (PCA001, AJD, BFR...)
        RE_CAUSA_CODE = re.compile(r"^[A-Z]{2,4}[0-9]{0,4}$")

        data = raw.iloc[best_idx + 1:]
        for _, row in data.iterrows():
            cells = [norm(c) for c in row.tolist()]
            cod_causa = cells[col_cod_causa] if col_cod_causa is not None and col_cod_causa < len(cells) else ""
            desc_causa = cells[col_desc_causa] if col_desc_causa is not None and col_desc_causa < len(cells) else ""

            # Saltar filas auxiliares (nombres de modo, códigos PFA, headers extra)
            # Solo procesar filas donde cod_causa es un código real
            if not RE_CAUSA_CODE.match(cod_causa):
                continue

            for j, cod_modo in modo_cols.items():
                if j >= len(cells):
                    continue
                marca = cells[j]
                # Solo marca X (o "x", "1") significa que la causa aplica
                if not marca or marca.lower() not in ("x", "1"):
                    continue
                registros.append({
                    "tipoEquipo": tipo_equipo,
                    "codigoModo": cod_modo,
                    "modoFalla": modos.get(cod_modo, {}).get("nombreEs") or modos.get(cod_modo, {}).get("nombre", ""),
                    "codigoCausa": cod_causa,
                    "causa": causas.get(cod_causa, {}).get("nombre") or desc_causa,
                    "descripcionCausa": causas.get(cod_causa, {}).get("descripcion", "") or desc_causa,
                    "hojaOrigen": nombre,
                })
        print(f"  · '{nombre}' → tipo='{tipo_equipo}', modos={len(modo_cols)}, registros añadidos hasta ahora: {len(registros)}")
    return registros


# ── 4. Resumen Markdown ───────────────────────────────────────────────────
def escribir_resumen(modos, causas, registros, hojas_count: int) -> None:
    md = [
        "# Resumen — Módulo Análisis de Fallas",
        "",
        f"- Hojas leídas: **{hojas_count}**",
        f"- Modos ISO 14224 catalogados: **{len(modos)}**",
        f"- Causas (código MSC) catalogadas: **{len(causas)}**",
        f"- Registros tipoEquipo × modo × causa: **{len(registros)}**",
        "",
        "## Tipos de equipo cubiertos",
        "",
    ]
    por_tipo: dict[str, int] = {}
    for r in registros:
        por_tipo[r["tipoEquipo"]] = por_tipo.get(r["tipoEquipo"], 0) + 1
    for k, v in sorted(por_tipo.items(), key=lambda x: -x[1]):
        md.append(f"- **{k}**: {v} relaciones")
    md += ["", "## Modos ISO 14224 (muestra)", ""]
    for cod, info in list(modos.items())[:25]:
        md.append(f"- `{cod}` — {info.get('nombreEs') or info.get('nombre')}")
    md += ["", "## Causas (muestra)", ""]
    for cod, info in list(causas.items())[:25]:
        md.append(f"- `{cod}` — {info.get('nombre')}")
    (OUT_DIR / "resumen_fallas.md").write_text("\n".join(md), encoding="utf-8")


# ── Main ──────────────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--excel", type=Path, default=DEFAULT_XLSX)
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    crudas = cargar_hojas(args.excel)
    print(f"Hojas: {len(crudas)}\n")

    print("[1/3] Extrayendo catálogo de modos…")
    modos = extraer_modos(crudas)
    print(f"   modos: {len(modos)}")

    print("[2/3] Extrayendo catálogo de causas…")
    causas = extraer_causas(crudas)
    print(f"   causas: {len(causas)}")

    print("[3/3] Procesando hojas ARBOL FALLAS…")
    registros = extraer_arbol(crudas, modos, causas)

    (OUT_DIR / "catalogo_modos.json").write_text(
        json.dumps(list(modos.values()), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "catalogo_causas.json").write_text(
        json.dumps(list(causas.values()), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "arbol_fallas.json").write_text(
        json.dumps(registros, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    escribir_resumen(modos, causas, registros, len(crudas))

    print("\nArchivos generados en scripts/out/:")
    print(f"  - catalogo_modos.json  ({len(modos)} modos)")
    print(f"  - catalogo_causas.json ({len(causas)} causas)")
    print(f"  - arbol_fallas.json    ({len(registros)} relaciones)")
    print(f"  - resumen_fallas.md")
    print("\nSiguiente paso: crear endpoint POST /api/seed/arbol-fallas")
    print("para cargar estos JSON al modelo ArbolFallas en MongoDB.")


if __name__ == "__main__":
    main()
