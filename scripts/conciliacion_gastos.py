"""
scripts/conciliacion_gastos.py
===============================
Lee TODAS las facturas de gasto (PDF/imagen) de una carpeta y el extracto
bancario (PDF/CSV/XLS/XLSX) de otra carpeta, las cruza entre sí y genera
un informe en Markdown con:

  - Facturas duplicadas (mismo proveedor + importe + fecha)
  - Gastos del banco SIN factura encontrada
  - Facturas SIN pago identificado en el banco
  - Gastos ya cuadrados (banco + factura)

No escribe nada en Odoo: es una conciliación local, pensada para
ejecutarse cada trimestre antes de pasarle los gastos a la asesoría.

Requiere GEMINI_API_KEY en .env (ya usado por chatbot/app.py y por
src/purchase-image) para leer facturas en PDF/imagen y extractos
bancarios en PDF. Los extractos en .csv/.xls/.xlsx se leen directamente
con pandas y no consumen llamadas a Gemini.

Uso:
    python scripts/conciliacion_gastos.py \
        --facturas "C:/ruta/a/facturas" \
        --banco "C:/ruta/a/extracto" \
        --out output/conciliacion_gastos.md

    python scripts/conciliacion_gastos.py --facturas ./facturas --banco ./banco --tolerancia 0.10
"""
import os
import re
import json
import time
import argparse
import mimetypes
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

FACTURA_EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
BANCO_TABULAR_EXTS = {".csv", ".xls", ".xlsx"}
BANCO_DOC_EXTS = {".pdf", ".jpg", ".jpeg", ".png"}

_client = None


def _gemini_client():
    global _client
    if _client is None:
        if not GEMINI_KEY:
            raise RuntimeError(
                "Falta GEMINI_API_KEY en .env - es necesario para leer facturas en PDF/imagen "
                "y extractos bancarios en PDF."
            )
        from google import genai
        _client = genai.Client(api_key=GEMINI_KEY)
    return _client


FACTURA_PROMPT = """Eres un asistente contable. Analiza esta factura o ticket de gasto y devuelve
EXCLUSIVAMENTE un JSON (sin texto adicional, sin markdown, sin ```), con estos campos:
{
  "fecha": "DD/MM/AAAA o null si no se ve",
  "proveedor": "nombre del proveedor/emisor (NO el cliente que recibe la factura)",
  "concepto": "resumen breve de que se compro",
  "base_imponible": numero o null,
  "iva": numero o null,
  "total": numero (obligatorio, el importe total a pagar, con el signo positivo),
  "numero_factura": "string o null",
  "moneda": "EUR por defecto"
}
Usa punto decimal en los numeros (no coma). Si el documento no es una factura sino un
pedido/presupuesto/comanda o un contrato sin IVA, indicalo anteponiendo "[NO ES FACTURA] " al
concepto, pero rellena igualmente el total si aparece un importe.
"""

BANCO_PROMPT = """Eres un asistente contable. Este documento es un extracto de movimientos
bancarios (puede tener varias paginas y varias tablas). Devuelve EXCLUSIVAMENTE un JSON (sin
texto adicional, sin markdown, sin ```) con este formato:
{
  "cuenta": "IBAN o identificador de cuenta si aparece, o null",
  "movimientos": [
    {"fecha": "DD/MM/AAAA", "concepto": "texto de la columna concepto tal cual aparece", "importe": numero}
  ]
}
El importe debe ser NEGATIVO si es un cargo/gasto y POSITIVO si es un ingreso, tal como aparece
en la columna "Importe" del extracto. Incluye TODOS los movimientos de TODAS las paginas, en el
mismo orden en que aparecen. Usa punto decimal en los importes (no coma).
"""


def _retry_gemini_call(fn, *args, **kwargs):
    """Reintenta una vez si Gemini devuelve un error de rate limit."""
    try:
        return fn(*args, **kwargs)
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
            wait = 20
            m = re.search(r"retryDelay.*?(\d+)s", msg)
            if m:
                wait = int(m.group(1))
            print(f"  (limite de Gemini alcanzado, esperando {wait}s y reintentando...)")
            time.sleep(wait)
            return fn(*args, **kwargs)
        raise


def _gemini_json(prompt: str, file_path: Path) -> dict:
    from google.genai import types

    client = _gemini_client()
    mime = mimetypes.guess_type(str(file_path))[0] or "application/pdf"
    data = file_path.read_bytes()
    part = types.Part.from_bytes(data=data, mime_type=mime)

    def _call():
        return client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[part, prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )

    response = _retry_gemini_call(_call)
    text = (response.text or "{}").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise ValueError(f"Respuesta de Gemini no es JSON valido para {file_path.name}: {text[:200]}")


