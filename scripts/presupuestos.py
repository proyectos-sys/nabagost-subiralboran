import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

try:
    from scripts.get_my_quotations import post, find_user_id
except Exception:
    import requests
    def post(model, payload):
        ODOO_URL = os.getenv('ODOO_URL')
        DATABASE = os.getenv('DATABASE') or os.getenv('ODOO_DB')
        API_KEY = os.getenv('API_KEY') or os.getenv('ODOO_API_KEY')
        headers = {
            'Authorization': f'bearer {API_KEY}',
            'X-Odoo-Database': DATABASE,
            'Content-Type': 'application/json',
        }
        url = f"{ODOO_URL.rstrip('/')}/json/2/{model}/search_read"
        r = requests.post(url, headers=headers, json=payload, timeout=30)
        r.raise_for_status()
        return r.json()
    def find_user_id(login):
        payload = {'domain': [['login', '=', login]], 'fields': ['id'], 'limit': 1}
        res = post('res.users', payload)
        if isinstance(res, dict) and 'result' in res:
            data = res['result']
        else:
            data = res
        return data[0]['id'] if data else None

def get_quotations(user_id=None, partner_name=None):
    domain = [['state', 'in', ['draft', 'sent', 'sale']]]
    if user_id is not None:
        domain.append(['create_uid', '=', user_id])
    if partner_name is not None:
        domain.append(['partner_id.name', 'ilike', partner_name])
    payload = {'domain': domain, 'fields': ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state', 'create_uid', 'order_line']}
    res = post('sale.order', payload)
    if isinstance(res, dict) and 'result' in res:
        return res['result']
    return res

def get_lines_for_order(order_id, fallback_line_ids=None):
    try:
        payload = {'domain': [['order_id', '=', order_id]], 'fields': ['id', 'product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal', 'discount', 'tax_ids']}
        res = post('sale.order.line', payload)
        if isinstance(res, dict) and 'result' in res:
            return res['result']
        return res
    except Exception:
        if fallback_line_ids:
            try:
                payload = {'domain': [['id', 'in', fallback_line_ids]], 'fields': ['id', 'product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal', 'discount', 'tax_ids']}
                res = post('sale.order.line', payload)
                if isinstance(res, dict) and 'result' in res:
                    return res['result']
                return res
            except Exception:
                return None
        return None

def resolve_tax_names(tax_field):
    if not tax_field:
        return []
    ids = []
    if isinstance(tax_field, list) and tax_field and isinstance(tax_field[0], list):
        ids = [t[0] for t in tax_field]
    elif isinstance(tax_field, list) and tax_field and isinstance(tax_field[0], int):
        ids = tax_field
    else:
        return []
    try:
        res = post('account.tax', {'domain': [['id', 'in', ids]], 'fields': ['id', 'name']})
        if isinstance(res, dict) and 'result' in res:
            res = res['result']
        return [{ 'id': r['id'], 'name': r.get('name') } for r in res]
    except Exception:
        return [{'id': i} for i in ids]

def build_output(quotes):
    out = []
    for q in quotes:
        partner = q.get('partner_id') or []
        partner_obj = {'id': partner[0] if partner else None, 'name': partner[1] if len(partner) > 1 else None}
        creator = q.get('create_uid') or []
        creator_name = creator[1] if isinstance(creator, list) and len(creator) > 1 else creator
        order_line_ids = q.get('order_line') or []
        lines = get_lines_for_order(q.get('id'), fallback_line_ids=order_line_ids)
        structured_lines = []
        if lines:
            for ln in lines:
                prod = ln.get('product_id') or []
                prod_obj = {'id': prod[0] if isinstance(prod, list) and prod else prod if isinstance(prod, int) else None, 'name': prod[1] if isinstance(prod, list) and len(prod) > 1 else None}
                taxes = resolve_tax_names(ln.get('tax_ids'))
                structured_lines.append({
                    'id': ln.get('id'),
                    'product': prod_obj,
                    'description': ln.get('name'),
                    'qty': ln.get('product_uom_qty'),
                    'price_unit': ln.get('price_unit'),
                    'price_subtotal': ln.get('price_subtotal'),
                    'discount': ln.get('discount'),
                    'taxes': taxes,
                })
        else:
            structured_lines = [{'id': li} for li in order_line_ids]

        out.append({
            'id': q.get('id'),
            'name': q.get('name'),
            'date_order': q.get('date_order'),
            'state': q.get('state'),
            'partner': partner_obj,
            'amount_total': q.get('amount_total'),
            'create_uid': creator_name,
            'lines': structured_lines,
        })
    return out

def main():
    import argparse
    p = argparse.ArgumentParser(description='Generar JSON de presupuestos (presupuestos)')
    p.add_argument('--client', help='Nombre del cliente para filtrar (opcional, búsqueda ilike)')
    p.add_argument('--out', default='output/presupuestos.json', help='Archivo JSON de salida')
    args = p.parse_args()

    quotes = get_quotations(partner_name=args.client) if args.client else get_quotations()
    if isinstance(quotes, dict) and 'result' in quotes:
        quotes = quotes['result']
    if not quotes:
        print('No se encontraron presupuestos')
        return

    output = build_output(quotes)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding='utf-8')
    print('Exportado', len(output), 'presupuestos a', args.out)

if __name__ == '__main__':
    main()
