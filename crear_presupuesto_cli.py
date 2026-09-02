"""
Script CLI interactivo: Crear presupuesto draft en Odoo
========================================================
Valida cliente y productos antes de crear, sugiere opciones si no hay coincidencia exacta.

Uso:
    python3.11 crear_presupuesto_cli.py
"""
import os
import sys
import requests
import json
from datetime import date
from dotenv import load_dotenv

load_dotenv()

ODOO_URL = os.getenv('ODOO_URL')
DATABASE = os.getenv('DATABASE')
API_KEY = os.getenv('API_KEY')


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS API ODOO
# ═══════════════════════════════════════════════════════════════════════════════

def _search_read(model: str, domain: list, fields: list, limit: int = None) -> list:
    """Consulta registros en Odoo."""
    payload = {"domain": domain, "fields": fields}
    if limit:
        payload["limit"] = limit
    
    r = requests.post(f'{ODOO_URL}/json/2/{model}/search_read', headers={
        'Authorization': f'bearer {API_KEY}',
        'X-Odoo-Database': DATABASE,
        'Content-Type': 'application/json',
    }, json=payload, timeout=30)
    
    r.raise_for_status()
    res = r.json()
    return res if isinstance(res, list) else res.get("result", [])


def _create(model: str, vals_list: list) -> list:
    """Crea registros en Odoo. Devuelve lista de IDs."""
    r = requests.post(f'{ODOO_URL}/json/2/{model}/create', headers={
        'Authorization': f'bearer {API_KEY}',
        'X-Odoo-Database': DATABASE,
        'Content-Type': 'application/json',
    }, json={'vals_list': vals_list}, timeout=30)
    
    r.raise_for_status()
    res = r.json()
    return res if isinstance(res, list) else [res]


# ═══════════════════════════════════════════════════════════════════════════════
# FUNCIONES DE BÚSQUEDA INTERACTIVA
# ═══════════════════════════════════════════════════════════════════════════════

def buscar_cliente_interactivo(nombre_parcial: str):
    """
    Busca cliente por nombre. Si hay múltiples coincidencias, deja elegir.
    Retorna: (id, nombre) o None si se cancela.
    """
    print(f"\n🔍 Buscando clientes que coincidan con: '{nombre_parcial}'...")
    
    clientes = _search_read("res.partner", 
                           [["name", "ilike", nombre_parcial], ["customer_rank", ">", 0]], 
                           ["id", "name"], 
                           limit=10)
    
    if not clientes:
        print(f"❌ No se encontraron clientes con '{nombre_parcial}'")
        print("\n💡 Intenta buscar con menos caracteres o parte del nombre.")
        return None
    
    if len(clientes) == 1:
        cliente = clientes[0]
        print(f"✅ Cliente encontrado: {cliente['name']}")
        confirmar = input("   ¿Es correcto? (s/n): ").strip().lower()
        if confirmar != 's':
            return None
        return (cliente['id'], cliente['name'])
    
    # Múltiples coincidencias → mostrar lista
    print(f"\n✅ Se encontraron {len(clientes)} clientes:")
    for i, c in enumerate(clientes, 1):
        print(f"   {i}. {c['name']}")
    print(f"   0. Cancelar")
    
    while True:
        try:
            opcion = input("\n👉 Selecciona un número: ").strip()
            idx = int(opcion)
            if idx == 0:
                return None
            if 1 <= idx <= len(clientes):
                cliente = clientes[idx - 1]
                return (cliente['id'], cliente['name'])
            print("❌ Opción inválida, intenta de nuevo.")
        except ValueError:
            print("❌ Debes introducir un número.")


