import os
import json
from pathlib import Path
from dotenv import load_dotenv
import requests

load_dotenv()

def post(model, payload):
    ODOO_URL = os.getenv("ODOO_URL")
    DATABASE = os.getenv("DATABASE") or os.getenv("ODOO_DB")
    API_KEY = os.getenv("API_KEY") or os.getenv("ODOO_API_KEY")
    headers = {
        "Authorization": f"bearer {API_KEY}",
        "X-Odoo-Database": DATABASE,
        "Content-Type": "application/json",
    }
    url = f"{ODOO_URL.rstrip('/')}/json/2/{model}/search_read"
    r = requests.post(url, headers=headers, json=payload, timeout=30)
    r.raise_for_status()
    return r.json()

def get_purchases(partner_name=None):
    domain = []
    if partner_name:
        domain.append(["partner_id.name", "ilike", partner_name])
    res = post("purchase.order", {"domain": domain, "fields": ["id", "name", "partner_id", "date_order", "amount_total", "state", "order_line"]})
    if isinstance(res, dict) and "result" in res:
        return res["result"]
    return res

def get_lines_for_order(order_id, fallback_ids=None):
    for tax_field in ["taxes_id", "tax_ids", None]:
        fields = ["id", "product_id", "name", "product_qty", "price_unit", "price_subtotal"]
        if tax_field:
            fields.append(tax_field)
        try:
            res = post("purchase.order.line", {"domain": [["order_id", "=", order_id]], "fields": fields})
            if isinstance(res, dict) and "result" in res:
                return res["result"], tax_field
            return res, tax_field
        except Exception:
            continue
    if fallback_ids:
        try:
            res = post("purchase.order.line", {"domain": [["id", "in", fallback_ids]], "fields": ["id", "product_id", "name", "product_qty", "price_unit", "price_subtotal"]})
            if isinstance(res, dict) and "result" in res:
                return res["result"], None
            return res, None
        except Exception:
            pass
    return None, None

def build_output(purchases):
    out = []
    for q in purchases:
        partner = q.get("partner_id") or []
        order_line_ids = q.get("order_line") or []
        lines_raw, tax_field = get_lines_for_order(q.get("id"), fallback_ids=order_line_ids)
        structured_lines = []
        if lines_raw:
            for ln in lines_raw:
                prod = ln.get("product_id") or []
                taxes_raw = ln.get(tax_field) if tax_field else []
                taxes = []
                if isinstance(taxes_raw, list):
                    for t in taxes_raw:
                        if isinstance(t, list) and len(t) >= 2:
                            taxes.append({"id": t[0], "name": t[1]})
                        elif isinstance(t, int):
                            taxes.append({"id": t})
                structured_lines.append({
                    "id": ln.get("id"),
                    "product": {"id": prod[0] if isinstance(prod, list) and prod else None, "name": prod[1] if isinstance(prod, list) and len(prod) > 1 else None},
                    "description": ln.get("name"),
                    "qty": ln.get("product_qty"),
                    "price_unit": ln.get("price_unit"),
                    "price_subtotal": ln.get("price_subtotal"),
                    "taxes": taxes,
                })
        else:
            structured_lines = [{"id": li} for li in order_line_ids]
        out.append({
            "id": q.get("id"),
            "name": q.get("name"),
            "date_order": q.get("date_order"),
            "state": q.get("state"),
            "partner": {"id": partner[0] if isinstance(partner, list) and partner else None, "name": partner[1] if isinstance(partner, list) and len(partner) > 1 else None},
            "amount_total": q.get("amount_total"),
            "lines": structured_lines,
        })
    return out

def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--supplier", help="Nombre del proveedor para filtrar (ilike)")
    p.add_argument("--out", default="output/compras.json")
    args = p.parse_args()
    purchases = get_purchases(partner_name=args.supplier)
    if isinstance(purchases, dict) and "result" in purchases:
        purchases = purchases["result"]
    if not purchases:
        print("No se encontraron compras")
        return
    output = build_output(purchases)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Exportado", len(output), "compras a", args.out)

if __name__ == "__main__":
    main()
