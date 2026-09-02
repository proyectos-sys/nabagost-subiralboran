"""
mismatch_v2.py
==============
Mismatch calculado comparando presupuestos y facturas DIRECTAMENTE
por cliente + importe, sin confiar en el enlace invoice_ids de Odoo.

Esto cubre el caso de facturas creadas a mano (fuera del flujo de pedido).

Lógica de matching:
  - Para cada presupuesto (no cancelado) se busca una factura que tenga
    el mismo partner_id Y cuyo importe difiera menos de TOLERANCIA_EUR.
  - Si no se encuentra ninguna coincidencia → mismatch.

Uso:
    python3.11 scripts/mismatch_v2.py
    python3.11 scripts/mismatch_v2.py --solo-confirmados
    python3.11 scripts/mismatch_v2.py --client "ATYCO"
    python3.11 scripts/mismatch_v2.py --tolerancia 5
"""
import os
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
import requests

load_dotenv()

ODOO_URL = os.getenv("ODOO_URL")
DATABASE = os.getenv("DATABASE") or os.getenv("ODOO_DB")
API_KEY  = os.getenv("API_KEY") or os.getenv("ODOO_API_KEY")

TOLERANCIA_EUR = 1.0   # diferencia máxima de importe para considerar match


def search_read(model, domain, fields):
    url = f"{ODOO_URL.rstrip('/')}/json/2/{model}/search_read"
    r = requests.post(url, headers={
        "Authorization": f"bearer {API_KEY}",
        "X-Odoo-Database": DATABASE,
        "Content-Type": "application/json",
    }, json={"domain": domain, "fields": fields}, timeout=30)
    r.raise_for_status()
    res = r.json()
    return res["result"] if isinstance(res, dict) and "result" in res else res


def partner_id(record):
    """Devuelve el ID numérico del partner, sea cual sea el formato devuelto."""
    p = record.get("partner_id")
    if isinstance(p, (list, tuple)) and len(p) >= 1:
        return p[0]
    if isinstance(p, dict):
        return p.get("id")
    return p


def partner_name(record):
    p = record.get("partner_id")
    if isinstance(p, (list, tuple)) and len(p) >= 2:
        return p[1]
    if isinstance(p, dict):
        return p.get("name", "")
    return ""