def buscar_producto_interactivo(nombre_parcial: str):
    """
    Busca producto por nombre. Si hay múltiples coincidencias, deja elegir.
    Retorna: (id, nombre, precio_lista) o None si se cancela.
    """
    print(f"\n🔍 Buscando productos que coincidan con: '{nombre_parcial}'...")
    
    productos = _search_read("product.product",
                            [["name", "ilike", nombre_parcial], ["sale_ok", "=", True]],
                            ["id", "name", "list_price"],
                            limit=10)
    
    if not productos:
        print(f"❌ No se encontraron productos con '{nombre_parcial}'")
        print("\n💡 Intenta buscar con menos caracteres o parte del nombre.")
        return None
    
    if len(productos) == 1:
        producto = productos[0]
        print(f"✅ Producto encontrado: {producto['name']} ({producto['list_price']} €)")
        confirmar = input("   ¿Es correcto? (s/n): ").strip().lower()
        if confirmar != 's':
            return None
        return (producto['id'], producto['name'], producto['list_price'])
    
    # Múltiples coincidencias → mostrar lista
    print(f"\n✅ Se encontraron {len(productos)} productos:")
    for i, p in enumerate(productos, 1):
        precio = f"{p['list_price']:.2f} €" if p['list_price'] else "(sin precio)"
        print(f"   {i}. {p['name']} - {precio}")
    print(f"   0. Cancelar")
    
    while True:
        try:
            opcion = input("\n👉 Selecciona un número: ").strip()
            idx = int(opcion)
            if idx == 0:
                return None
            if 1 <= idx <= len(productos):
                producto = productos[idx - 1]
                return (producto['id'], producto['name'], producto['list_price'])
            print("❌ Opción inválida, intenta de nuevo.")
        except ValueError:
            print("❌ Debes introducir un número.")