# ─── extraccion de facturas ────────────────────────────────────────────────────

def extract_invoice(file_path: Path) -> dict:
    data = _gemini_json(FACTURA_PROMPT, file_path)
    data["_archivo"] = file_path.name
    return data


def load_invoices(folder: Path):
    invoices, errors = [], []
    files = sorted(f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in FACTURA_EXTS)
    for i, f in enumerate(files, 1):
        print(f"  [{i}/{len(files)}] {f.name}")
        try:
            invoices.append(extract_invoice(f))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{f.name}: {exc}")
    return invoices, errors


# ─── extraccion del extracto bancario ──────────────────────────────────────────

def extract_bank_pdf(file_path: Path) -> list:
    data = _gemini_json(BANCO_PROMPT, file_path)
    movimientos = data.get("movimientos", []) or []
    for m in movimientos:
        m["_archivo"] = file_path.name
        m["_cuenta"] = data.get("cuenta", "")
    return movimientos


def extract_bank_tabular(file_path: Path) -> list:
    import pandas as pd

    if file_path.suffix.lower() == ".csv":
        df = pd.read_csv(file_path, sep=None, engine="python")
    else:
        df = pd.read_excel(file_path)

    cols = {str(c).lower().strip(): c for c in df.columns}
    fecha_col = next((cols[c] for c in cols if "fecha" in c), None)
    concepto_col = next((cols[c] for c in cols if "concepto" in c or "descrip" in c), None)
    importe_col = next((cols[c] for c in cols if "importe" in c), None)

    if not (fecha_col and concepto_col and importe_col):
        raise ValueError(
            f"no se reconocen las columnas fecha/concepto/importe "
            f"(columnas encontradas: {list(df.columns)})"
        )

    movimientos = []
    for _, row in df.iterrows():
        importe = _to_float(row[importe_col])
        if importe is None:
            continue
        movimientos.append({
            "fecha": str(row[fecha_col]),
            "concepto": str(row[concepto_col]),
            "importe": importe,
            "_archivo": file_path.name,
        })
    return movimientos


def load_bank_movements(folder: Path):
    movimientos, errors = [], []
    files = sorted(f for f in folder.iterdir() if f.is_file())
    for f in files:
        ext = f.suffix.lower()
        try:
            if ext in BANCO_TABULAR_EXTS:
                movimientos.extend(extract_bank_tabular(f))
            elif ext in BANCO_DOC_EXTS:
                print(f"  leyendo {f.name} con Gemini...")
                movimientos.extend(extract_bank_pdf(f))
            else:
                continue
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{f.name}: {exc}")
    return movimientos, errors


# ─── utilidades ─────────────────────────────────────────────────────────────────

def _to_float(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s or s.lower() == "nan":
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().upper())


def _tokens(s: str) -> set:
    return set(re.findall(r"[A-ZÁÉÍÓÚÑ0-9]{3,}", _norm(s)))


# ─── deduplicado de facturas ────────────────────────────────────────────────────

def dedupe_invoices(invoices: list, tolerancia: float):
    unicas, duplicadas = [], []
    seen = []  # (proveedor_norm, total, fecha)

    for inv in invoices:
        total = _to_float(inv.get("total"))
        proveedor = _norm(inv.get("proveedor"))
        fecha = inv.get("fecha")
        is_dup = False
        for s_prov, s_total, s_fecha in seen:
            if (
                s_prov == proveedor
                and s_total is not None
                and total is not None
                and abs(s_total - total) <= tolerancia
                and s_fecha == fecha
            ):
                is_dup = True
                break
        if is_dup:
            duplicadas.append(inv)
        else:
            seen.append((proveedor, total, fecha))
            unicas.append(inv)
    return unicas, duplicadas


# ─── cruce banco vs facturas ────────────────────────────────────────────────────

