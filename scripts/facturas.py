import os
import json
from pathlib import Path
from dotenv import load_dotenv
import requests

load_dotenv()

ODOO_URL = os.getenv("ODOO_URL")
DATABASE = os.getenv("DATABASE") or os.getenv("ODOO_DB")
API_KEY  = os.getenv("API_KEY") or os.getenv("ODOO_API_KEY")

def headers():
    return {
        "Authorization": f"bearer {API_KEY}",
        "X-Odoo-Database": DATABASE,
        "Content-Type": "application/json",
    }

def search_read(model, domain, fields):
    url = f"{ODOO_URL.rstrip('/')}/json/2/{model}/search_read"
    r = requests.post(url, headers=headers(), json={"domain": domain, "fields": fields}, timeout=30)
    r.raise_for_status()
    res = r.json()
    return res["result"] if isinstance(res, dict) and "result" in res else res

def call_method(model, method, ids, kwargs=None):
    """Llama a un metodo de Odoo (p.ej. action_send_and_print) via JSON API."""
    url = f"{ODOO_URL.rstrip('/')}/json/2/{model}/{method}"
    payload = {"ids": ids}
    if kwargs:
        payload.update(kwargs)
    r = requests.post(url, headers=headers(), json=payload, timeout=30)
    r.raise_for_status()
    return r.json()

# ─── Facturas ─────────────────────────────────────────────────────────────────

def get_invoices(client=None, state=None):
    """
    Devuelve facturas de cliente (out_invoice).
    client: filtro ilike sobre nombre del cliente (opcional)
    state:  'draft' | 'posted' | 'cancel' (opcional, default = todas)
    """
    domain = [["move_type", "=", "out_invoice"]]
    if client:
        domain.append(["partner_id.name", "ilike", client])
    if state:
        domain.append(["state", "=", state])
    return search_read(
        "account.move",
        domain,
        ["id", "name", "partner_id", "invoice_date", "invoice_date_due",
         "amount_untaxed", "amount_tax", "amount_total", "state", "invoice_line_ids"]
    )

def get_invoice_lines(invoice_id):
    try:
        return search_read(
            "account.move.line",
            [["move_id", "=", invoice_id], ["display_type", "=", "product"]],
            ["id", "product_id", "name", "quantity", "price_unit", "price_subtotal", "tax_ids"]
        )
    except Exception:
        return []

def build_output(invoices):
    out = []
    for inv in invoices:
        partner = inv.get("partner_id") or []
        lines_raw = get_invoice_lines(inv["id"])
        lines = []
        for ln in lines_raw:
            prod = ln.get("product_id") or []
            taxes = ln.get("tax_ids") or []
            lines.append({
                "id":            ln.get("id"),
                "product":       {"id": prod[0] if isinstance(prod, list) and prod else None,
                                  "name": prod[1] if isinstance(prod, list) and len(prod) > 1 else None},
                "description":   ln.get("name"),
                "qty":           ln.get("quantity"),
                "price_unit":    ln.get("price_unit"),
                "price_subtotal":ln.get("price_subtotal"),
                "taxes":         [{"id": t} if isinstance(t, int) else t for t in (taxes if isinstance(taxes, list) else [])],
            })
        out.append({
            "id":            inv["id"],
            "name":          inv["name"],
            "invoice_date":  inv.get("invoice_date"),
            "due_date":      inv.get("invoice_date_due"),
            "state":         inv.get("state"),
            "partner":       {"id": partner[0] if partner else None,
                              "name": partner[1] if len(partner) > 1 else None},
            "amount_untaxed":inv.get("amount_untaxed"),
            "amount_tax":    inv.get("amount_tax"),
            "amount_total":  inv.get("amount_total"),
            "lines":         lines,
        })
    return out

# ─── Envío por email ──────────────────────────────────────────────────────────

def send_invoice_by_email(invoice_id):
    """
    Dispara el envío de la factura por email usando la acción nativa de Odoo.
    Requiere que la factura esté en estado 'posted'.
    """
    try:
        result = call_method("account.move", "action_send_and_print", [invoice_id])
        return result
    except Exception as e:
        return {"error": str(e)}

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    import argparse
    p = argparse.ArgumentParser(description="Consultar y enviar facturas de Odoo")
    p.add_argument("--client",  help="Filtrar por nombre de cliente (ilike)")
    p.add_argument("--state",   help="Estado: draft | posted | cancel")
    p.add_argument("--send",    type=int, metavar="ID",
                                help="Enviar por email la factura con este ID (debe estar confirmada/posted)")
    p.add_argument("--out",     default="output/facturas.json", help="Archivo JSON de salida")
    args = p.parse_args()

    # Envío de una factura concreta
    if args.send:
        print(f"Enviando factura id={args.send} por email...")
        res = send_invoice_by_email(args.send)
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return

    # Consulta y exportación
    invoices = get_invoices(client=args.client, state=args.state)
    if not invoices:
        print("No se encontraron facturas con esos filtros")
        return

    output = build_output(invoices)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Exportadas {len(output)} facturas a {args.out}")
    # Resumen en consola
    print(f"\n{'Nº Factura':<15} {'Cliente':<45} {'Total':>10}  Estado")
    print("-" * 80)
    for inv in output:
        print(f"{inv['name']:<15} {inv['partner']['name'] or '':<45} {inv['amount_total']:>10.2f}  {inv['state']}")

if __name__ == "__main__":
    main()
