"""
Script de prueba: Crear presupuesto draft en Odoo
==================================================
Demuestra cómo crear un presupuesto con líneas desde cero.
"""
import os
import requests
import json
from datetime import date
from dotenv import load_dotenv

load_dotenv()

ODOO_URL = os.getenv('ODOO_URL')
DATABASE = os.getenv('DATABASE')
API_KEY = os.getenv('API_KEY')

print("=== Script: Crear presupuesto draft en Odoo ===\n")

# ─────────────────────────────────────────────────────────────────────────────
# 1. BUSCAR UN CLIENTE EXISTENTE
# ─────────────────────────────────────────────────────────────────────────────
print("1. Buscando clientes disponibles...")

r = requests.post(f'{ODOO_URL}/json/2/res.partner/search_read', headers={
    'Authorization': f'bearer {API_KEY}',
    'X-Odoo-Database': DATABASE,
    'Content-Type': 'application/json',
}, json={
    'domain': [['customer_rank', '>', 0]],  # Solo clientes
    'fields': ['id', 'name'],
    'limit': 5
}, timeout=10)

if r.status_code != 200:
    print(f"❌ Error al buscar clientes: {r.status_code}")
    print(r.text[:500])
    exit(1)

clientes = r.json()
if not clientes:
    print("❌ No se encontraron clientes")
    exit(1)

print(f"✅ {len(clientes)} clientes encontrados:")
for c in clientes:
    print(f"   - ID {c['id']}: {c['name']}")

cliente_id = clientes[0]['id']
cliente_nombre = clientes[0]['name']
print(f"\n→ Usando cliente: {cliente_nombre} (ID {cliente_id})\n")

# ─────────────────────────────────────────────────────────────────────────────
# 2. BUSCAR PRODUCTOS DISPONIBLES
# ─────────────────────────────────────────────────────────────────────────────
print("2. Buscando productos disponibles...")

r = requests.post(f'{ODOO_URL}/json/2/product.product/search_read', headers={
    'Authorization': f'bearer {API_KEY}',
    'X-Odoo-Database': DATABASE,
    'Content-Type': 'application/json',
}, json={
    'domain': [['sale_ok', '=', True]],  # Solo productos vendibles
    'fields': ['id', 'name', 'list_price'],
    'limit': 5
}, timeout=10)

if r.status_code != 200:
    print(f"❌ Error al buscar productos: {r.status_code}")
    print(r.text[:500])
    exit(1)

productos = r.json()
if not productos:
    print("❌ No se encontraron productos")
    exit(1)

print(f"✅ {len(productos)} productos encontrados:")
for p in productos:
    print(f"   - ID {p['id']}: {p['name']} - {p['list_price']} €")

# Seleccionar 2 productos para el presupuesto
producto1 = productos[0]
producto2 = productos[1] if len(productos) > 1 else productos[0]
print(f"\n→ Productos seleccionados:")
print(f"   1. {producto1['name']} - {producto1['list_price']} €")
print(f"   2. {producto2['name']} - {producto2['list_price']} €\n")

# ─────────────────────────────────────────────────────────────────────────────
# 3. CREAR PRESUPUESTO DRAFT
# ─────────────────────────────────────────────────────────────────────────────
print("3. Creando presupuesto draft...")

# Datos del presupuesto (cabecera)
presupuesto_data = {
    'partner_id': cliente_id,
    'date_order': date.today().isoformat(),
    'state': 'draft',
    'note': 'Presupuesto creado desde script Python - TEST',
    # Las líneas se crean después (Odoo recalcula totales automáticamente)
}

r = requests.post(f'{ODOO_URL}/json/2/sale.order/create', headers={
    'Authorization': f'bearer {API_KEY}',
    'X-Odoo-Database': DATABASE,
    'Content-Type': 'application/json',
}, json={'vals_list': [presupuesto_data]}, timeout=30)