def main():
    p = argparse.ArgumentParser(description="Mismatch presupuestos vs facturas (por cliente+importe)")
    p.add_argument("--client",           help="Filtrar por cliente (ilike)")
    p.add_argument("--solo-confirmados", action="store_true",
                   help="Mostrar solo pedidos confirmados (state=sale)")
    p.add_argument("--tolerancia",       type=float, default=TOLERANCIA_EUR,
                   help=f"Tolerancia EUR en importe para considerar match (default {TOLERANCIA_EUR})")
    p.add_argument("--out", default="output/mismatch_v2.json")
    args = p.parse_args()

    tol = args.tolerancia

    print("Consultando Odoo...")

    # ── 1. Presupuestos ──────────────────────────────────────────────────────
    order_domain = [["state", "!=", "cancel"]]
    if args.client:
        order_domain.append(["partner_id.name", "ilike", args.client])

    orders = search_read("sale.order", order_domain,
        ["id", "name", "partner_id", "date_order",
         "amount_total", "state", "invoice_ids", "invoice_status"])

    # ── 2. Facturas (out_invoice, sin canceladas) ────────────────────────────
    inv_domain = [
        ["move_type", "=", "out_invoice"],
        ["state",     "!=", "cancel"],
    ]
    if args.client:
        inv_domain.append(["partner_id.name", "ilike", args.client])

    invoices = search_read("account.move", inv_domain,
        ["id", "name", "partner_id", "invoice_date",
         "amount_total", "state"])

    print(f"  {len(orders)} presupuestos  |  {len(invoices)} facturas")

    # ── 3. Índice de facturas por partner_id ─────────────────────────────────
    # { partner_id: [ {id, name, amount_total, ...}, ... ] }
    inv_by_partner: dict[int, list] = {}
    for inv in invoices:
        pid = partner_id(inv)
        if pid is not None:
            inv_by_partner.setdefault(pid, []).append(inv)

    # ── 4. Cruzar ────────────────────────────────────────────────────────────
    matches     = []   # presupuesto con factura encontrada por client+importe
    sin_factura = []   # mismatch real

    for o in orders:
        if args.solo_confirmados and o.get("state") != "sale":
            continue

        pid   = partner_id(o)
        amount = o.get("amount_total", 0)

        # Busca facturas del mismo partner con importe similar
        candidatas = [
            inv for inv in inv_by_partner.get(pid, [])
            if abs(inv.get("amount_total", 0) - amount) <= tol
        ]

        row = {
            "order_name":       o["name"],
            "date_order":       (o.get("date_order") or "")[:10],
            "partner":          partner_name(o),
            "amount_total":     amount,
            "order_state":      o.get("state"),
            "invoice_status":   o.get("invoice_status"),
            "invoice_ids_link": o.get("invoice_ids") or [],          # enlace nativo Odoo
            "facturas_match":   [                                     # match por client+importe
                {"id": i["id"], "name": i["name"],
                 "amount": i["amount_total"], "state": i["state"]}
                for i in candidatas
            ],
        }

        if candidatas:
            matches.append(row)
        else:
            sin_factura.append(row)

    # Ordenar mismatch: confirmados primero, luego por importe desc
    sin_factura.sort(key=lambda r: (0 if r["order_state"] == "sale" else 1, -r["amount_total"]))

    # ── 5. Guardar JSON ───────────────────────────────────────────────────────
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    resultado = {
        "tolerancia_eur": tol,
        "resumen": {
            "total_presupuestos":     len(orders) if not args.solo_confirmados else len([o for o in orders if o["state"] == "sale"]),
            "con_factura_match":      len(matches),
            "sin_factura_mismatch":   len(sin_factura),
        },
        "sin_factura": sin_factura,
        "con_factura":  matches,
    }
    out_path.write_text(json.dumps(resultado, indent=2, ensure_ascii=False), encoding="utf-8")

    # ── 6. Mostrar por consola ────────────────────────────────────────────────
    sep = "=" * 72

    confirmados_sf = [r for r in sin_factura if r["order_state"] == "sale"]
    borradores_sf  = [r for r in sin_factura if r["order_state"] in ("draft", "sent")]

    if confirmados_sf:
        print(f"\n{sep}")
        print(f"  PEDIDOS CONFIRMADOS sin factura  ({len(confirmados_sf)})")
        print(sep)
        print(f"  {'Presupuesto':<22} {'Cliente':<36} {'Fecha':<12} {'Total':>12}")
        print("  " + "-" * 84)
        for r in confirmados_sf:
            print(f"  {r['order_name']:<22} {(r['partner'] or '')[:36]:<36} "
                  f"{r['date_order']:<12} {r['amount_total']:>12,.2f} EUR")
        print(f"\n  Subtotal: {sum(r['amount_total'] for r in confirmados_sf):>12,.2f} EUR")

    if borradores_sf and not args.solo_confirmados:
        print(f"\n{sep}")
        print(f"  BORRADORES sin factura  ({len(borradores_sf)})")
        print(sep)
        print(f"  {'Presupuesto':<22} {'Cliente':<36} {'Fecha':<12} {'Total':>12}")
        print("  " + "-" * 84)
        for r in borradores_sf:
            print(f"  {r['order_name']:<22} {(r['partner'] or '')[:36]:<36} "
                  f"{r['date_order']:<12} {r['amount_total']:>12,.2f} EUR")
        print(f"\n  Subtotal: {sum(r['amount_total'] for r in borradores_sf):>12,.2f} EUR")

    total_sf = sum(r["amount_total"] for r in sin_factura)
    print(f"\n{sep}")
    print(f"  MISMATCH total: {len(sin_factura)} presupuestos  -->  {total_sf:,.2f} EUR")
    print(f"  (tolerancia importe: ± {tol} EUR)")
    print(sep)

    if matches:
        print(f"\n  Con factura encontrada (por cliente+importe): {len(matches)} presupuestos")
        for r in matches:
            fnames = ", ".join(f["name"] for f in r["facturas_match"])
            print(f"    {r['order_name']:<20} {(r['partner'] or '')[:30]:<30} "
                  f"{r['amount_total']:>10,.2f} EUR  ->  {fnames}")

    print(f"\nGuardado en: {args.out}")


if __name__ == "__main__":
    main()