def match_bank_vs_invoices(movimientos: list, facturas: list, tolerancia: float):
    gastos_banco = [
        m for m in movimientos
        if _to_float(m.get("importe")) is not None and _to_float(m.get("importe")) < 0
    ]

    disponibles = list(range(len(facturas)))
    banco_con_factura, banco_sin_factura = [], []

    for mov in gastos_banco:
        importe_abs = abs(_to_float(mov["importe"]))
        concepto_tokens = _tokens(mov.get("concepto", ""))

        candidatos = []
        for idx in disponibles:
            fac = facturas[idx]
            total = _to_float(fac.get("total"))
            if total is None or abs(abs(total) - importe_abs) > tolerancia:
                continue
            solapa = bool(concepto_tokens & _tokens(fac.get("proveedor", "")))
            candidatos.append((idx, solapa))

        if not candidatos:
            banco_sin_factura.append(mov)
            continue

        candidatos.sort(key=lambda c: (not c[1],))  # prioriza coincidencia de proveedor
        ambiguo = len(candidatos) > 1 and not any(c[1] for c in candidatos)
        chosen_idx = candidatos[0][0]
        disponibles.remove(chosen_idx)
        banco_con_factura.append({
            "movimiento": mov,
            "factura": facturas[chosen_idx],
            "ambiguo": ambiguo,
        })

    facturas_sin_pago = [facturas[i] for i in disponibles]
    return banco_con_factura, banco_sin_factura, facturas_sin_pago


# ─── informe markdown ───────────────────────────────────────────────────────────

