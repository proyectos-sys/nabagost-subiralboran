"""
Test de escritura en Odoo API
==============================
Verifica si el API_KEY actual tiene permisos de escritura.
"""
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

ODOO_URL = os.getenv('ODOO_URL')
DATABASE = os.getenv('DATABASE')
API_KEY = os.getenv('API_KEY')

print("=== Test de permisos de escritura en Odoo ===\n")

# 1. Buscar cualquier presupuesto reciente
url_search = f'{ODOO_URL}/json/2/sale.order/search_read'
r = requests.post(url_search, headers={
    'Authorization': f'bearer {API_KEY}',
    'X-Odoo-Database': DATABASE,
    'Content-Type': 'application/json',
}, json={'domain': [], 'fields': ['id','name','state','note'], 'limit': 1, 'order': 'id desc'}, timeout=10)

if r.status_code != 200:
    print(f"❌ Error en search: {r.status_code}")
    print(r.text[:300])
    exit(1)

result = r.json()
print(f"DEBUG: response type = {type(result)}, len = {len(result) if isinstance(result, list) else 'N/A'}\n")

# La API puede devolver directamente una lista o un dict con "result"
if isinstance(result, list):
    orders = result
elif isinstance(result, dict) and 'result' in result:
    orders = result['result']
else:
    orders = []

if not orders:
    print("❌ No se encontró ningún presupuesto")
    exit(1)

order = orders[0]
print(f"✅ Presupuesto encontrado: {order['name']}")
print(f"   ID: {order['id']}")
print(f"   Estado: {order['state']}")
print(f"   Nota actual: {order.get('note') or '(vacío)'}\n")

# 2. Intentar actualizar el campo 'note' (campo seguro, no afecta lógica de negocio)
url_write = f'{ODOO_URL}/json/2/sale.order/write'
r2 = requests.post(url_write, headers={
    'Authorization': f'bearer {API_KEY}',
    'X-Odoo-Database': DATABASE,
    'Content-Type': 'application/json',
}, json={
    'ids': [order['id']],
    'vals': {'note': 'TEST API - Prueba escritura desde chatbot (25/05/2026 09:55)'}
}, timeout=10)

print(f"Status del write: {r2.status_code}")

if r2.status_code == 200:
    resp = r2.json()
    print(f"✅ ESCRITURA PERMITIDA")
    print(f"Respuesta: {json.dumps(resp, indent=2)}")
    
    # Verificar que se aplicó el cambio
    r3 = requests.post(url_search, headers={
        'Authorization': f'bearer {API_KEY}',
        'X-Odoo-Database': DATABASE,
        'Content-Type': 'application/json',
    }, json={'domain': [['id','=',order['id']]], 'fields': ['note']}, timeout=10)
    
    if r3.status_code == 200:
        verify_result = r3.json()
        updated = verify_result[0] if isinstance(verify_result, list) else verify_result['result'][0]
        print(f"\n✅ Verificación: nota actualizada = {updated.get('note')[:100]}...")
else:
    print(f"❌ ESCRITURA RECHAZADA")
    print(f"Error: {r2.text[:500]}")

print("\n=== Fin del test ===")
