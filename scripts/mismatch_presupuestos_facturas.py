"""
mismatch_presupuestos_facturas.py
Muestra qué presupuestos NO tienen factura vinculada (mismatch).
Actualiza primero el contraste consultando Odoo en tiempo real.
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv
import requests

load_dotenv()

ODOO_URL = os.getenv("ODOO_URL")
DATABASE = os.getenv("DATABASE") or os.getenv("ODOO_DB")
API_KEY  = os.getenv("API_KEY") or os.getenv("ODOO_API_KEY")

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

def main():
    import argparse
    p = argparse.ArgumentParser(description="Mismatch: presupuestos sin factura")
    p.add_argument("--client", help="Filtrar por cliente (ilike)")
    p.add_argument("--solo-confirmados", action="store_true",
                   help="Mostrar solo los pedidos confirmados (sale) sin facturar")
    p.add_argument("--out", default="output/mismatch.json")
    args = p.parse_args()

    print("Consultando Odoo...")

    # 1. Presupuestos
    domain = []
    if args.client:
        domain.append(["partner_id.name", "ilike", args.client])
    orders = search_read("sale.order", domain,
        ["id", "name", "partner_id", "date_order", "amount_total",
         "state", "invoice_ids", "invoice_status"])

    # 2. Facturas para lookup
    invoices = search_read("account.move",
        [["move_type", "=", "out_invoice"]],
        ["id", "name", "invoice_date", "amount_total", "state"])
    inv_by_id = {i["id"]: i for i in invoices}

    # 3. Cruzar y quedarnos solo con los sin factura (no cancelados)
    sin_factura = []
    for o in orders:
        if o.get("state") == "cancel":
            continue
        inv_ids = o.get("invoice_ids") or []
        facturas_vinculadas = [inv_by_id[i] for i in inv_ids if i in inv_by_id]
        # Solo los que no tienen ninguna factura posted o draft
        if not facturas_vinculadas:
            partner = o.get("partner_id") or []
            sin_factura.append({
                "order_name":   o["name"],
                "date_order":   o.get("date_order", "")[:10],
                "partner":      partner[1] if len(partner) > 1 else None,
                "amount_total": o.get("amount_total"),
                "order_state":  o.get("state"),
                "invoice_status": o.get("invoice_status"),
            })

    if args.solo_confirmados:
        sin_factura = [r for r in sin_factura if r["order_state"] == "sale"]

    # Ordenar: primero confirmados, luego por importe desc
    sin_factura.sort(key=lambda r: (0 if r["order_state"] == "sale" else 1, -r["amount_total"]))

    # 4. Guardar JSON
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(sin_factura, indent=2, ensure_ascii=False), encoding="utf-8")

    # 5. Mostrar en consola
    confirmados = [r for r in sin_factura if r["order_state"] == "sale"]
    borradores  = [r for r in sin_factura if r["order_state"] in ("draft", "sent")]

    sep = "=" * 70

    if confirmados:
        print(f"\n{sep}")
        print(f"  PEDIDOS CONFIRMADOS sin factura  ({len(confirmados)})")
        print(sep)
        print(f"  {'Presupuesto':<18} {'Cliente':<35} {'Fecha':<12} {'Total':>10}")
        print("  " + "-" * 78)
        for r in confirmados:
            print(f"  {r['order_name']:<18} {(r['partner'] or '')[:35]:<35} "
                  f"{r['date_order']:<12} {r['amount_total']:>10.2f} EUR")
        print(f"\n  Subtotal: {sum(r['amount_total'] for r in confirmados):>10,.2f} EUR")

    if borradores:
        print(f"\n{sep}")
        print(f"  PRESUPUESTOS EN BORRADOR sin factura  ({len(borradores)})")
        print(sep)
        print(f"  {'Presupuesto':<18} {'Cliente':<35} {'Fecha':<12} {'Total':>10}")
        print("  " + "-" * 78)
        for r in borradores:
            print(f"  {r['order_name']:<18} {(r['partner'] or '')[:35]:<35} "
                  f"{r['date_order']:<12} {r['amount_total']:>10.2f} EUR")
        print(f"\n  Subtotal: {sum(r['amount_total'] for r in borradores):>10,.2f} EUR")

    total_eur = sum(r["amount_total"] for r in sin_factura)
    print(f"\n{sep}")
    print(f"  TOTAL sin facturar: {len(sin_factura)} presupuestos  -->  {total_eur:,.2f} EUR")
    print(sep)
    print(f"\nGuardado en: {args.out}")

if __name__ == "__main__":
    main()