def render_markdown(facturas_unicas, facturas_duplicadas, banco_con_factura,
                     banco_sin_factura, facturas_sin_pago, errores_facturas,
                     errores_banco, tolerancia) -> str:
    L = []
    L.append(f"# Conciliacion de gastos — generado {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    L.append("")

    total_facturas = round(sum(_to_float(f.get("total")) or 0 for f in facturas_unicas), 2)
    total_sin_factura = round(sum(abs(_to_float(m.get("importe")) or 0) for m in banco_sin_factura), 2)
    total_sin_pago = round(sum(_to_float(f.get("total")) or 0 for f in facturas_sin_pago), 2)
    ambiguos = [m for m in banco_con_factura if m.get("ambiguo")]

    L.append("## Resumen")
    L.append("")
    L.append(f"- Facturas unicas procesadas: **{len(facturas_unicas)}** (total {total_facturas:,.2f} EUR)")
    L.append(f"- Facturas duplicadas detectadas: **{len(facturas_duplicadas)}**")
    L.append(f"- Gastos del banco con factura encontrada: **{len(banco_con_factura)}**"
              f" ({len(ambiguos)} de ellos con match ambiguo, revisar)")
    L.append(f"- Gastos del banco SIN factura: **{len(banco_sin_factura)}** (total {total_sin_factura:,.2f} EUR)")
    L.append(f"- Facturas SIN pago identificado en el banco: **{len(facturas_sin_pago)}** (total {total_sin_pago:,.2f} EUR)")
    if errores_facturas or errores_banco:
        L.append(f"- Archivos con error de lectura: **{len(errores_facturas) + len(errores_banco)}**")
    L.append(f"- Tolerancia de importe usada para el cruce: +/- {tolerancia} EUR")
    L.append("")

    L.append("## Gastos del banco sin factura")
    L.append("")
    if banco_sin_factura:
        L.append("| Fecha | Concepto | Importe | Archivo extracto |")
        L.append("|---|---|---|---|")
        for m in sorted(banco_sin_factura, key=lambda x: x.get("fecha") or ""):
            L.append(f"| {m.get('fecha','')} | {m.get('concepto','')} | "
                      f"{_to_float(m.get('importe')):,.2f} EUR | {m.get('_archivo','')} |")
    else:
        L.append("Ninguno — todos los cargos del banco tienen factura.")
    L.append("")

    L.append("## Facturas sin pago identificado en el banco")
    L.append("")
    if facturas_sin_pago:
        L.append("| Fecha | Proveedor | Concepto | Total | Archivo factura |")
        L.append("|---|---|---|---|---|")
        for f in sorted(facturas_sin_pago, key=lambda x: x.get("fecha") or ""):
            L.append(f"| {f.get('fecha','')} | {f.get('proveedor','')} | {f.get('concepto','')} | "
                      f"{_to_float(f.get('total')):,.2f} EUR | {f.get('_archivo','')} |")
    else:
        L.append("Ninguna — todas las facturas tienen un pago identificado en el banco.")
    L.append("")

    L.append("## Cruces ambiguos (revisar a mano)")
    L.append("")
    if ambiguos:
        L.append("Hay varias facturas con el mismo importe y ninguna coincide claramente por nombre "
                  "de proveedor con el concepto del banco. Se ha emparejado con la primera encontrada:")
        L.append("")
        L.append("| Fecha banco | Concepto banco | Importe | Factura emparejada | Proveedor factura |")
        L.append("|---|---|---|---|---|")
        for a in ambiguos:
            m, f = a["movimiento"], a["factura"]
            L.append(f"| {m.get('fecha','')} | {m.get('concepto','')} | "
                      f"{_to_float(m.get('importe')):,.2f} EUR | {f.get('_archivo','')} | {f.get('proveedor','')} |")
    else:
        L.append("Ninguno.")
    L.append("")

    L.append("## Facturas duplicadas (mismo proveedor, importe y fecha)")
    L.append("")
    if facturas_duplicadas:
        L.append("| Fecha | Proveedor | Total | Archivo |")
        L.append("|---|---|---|---|")
        for f in facturas_duplicadas:
            L.append(f"| {f.get('fecha','')} | {f.get('proveedor','')} | "
                      f"{_to_float(f.get('total')):,.2f} EUR | {f.get('_archivo','')} |")
    else:
        L.append("Ninguna.")
    L.append("")

    L.append("## Gastos cuadrados (banco + factura encontrados)")
    L.append("")
    if banco_con_factura:
        L.append("| Fecha | Proveedor | Total | Archivo factura | Concepto banco |")
        L.append("|---|---|---|---|---|")
        for c in sorted(banco_con_factura, key=lambda x: x["movimiento"].get("fecha") or ""):
            f, m = c["factura"], c["movimiento"]
            L.append(f"| {f.get('fecha','')} | {f.get('proveedor','')} | "
                      f"{_to_float(f.get('total')):,.2f} EUR | {f.get('_archivo','')} | {m.get('concepto','')} |")
    else:
        L.append("Ninguno.")
    L.append("")

    if errores_facturas:
        L.append("## Errores al leer facturas")
        L.append("")
        for e in errores_facturas:
            L.append(f"- {e}")
        L.append("")

    if errores_banco:
        L.append("## Errores al leer el extracto bancario")
        L.append("")
        for e in errores_banco:
            L.append(f"- {e}")
        L.append("")

    return "\n".join(L)


# ─── main ────────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="Concilia facturas de gasto (PDF/imagen) contra el extracto bancario "
                    "y genera un informe Markdown. No escribe nada en Odoo."
    )
    p.add_argument("--facturas", required=True, help="Carpeta con las facturas de gasto (PDF/JPG/PNG)")
    p.add_argument("--banco", required=True, help="Carpeta con el extracto bancario (PDF/CSV/XLS/XLSX)")
    p.add_argument("--out", default="output/conciliacion_gastos.md", help="Ruta del informe Markdown de salida")
    p.add_argument("--tolerancia", type=float, default=0.05,
                   help="Tolerancia en EUR para considerar que dos importes coinciden (default 0.05)")
    args = p.parse_args()

    facturas_dir = Path(args.facturas)
    banco_dir = Path(args.banco)
    if not facturas_dir.is_dir():
        raise SystemExit(f"No existe la carpeta de facturas: {facturas_dir}")
    if not banco_dir.is_dir():
        raise SystemExit(f"No existe la carpeta del extracto bancario: {banco_dir}")

    print(f"Leyendo facturas de {facturas_dir} ...")
    facturas_raw, errores_facturas = load_invoices(facturas_dir)
    print(f"  {len(facturas_raw)} facturas leidas, {len(errores_facturas)} errores")

    print(f"Leyendo extracto bancario de {banco_dir} ...")
    movimientos, errores_banco = load_bank_movements(banco_dir)
    print(f"  {len(movimientos)} movimientos leidos, {len(errores_banco)} errores")

    facturas_unicas, facturas_duplicadas = dedupe_invoices(facturas_raw, args.tolerancia)
    banco_con_factura, banco_sin_factura, facturas_sin_pago = match_bank_vs_invoices(
        movimientos, facturas_unicas, args.tolerancia
    )

    md = render_markdown(
        facturas_unicas, facturas_duplicadas,
        banco_con_factura, banco_sin_factura, facturas_sin_pago,
        errores_facturas, errores_banco, args.tolerancia,
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(md, encoding="utf-8")

    debug_path = out_path.with_suffix(".json")
    debug_path.write_text(json.dumps({
        "facturas_unicas": facturas_unicas,
        "facturas_duplicadas": facturas_duplicadas,
        "banco_con_factura": banco_con_factura,
        "banco_sin_factura": banco_sin_factura,
        "facturas_sin_pago": facturas_sin_pago,
        "errores_facturas": errores_facturas,
        "errores_banco": errores_banco,
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nInforme guardado en: {out_path}")
    print(f"Detalle JSON en:     {debug_path}")


if __name__ == "__main__":
    main()
