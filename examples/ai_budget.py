"""Ejemplo: generar texto de presupuesto con OpenAI y crear una cotización en Odoo.

Este script es un esqueleto: adapta los campos según tu modelo de cotizaciones en Odoo.
"""
import os
from dotenv import load_dotenv
from scripts.odoo_rpc import OdooRPC

load_dotenv()

OPENAI_KEY = os.getenv('OPENAI_API_KEY')
try:
    import openai
    openai.api_key = OPENAI_KEY
except Exception:
    openai = None

def generate_budget_text(client_name, items):
    prompt = f"Genera un presupuesto para {client_name} con estos items:\n"
    for it in items:
        prompt += f"- {it['name']}: {it['price']}\n"
    prompt += "Incluye total y condiciones breves."

    if not openai:
        return 'Texto de ejemplo: (instala openai para generar texto real)'

    resp = openai.ChatCompletion.create(
        model='gpt-4o-mini',
        messages=[{'role':'user','content':prompt}],
        max_tokens=400,
    )
    return resp['choices'][0]['message']['content']

def create_quotation_in_odoo(client, text):
    rpc = OdooRPC()
    partner = rpc.search_read('res.partner', [['name','=',client]], ['id'], limit=1)
    partner_id = partner[0]['id'] if partner else None
    vals = {
        'partner_id': partner_id,
        'name': 'Presupuesto generado por IA',
        'note': text,
    }
    qid = rpc.create('sale.order', vals)
    print('Cotización creada id=', qid)

def main():
    client = 'Cliente Ejemplo'
    items = [{'name':'Servicio A','price':1000},{'name':'Producto B','price':250}]
    text = generate_budget_text(client, items)
    print('--- Texto generado ---')
    print(text)
    create_quotation_in_odoo(client, text)

if __name__ == '__main__':
    main()
