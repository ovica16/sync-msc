"""
Cruza TagNiveles.xlsx (Tipo + Descripción Tipo) con las categorías que
descubrimos en arbol_fallas.json, y genera scripts/out/mapeo_tipos.json
con la forma:
    { "EMT": "MOTORES", "PMP": "BOMBAS", ..., "BLD": null }

Uso:
    python scripts/mapear_tipos.py
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path
import pandas as pd

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "TagNiveles.xlsx"
ARBOL = ROOT / "scripts" / "out" / "arbol_fallas.json"
OUT = ROOT / "scripts" / "out" / "mapeo_tipos.json"

# Overrides manuales (correcciones a casos ambiguos descubiertos al analizar).
MANUAL: dict[str, str | None] = {
    "EMT": "MOTORES",
    "PMP": "BOMBAS",
    "CMP": "COMPRESORES",
    "VLV": "VALVULAS",
    "TRF": "TRANSFORMADORES",
    "PTF": "TRANSFORMADORES",
    "TNS": "TANQUES",
    "HDS": "SIST HIDRÁULICOS",
    "LBS": "SIST LUBRICACIÓN",
    "HTE": "INTERCAMBIADORES",
    "SNT": "SENSORES",
    "AEM": "VARIADORES DE FREC",
    "PGC": "GENERADORES",
    "TPM": "CAJAS ENGR",
    "HLE": "PUENTES GRUA",
    "SLC": "CINTAS",
    "FLT": "TUBERIAS",          # filtros van con tuberías (no hay categoría propia)
    "PRF": "TUBERIAS",
    "FLH": "TUBERIAS",
    "GAH": "PULMONES AIRE",
    "VTE": "PULMONES AIRE",
    "MIL": "MOTORES",           # molienda usa motores grandes; aprox
    # Sin match en ArbolFallas (no son equipos rotativos / mecánicos)
    "BLD": None, "ACT": None, "ANL": None, "BRK": None, "CMR": None,
    "CNT": None, "DEE": None, "DTB": None, "DTC": None, "ECT": None,
    "IND": None, "PCP": None, "PRE": None, "PSW": None, "PWB": None,
    "SLS": None, "STR": None, "SWT": None, "TDN": None, "TRM": None,
    "TRP": None, "VME": None, "WPT": None, "CRH": None,
}


def main() -> None:
    if not XLSX.exists():
        sys.exit(f"No se encontró: {XLSX}")
    if not ARBOL.exists():
        sys.exit(f"No se encontró: {ARBOL}. Corre primero analizar_fallas.py")

    df = pd.read_excel(XLSX, header=1)
    df.columns = [str(c).strip() for c in df.columns]
    col_tipo = next((c for c in df.columns if c.lower().startswith("tipo")), None)
    col_desc = next((c for c in df.columns if "descripci" in c.lower() and "tipo" in c.lower()), None)
    if not col_tipo or not col_desc:
        sys.exit(f"No se encontraron columnas Tipo/Descripción Tipo. Cols: {list(df.columns)}")

    sub = df[[col_tipo, col_desc]].dropna().drop_duplicates()
    sub = sub[sub[col_tipo].astype(str).str.match(r"^[A-Z]{2,4}$")]
    tipos_jde: dict[str, str] = {str(r[col_tipo]).strip(): str(r[col_desc]).strip() for _, r in sub.iterrows()}

    arbol = json.loads(ARBOL.read_text(encoding="utf-8"))
    cats = sorted(set(r["tipoEquipo"] for r in arbol))

    mapeo: dict[str, str | None] = {}
    sin_revisar: list[tuple[str, str]] = []

    for cod, desc in sorted(tipos_jde.items()):
        if cod in MANUAL:
            mapeo[cod] = MANUAL[cod]
            continue
        # Match heurístico por palabra raíz del descripción JDE vs categoría
        desc_norm = re.sub(r"[^a-záéíóúñ ]", "", desc.lower()).strip()
        match = None
        for cat in cats:
            cat_norm = cat.lower().replace("í", "i").replace("ó", "o").replace("á", "a")
            if cat_norm in desc_norm or desc_norm in cat_norm:
                match = cat
                break
        mapeo[cod] = match
        if not match:
            sin_revisar.append((cod, desc))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(mapeo, ensure_ascii=False, indent=2), encoding="utf-8")

    mapeados = sum(1 for v in mapeo.values() if v)
    print(f"Total tipos JDE        : {len(tipos_jde)}")
    print(f"Mapeados a ArbolFallas : {mapeados}")
    print(f"Sin categoría (null)   : {len(tipos_jde) - mapeados}")
    print(f"Categorías cubiertas   : {len({v for v in mapeo.values() if v})}/{len(cats)}")
    if sin_revisar:
        print("\nSin match automático (quedaron null):")
        for cod, desc in sin_revisar:
            print(f"  {cod}: {desc}")
    print(f"\nArchivo: {OUT}")


if __name__ == "__main__":
    main()