# ═══════════════════════════════════════════════════════════════════════════════
# SCRIPT PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("╔═══════════════════════════════════════════════════════════════════╗")
    print("║  Script CLI: Crear Presupuesto Draft en Odoo                     ║")
    print("╚═══════════════════════════════════════════════════════════════════╝\n")
    
    # ─────────────────────────────────────────────────────────────────────────
    # 1. BUSCAR CLIENTE
    # ─────────────────────────────────────────────────────────────────────────
    print("PASO 1: Buscar cliente")
    print("─" * 70)
    
    cliente_id, cliente_nombre = None, None
    while not cliente_id:
        nombre = input("\n📝 Nombre del cliente (o 'salir' para cancelar): ").strip()
        if nombre.lower() in ['salir', 'exit', 'quit']:
            print("\n👋 Cancelado por el usuario.")
            return
        
        if not nombre:
            print("❌ El nombre no puede estar vacío.")
            continue
        
        resultado = buscar_cliente_interactivo(nombre)
        if resultado:
            cliente_id, cliente_nombre = resultado
    
    print(f"\n✅ Cliente seleccionado: {cliente_nombre} (ID {cliente_id})\n")
    
    # ─────────────────────────────────────────────────────────────────────────
    # 2. AÑADIR LÍNEAS DE PRODUCTOS
    # ─────────────────────────────────────────────────────────────────────────
    print("\nPASO 2: Añadir productos al presupuesto")
    print("─" * 70)
    
    lineas = []
    
    while True:
        print(f"\n📦 Producto #{len(lineas) + 1}")
        print("   (escribe 'fin' para terminar, 'mostrar' para ver resumen)")
        
        nombre_producto = input("\n📝 Nombre del producto: ").strip()
        
        if nombre_producto.lower() == 'fin':
            if not lineas:
                print("\n⚠️  Debes añadir al menos 1 producto.")
                continue
            break
        
        if nombre_producto.lower() == 'mostrar':
            if lineas:
                print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                print("RESUMEN ACTUAL:")
                for i, linea in enumerate(lineas, 1):
                    subtotal = linea['cantidad'] * linea['precio_unit']
                    print(f"  {i}. {linea['producto_nombre']}")
                    print(f"     {linea['cantidad']} x {linea['precio_unit']:.2f} € = {subtotal:.2f} €")
                print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
            else:
                print("\n⚠️  Aún no has añadido productos.")
            continue
        
        if not nombre_producto:
            print("❌ El nombre no puede estar vacío.")
            continue
        
        # Buscar producto
        resultado_producto = buscar_producto_interactivo(nombre_producto)
        if not resultado_producto:
            print("⚠️  Producto no seleccionado, intenta de nuevo.")
            continue
        
        producto_id, producto_nombre_real, precio_lista = resultado_producto
        
        # Pedir cantidad
        while True:
            try:
                cantidad_str = input(f"\n📊 Cantidad (enter para 1): ").strip()
                cantidad = float(cantidad_str) if cantidad_str else 1.0
                if cantidad <= 0:
                    print("❌ La cantidad debe ser mayor que 0.")
                    continue
                break
            except ValueError:
                print("❌ Debes introducir un número válido.")
        
        # Pedir precio (opcional)
        while True:
            precio_str = input(f"\n💰 Precio unitario (enter para usar {precio_lista:.2f} €): ").strip()
            if not precio_str:
                precio_final = precio_lista
                break
            try:
                precio_final = float(precio_str)
                if precio_final < 0:
                    print("❌ El precio no puede ser negativo.")
                    continue
                break
            except ValueError:
                print("❌ Debes introducir un número válido.")
        
        # Añadir línea
        lineas.append({
            'producto_id': producto_id,
            'producto_nombre': producto_nombre_real,
            'cantidad': cantidad,
            'precio_unit': precio_final,
        })
        
        subtotal = cantidad * precio_final
        print(f"\n✅ Línea añadida: {cantidad} x {producto_nombre_real} = {subtotal:.2f} €")
    
    # ─────────────────────────────────────────────────────────────────────────
    # 3. NOTA OPCIONAL
    # ─────────────────────────────────────────────────────────────────────────
    print("\n\nPASO 3: Nota interna (opcional)")
    print("─" * 70)
    nota = input("\n📝 Nota para el presupuesto (enter para vacío): ").strip()
    
    # ─────────────────────────────────────────────────────────────────────────
    # 4. RESUMEN Y CONFIRMACIÓN
    # ─────────────────────────────────────────────────────────────────────────
    total = sum(l['cantidad'] * l['precio_unit'] for l in lineas)
    
    print("\n\n╔═══════════════════════════════════════════════════════════════════╗")
    print("║  RESUMEN DEL PRESUPUESTO                                          ║")
    print("╚═══════════════════════════════════════════════════════════════════╝")
    print(f"\n📌 Cliente: {cliente_nombre}")
    print(f"📅 Fecha:   {date.today().strftime('%d/%m/%Y')}")
    if nota:
        print(f"📝 Nota:    {nota[:60]}...")
    print(f"\n📦 Productos ({len(lineas)} líneas):")
    print("─" * 70)
    for i, linea in enumerate(lineas, 1):
        subtotal = linea['cantidad'] * linea['precio_unit']
        print(f"  {i}. {linea['producto_nombre']}")
        print(f"     {linea['cantidad']} x {linea['precio_unit']:.2f} € = {subtotal:.2f} €")
    print("─" * 70)
    print(f"💰 TOTAL: {total:,.2f} €\n")
    
    confirmar = input("✅ ¿Crear este presupuesto en Odoo? (s/n): ").strip().lower()
    if confirmar != 's':
        print("\n❌ Presupuesto NO creado. Cancelado por el usuario.")
        return
    
    # ─────────────────────────────────────────────────────────────────────────
    # 5. CREAR PRESUPUESTO EN ODOO
    # ─────────────────────────────────────────────────────────────────────────
    print("\n⏳ Creando presupuesto en Odoo...")
    
    try:
        # Crear cabecera
        presupuesto_vals = {
            "partner_id": cliente_id,
            "date_order": date.today().isoformat(),
            "state": "draft",
        }
        if nota:
            presupuesto_vals["note"] = nota
        
        presupuesto_ids = _create("sale.order", [presupuesto_vals])
        presupuesto_id = presupuesto_ids[0]
        
        print(f"✅ Presupuesto creado (ID {presupuesto_id})")
        
        # Crear líneas
        print(f"⏳ Añadiendo {len(lineas)} líneas...")
        for i, linea in enumerate(lineas, 1):
            linea_vals = {
                "order_id": presupuesto_id,
                "product_id": linea['producto_id'],
                "name": linea['producto_nombre'],
                "product_uom_qty": linea['cantidad'],
                "price_unit": linea['precio_unit'],
            }
            _create("sale.order.line", [linea_vals])
            print(f"   ✅ Línea {i}/{len(lineas)}")
        
        # Obtener número final
        presupuestos = _search_read("sale.order", [["id", "=", presupuesto_id]], 
                                    ["name", "amount_total"])
        presupuesto = presupuestos[0]
        
        print("\n╔═══════════════════════════════════════════════════════════════════╗")
        print("║  ✅ PRESUPUESTO CREADO EXITOSAMENTE                               ║")
        print("╚═══════════════════════════════════════════════════════════════════╝")
        print(f"\n📋 Número:  {presupuesto['name']}")
        print(f"💰 Total:   {presupuesto['amount_total']:,.2f} €")
        print(f"\n🔗 Ver en Odoo:")
        print(f"   {ODOO_URL}/web#id={presupuesto_id}&model=sale.order&view_type=form")
        print("\n🎉 ¡Listo!\n")
        
    except Exception as e:
        print(f"\n❌ Error al crear presupuesto: {str(e)}")
        print(f"\nDetalles técnicos: {e}")
        return


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Cancelado por el usuario.")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ Error inesperado: {e}")
        sys.exit(1)