if r.status_code != 200:
    print(f"❌ Error al crear presupuesto: {r.status_code}")
    print(r.text[:800])
    exit(1)

result = r.json()
print(f"DEBUG: create response = {result}")

# La respuesta es una lista de IDs
if isinstance(result, list) and len(result) > 0:
    presupuesto_id = result[0]
elif isinstance(result, int):
    presupuesto_id = result
else:
    print(f"❌ Formato de respuesta inesperado: {result}")
    exit(1)

print(f"✅ Presupuesto creado con ID: {presupuesto_id}\n")

# ─────────────────────────────────────────────────────────────────────────────
# 4. AÑADIR LÍNEAS AL PRESUPUESTO
# ─────────────────────────────────────────────────────────────────────────────
print("4. Añadiendo líneas al presupuesto...")

lineas = [
    {
        'order_id': presupuesto_id,
        'product_id': producto1['id'],
        'name': producto1['name'],  # Descripción
        'product_uom_qty': 2.0,      # Cantidad
        'price_unit': producto1['list_price'],
    },
    {
        'order_id': presupuesto_id,
        'product_id': producto2['id'],
        'name': producto2['name'],
        'product_uom_qty': 5.0,
        'price_unit': producto2['list_price'],
    },
]

lineas_creadas = []
for i, linea in enumerate(lineas, 1):
    r = requests.post(f'{ODOO_URL}/json/2/sale.order.line/create', headers={
        'Authorization': f'bearer {API_KEY}',
        'X-Odoo-Database': DATABASE,
        'Content-Type': 'application/json',
    }, json={'vals_list': [linea]}, timeout=10)
    
    if r.status_code != 200:
        print(f"❌ Error al crear línea {i}: {r.status_code}")
        print(r.text[:500])
    else:
        result = r.json()
        linea_id = result[0] if isinstance(result, list) else result
        lineas_creadas.append(linea_id)
        print(f"✅ Línea {i} creada (ID {linea_id}): {linea['product_uom_qty']}x {linea['name']}")

print(f"\n✅ {len(lineas_creadas)} líneas añadidas al presupuesto\n")

# ─────────────────────────────────────────────────────────────────────────────
# 5. VERIFICAR EL PRESUPUESTO CREADO
# ─────────────────────────────────────────────────────────────────────────────
print("5. Verificando presupuesto creado...")

r = requests.post(f'{ODOO_URL}/json/2/sale.order/search_read', headers={
    'Authorization': f'bearer {API_KEY}',
    'X-Odoo-Database': DATABASE,
    'Content-Type': 'application/json',
}, json={
    'domain': [['id', '=', presupuesto_id]],
    'fields': ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state', 'order_line']
}, timeout=10)

if r.status_code != 200:
    print(f"❌ Error al verificar: {r.status_code}")
    exit(1)

presupuestos = r.json()
if not presupuestos:
    print("❌ No se encontró el presupuesto creado")
    exit(1)

presupuesto = presupuestos[0]
print(f"\n{'='*70}")
print(f"✅ PRESUPUESTO CREADO EXITOSAMENTE")
print(f"{'='*70}")
print(f"Número:        {presupuesto['name']}")
print(f"ID:            {presupuesto['id']}")
print(f"Cliente:       {presupuesto['partner_id'][1] if isinstance(presupuesto['partner_id'], list) else presupuesto['partner_id']}")
print(f"Fecha:         {presupuesto['date_order']}")
print(f"Estado:        {presupuesto['state']}")
print(f"Nº líneas:     {len(presupuesto.get('order_line', []))}")
print(f"Total:         {presupuesto['amount_total']:,.2f} €")
print(f"{'='*70}\n")

print("🎉 Script completado con éxito")
print(f"\n💡 Puedes ver el presupuesto en Odoo:")
print(f"   {ODOO_URL}/web#id={presupuesto_id}&model=sale.order&view_type=form")
