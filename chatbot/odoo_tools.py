"""
chatbot/odoo_tools.py
=====================
Funciones de consulta a Odoo vía REST API.
Usadas por:
  - chatbot/app.py   (Gemini function calling en el chat web)
  - mcp_server.py    (herramientas MCP para Copilot)

Cada función devuelve JSON en texto (str) listo para que
el LLM lo procese y presente en formato tabla o markdown.
"""

import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

_ODOO_URL = os.getenv("ODOO_URL", "")
_DATABASE = os.getenv("DATABASE") or os.getenv("ODOO_DB", "")
_API_KEY  = os.getenv("API_KEY") or os.getenv("ODOO_API_KEY", "")


# ─── helper interno ───────────────────────────────────────────────────────────

def _search_read(model: str, domain: list, fields: list, limit: int = None) -> list:
    url = f"{_ODOO_URL.rstrip('/')}/json/2/{model}/search_read"
    payload = {"domain": domain, "fields": fields}
    if limit is not None:
        payload["limit"] = limit
    
    r = requests.post(url, headers={
        "Authorization": f"bearer {_API_KEY}",
        "X-Odoo-Database": _DATABASE,
        "Content-Type": "application/json",
    }, json=payload, timeout=30)
    r.raise_for_status()
    res = r.json()
    return res["result"] if isinstance(res, dict) and "result" in res else res


def _pname(record) -> str:
    """Devuelve el nombre del partner."""
    p = record.get("partner_id")
    return p[1] if isinstance(p, (list, tuple)) and len(p) > 1 else str(p or "")


def _pid(record):
    """Devuelve el ID numérico del partner."""
    p = record.get("partner_id")
    return p[0] if isinstance(p, (list, tuple)) else p


def _fmt(v) -> str:
    """Formatea importe para visualización."""
    return f"{v:,.2f} €" if isinstance(v, (int, float)) else str(v)


def _next_month(mes: str) -> str:
    """Dado 'YYYY-MM' devuelve el primer día del mes siguiente (para filtros de rango)."""
    y, m = int(mes[:4]), int(mes[5:7])
    if m == 12:
        return f"{y+1}-01-01"
    return f"{y}-{m+1:02d}-01"


def _create(model: str, vals_list: list) -> list:
    """Crea uno o más registros en Odoo. Devuelve lista de IDs creados."""
    url = f"{_ODOO_URL.rstrip('/')}/json/2/{model}/create"
    r = requests.post(url, headers={
        "Authorization": f"bearer {_API_KEY}",
        "X-Odoo-Database": _DATABASE,
        "Content-Type": "application/json",
    }, json={"vals_list": vals_list}, timeout=30)
    r.raise_for_status()
    res = r.json()
    return res if isinstance(res, list) else [res]


def _buscar_cliente(nombre: str, max_sugerencias: int = 5):
    """
    Busca un cliente por nombre.
    Retorna:
      - Si encuentra 1 coincidencia exacta: (id, nombre)
      - Si encuentra múltiples: {"sugerencias": [(id, nombre), ...]}
      - Si no encuentra nada: None
    """
    clientes = _search_read("res.partner", 
                           [["name", "ilike", nombre], ["customer_rank", ">", 0]], 
                           ["id", "name"],
                           limit=max_sugerencias)
    if not clientes:
        return None
    if len(clientes) == 1:
        return (clientes[0]["id"], clientes[0]["name"])
    # Múltiples coincidencias
    return {"sugerencias": [(c["id"], c["name"]) for c in clientes]}


def _buscar_producto(nombre: str, max_sugerencias: int = 5):
    """
    Busca un producto por nombre.
    Retorna:
      - Si encuentra 1 coincidencia exacta: (id, nombre, precio)
      - Si encuentra múltiples: {"sugerencias": [(id, nombre, precio), ...]}
      - Si no encuentra nada: None
    """
    productos = _search_read("product.product", 
                            [["name", "ilike", nombre], ["sale_ok", "=", True]], 
                            ["id", "name", "list_price"],
                            limit=max_sugerencias)
    if not productos:
        return None
    if len(productos) == 1:
        p = productos[0]
        return (p["id"], p["name"], p["list_price"])
    # Múltiples coincidencias
    return {"sugerencias": [(p["id"], p["name"], p["list_price"]) for p in productos]}


# ─── herramientas públicas ────────────────────────────────────────────────────

def odoo_presupuestos(cliente: str = "", mes: str = "") -> str:
    """
    Devuelve los presupuestos / pedidos de venta de Odoo (sale.order).
    Parámetros opcionales:
      - cliente: filtro parcial por nombre
      - mes: filtro por mes en formato YYYY-MM (ej. '2026-05'). Si no se indica, devuelve el mes actual.
    Incluye: número, cliente, fecha, total, estado, estado de facturación.
    """
    from datetime import date
    if not mes:
        mes = date.today().strftime("%Y-%m")

    domain = [["state", "!=", "cancel"],
              ["date_order", ">=", f"{mes}-01"],
              ["date_order", "<", _next_month(mes)]]
    if cliente:
        domain.append(["partner_id.name", "ilike", cliente])

    rows = _search_read("sale.order", domain,
        ["name", "partner_id", "date_order", "amount_total",
         "state", "invoice_status", "invoice_ids"])

    result = [{
        "presupuesto":  o["name"],
        "cliente":      _pname(o),
        "fecha":        (o.get("date_order") or "")[:10],
        "total_eur":    o.get("amount_total"),
        "estado":       o.get("state"),           # draft | sent | sale | cancel
        "facturacion":  o.get("invoice_status"),  # no | to invoice | invoiced
        "n_facturas":   len(o.get("invoice_ids") or []),
    } for o in rows]

    result.sort(key=lambda x: x["fecha"], reverse=True)
    total = round(sum(r["total_eur"] for r in result), 2)

    return json.dumps({
        "n_presupuestos": len(result),
        "total_eur":      total,
        "presupuestos":   result,
    }, ensure_ascii=False)


def odoo_facturas(cliente: str = "", estado: str = "", mes: str = "") -> str:
    """
    Devuelve las facturas de venta de Odoo (account.move, tipo out_invoice).
    Parámetros opcionales:
      - cliente: filtro parcial por nombre de cliente
      - estado: 'draft' (borrador), 'posted' (confirmada), 'cancel'
      - mes: filtro por mes en formato YYYY-MM. Si no se indica, devuelve el mes actual.
    Incluye: número, cliente, fecha, total, estado.
    """
    from datetime import date
    if not mes:
        mes = date.today().strftime("%Y-%m")

    domain = [["move_type", "=", "out_invoice"],
              ["invoice_date", ">=", f"{mes}-01"],
              ["invoice_date", "<", _next_month(mes)]]
    if cliente:
        domain.append(["partner_id.name", "ilike", cliente])
    if estado:
        domain.append(["state", "=", estado])

    rows = _search_read("account.move", domain,
        ["name", "partner_id", "invoice_date", "amount_total", "state"])

    result = [{
        "factura":   i["name"],
        "cliente":   _pname(i),
        "fecha":     (i.get("invoice_date") or "")[:10],
        "total_eur": i.get("amount_total"),
        "estado":    i.get("state"),   # draft | posted | cancel
    } for i in rows]

    result.sort(key=lambda x: x["fecha"], reverse=True)
    total = round(sum(r["total_eur"] for r in result), 2)

    return json.dumps({
        "n_facturas": len(result),
        "total_eur":  total,
        "facturas":   result,
    }, ensure_ascii=False)


def odoo_compras(proveedor: str = "", mes: str = "") -> str:
    """
    Devuelve las órdenes de compra de Odoo (purchase.order).
    Parámetros opcionales:
      - proveedor: filtro parcial por nombre
      - mes: filtro por mes en formato YYYY-MM. Si no se indica, devuelve el mes actual.
    Incluye: número, proveedor, fecha, total, estado.
    """
    from datetime import date
    if not mes:
        mes = date.today().strftime("%Y-%m")

    domain = [["date_order", ">=", f"{mes}-01"],
              ["date_order", "<", _next_month(mes)]]
    if proveedor:
        domain.append(["partner_id.name", "ilike", proveedor])
    rows = _search_read("purchase.order", domain,
        ["name", "partner_id", "date_order", "amount_total", "state"])

    result = [{
        "orden":      o["name"],
        "proveedor":  _pname(o),
        "fecha":      (o.get("date_order") or "")[:10],
        "total_eur":  o.get("amount_total"),
        "estado":     o.get("state"),   # draft | purchase | done | cancel
    } for o in rows]

    result.sort(key=lambda x: x["fecha"], reverse=True)
    total = round(sum(r["total_eur"] for r in result), 2)

    return json.dumps({
        "n_compras": len(result),
        "total_eur": total,
        "compras":   result,
    }, ensure_ascii=False)


def odoo_mismatch(
    cliente: str = "",
    solo_confirmados: bool = False,
    tolerancia_eur: float = 1.0,
) -> str:
    """
    Detecta presupuestos que NO tienen factura correspondiente en Odoo.
    El cruce se hace por cliente + importe (tolerancia configurable),
    lo que detecta también facturas creadas manualmente sin enlazar al pedido.

    Parámetros opcionales:
      - cliente: filtro parcial por nombre
      - solo_confirmados: si True, muestra solo pedidos confirmados (state=sale)
      - tolerancia_eur: diferencia máxima en EUR para considerar que un importe coincide (default 1.0)

    Devuelve presupuestos sin factura y resumen estadístico.
    """
    order_domain = [["state", "!=", "cancel"]]
    if cliente:
        order_domain.append(["partner_id.name", "ilike", cliente])

    orders = _search_read("sale.order", order_domain,
        ["name", "partner_id", "date_order", "amount_total", "state", "invoice_status"])

    inv_domain = [["move_type", "=", "out_invoice"], ["state", "!=", "cancel"]]
    if cliente:
        inv_domain.append(["partner_id.name", "ilike", cliente])

    invoices = _search_read("account.move", inv_domain,
        ["name", "partner_id", "invoice_date", "amount_total", "state"])

    # índice por partner
    inv_by_partner: dict = {}
    for inv in invoices:
        p = _pid(inv)
        if p is not None:
            inv_by_partner.setdefault(p, []).append(inv)

    sin_factura, con_factura = [], []

    for o in orders:
        if solo_confirmados and o.get("state") != "sale":
            continue
        amount = o.get("amount_total", 0)
        candidatas = [
            i for i in inv_by_partner.get(_pid(o), [])
            if abs(i.get("amount_total", 0) - amount) <= tolerancia_eur
        ]
        row = {
            "presupuesto":    o["name"],
            "cliente":        _pname(o),
            "fecha":          (o.get("date_order") or "")[:10],
            "total_eur":      amount,
            "estado":         o.get("state"),
            "facturacion":    o.get("invoice_status"),
            "facturas_match": [i["name"] for i in candidatas],
        }
        (con_factura if candidatas else sin_factura).append(row)

    sin_factura.sort(key=lambda r: (0 if r["estado"] == "sale" else 1, -r["total_eur"]))

    total_sf = round(sum(r["total_eur"] for r in sin_factura), 2)
    confirmados_sf = [r for r in sin_factura if r["estado"] == "sale"]

    return json.dumps({
        "resumen": {
            "presupuestos_analizados":   len(orders),
            "sin_factura_mismatch":      len(sin_factura),
            "con_factura_match":         len(con_factura),
            "confirmados_sin_facturar":  len(confirmados_sf),
            "total_eur_sin_facturar":    total_sf,
            "tolerancia_eur":            tolerancia_eur,
        },
        "sin_factura": sin_factura,
        "con_factura":  con_factura,
    }, ensure_ascii=False)


def odoo_contraste(cliente: str = "") -> str:
    """
    Calcula la tasa de conversión de presupuestos a facturas usando el enlace
    nativo de Odoo (campo invoice_ids en sale.order).

    Devuelve:
      - Resumen: total presupuestos, confirmados, facturados, sin facturar, tasa de conversión
      - Detalle por pedido: número, cliente, importe, estado, facturas vinculadas

    Parámetro opcional: cliente (filtro parcial por nombre).
    """
    domain = [["state", "!=", "cancel"]]
    if cliente:
        domain.append(["partner_id.name", "ilike", cliente])

    orders = _search_read("sale.order", domain,
        ["name", "partner_id", "date_order", "amount_total",
         "state", "invoice_ids", "invoice_status"])

    inv_ids_all = list({iid for o in orders for iid in (o.get("invoice_ids") or [])})
    inv_by_id: dict = {}
    if inv_ids_all:
        invs = _search_read("account.move",
            [["id", "in", inv_ids_all]],
            ["id", "name", "invoice_date", "amount_total", "state"])
        inv_by_id = {i["id"]: i for i in invs}

    confirmados = [o for o in orders if o.get("state") == "sale"]
    facturados  = [o for o in confirmados if o.get("invoice_ids")]
    tasa        = round(len(facturados) / len(confirmados) * 100, 1) if confirmados else 0.0

    detalle = [{
        "presupuesto": o["name"],
        "cliente":     _pname(o),
        "fecha":       (o.get("date_order") or "")[:10],
        "total_eur":   o.get("amount_total"),
        "estado":      o.get("state"),
        "facturacion": o.get("invoice_status"),
        "n_facturas":  len([i for i in (o.get("invoice_ids") or []) if i in inv_by_id]),
        "facturas":    [inv_by_id[i]["name"] for i in (o.get("invoice_ids") or []) if i in inv_by_id],
    } for o in orders]

    detalle.sort(key=lambda r: r["fecha"], reverse=True)

    return json.dumps({
        "resumen": {
            "total_presupuestos":        len(orders),
            "presupuestos_confirmados":  len(confirmados),
            "presupuestos_facturados":   len(facturados),
            "presupuestos_sin_facturar": len(confirmados) - len(facturados),
            "tasa_conversion_pct":       tasa,
        },
        "detalle": detalle,
    }, ensure_ascii=False)


def odoo_lineas_compra(numero: str) -> str:
    """
    Devuelve las líneas de detalle de una orden de compra concreta.
    Parámetro requerido: numero (p.ej. 'P00012').
    Incluye: producto, descripción, cantidad, precio unitario, subtotal.
    """
    orders = _search_read("purchase.order", [["name", "=", numero]], ["id", "name", "partner_id", "amount_total"])
    if not orders:
        return json.dumps({"error": f"No se encontró la orden de compra {numero}"}, ensure_ascii=False)

    order = orders[0]
    lines = _search_read(
        "purchase.order.line",
        [["order_id", "=", order["id"]]],
        ["product_id", "name", "product_qty", "price_unit", "price_subtotal"]
    )

    result = []
    for l in lines:
        prod = l.get("product_id")
        result.append({
            "producto":    prod[1] if isinstance(prod, (list, tuple)) else str(prod or ""),
            "descripcion": l.get("name", ""),
            "cantidad":    l.get("product_qty"),
            "precio_unit": l.get("price_unit"),
            "subtotal":    l.get("price_subtotal"),
        })

    return json.dumps({
        "orden":      order["name"],
        "proveedor":  _pname(order),
        "total_eur":  order.get("amount_total"),
        "n_lineas":   len(result),
        "lineas":     result,
    }, ensure_ascii=False)


def odoo_lineas_presupuesto(numero: str) -> str:
    """
    Devuelve las líneas de detalle de un presupuesto/pedido de venta concreto.
    Parámetro requerido: numero (p.ej. 'S00034').
    Incluye: producto, descripción, cantidad, precio unitario, subtotal.
    """
    orders = _search_read("sale.order", [["name", "=", numero]], ["id", "name", "partner_id", "amount_total"])
    if not orders:
        return json.dumps({"error": f"No se encontró el presupuesto {numero}"}, ensure_ascii=False)

    order = orders[0]
    lines = _search_read(
        "sale.order.line",
        [["order_id", "=", order["id"]]],
        ["product_id", "name", "product_uom_qty", "price_unit", "price_subtotal"]
    )

    result = []
    for l in lines:
        prod = l.get("product_id")
        result.append({
            "producto":    prod[1] if isinstance(prod, (list, tuple)) else str(prod or ""),
            "descripcion": l.get("name", ""),
            "cantidad":    l.get("product_uom_qty"),
            "precio_unit": l.get("price_unit"),
            "subtotal":    l.get("price_subtotal"),
        })

    return json.dumps({
        "presupuesto": order["name"],
        "cliente":     _pname(order),
        "total_eur":   order.get("amount_total"),
        "n_lineas":    len(result),
        "lineas":      result,
    }, ensure_ascii=False)


def odoo_crear_presupuesto(cliente: str, lineas: str, nota: str = "") -> str:
    """
    Crea un presupuesto draft en Odoo (sale.order).
    
    Parámetros:
      - cliente: Nombre del cliente (busca por coincidencia parcial)
      - lineas: Texto JSON con una lista de diccionarios con:
          * producto: nombre del producto (busca por coincidencia)
          * cantidad: cantidad a presupuestar
          * precio: precio unitario (opcional, usa precio de lista si no se indica)
      - nota: Nota interna opcional para el presupuesto
    
    Ejemplo:
        odoo_crear_presupuesto(
            cliente="ATYCO",
            lineas='[
                {"producto": "LASER", "cantidad": 1, "precio": 5800},
                {"producto": "Soldadura", "cantidad": 160, "precio": 42}
            ]',
            nota="Presupuesto para proyecto X"
        )
    
    Devuelve JSON con el número del presupuesto creado y detalles.
    """
    from datetime import date

    try:
        lineas_parseadas = json.loads(lineas) if isinstance(lineas, str) else lineas
        if not isinstance(lineas_parseadas, list):
            raise ValueError("lineas debe ser una lista JSON")
    except Exception as exc:
        return json.dumps({
            "error": f"El parametro lineas debe ser un texto JSON con una lista de lineas. Detalle: {str(exc)}",
            "ejemplo": '[{"producto":"LASER","cantidad":1,"precio":5800}]',
        }, ensure_ascii=False)
    
    # 1. Buscar cliente
    cliente_info = _buscar_cliente(cliente)
    if not cliente_info:
        return json.dumps({
            "error": f"No se encontró el cliente '{cliente}'. Verifica el nombre e intenta con menos caracteres."
        }, ensure_ascii=False)
    
    # Si hay múltiples coincidencias, retornar sugerencias
    if isinstance(cliente_info, dict) and "sugerencias" in cliente_info:
        sugerencias = [{"id": cid, "nombre": cnombre} for cid, cnombre in cliente_info["sugerencias"]]
        return json.dumps({
            "error": f"Se encontraron {len(sugerencias)} clientes que coinciden con '{cliente}'",
            "accion_requerida": "Debes especificar exactamente cuál cliente quieres usar",
            "sugerencias_clientes": sugerencias
        }, ensure_ascii=False)
    
    cliente_id, cliente_nombre = cliente_info
    
    # 2. Crear cabecera del presupuesto
    presupuesto_vals = {
        "partner_id": cliente_id,
        "date_order": date.today().isoformat(),
        "state": "draft",
    }
    if nota:
        presupuesto_vals["note"] = nota
    
    try:
        presupuesto_ids = _create("sale.order", [presupuesto_vals])
        presupuesto_id = presupuesto_ids[0]
    except Exception as e:
        return json.dumps({
            "error": f"Error al crear presupuesto: {str(e)}"
        }, ensure_ascii=False)
    
    # 3. Añadir líneas de producto
    lineas_creadas = []
    lineas_error = []
    
    for i, linea in enumerate(lineas_parseadas, 1):
        if not isinstance(linea, dict):
            lineas_error.append(f"Línea {i}: la linea debe ser un objeto con producto, cantidad y precio")
            continue

        producto_nombre = linea.get("producto", "")
        cantidad = linea.get("cantidad", 1.0)
        precio = linea.get("precio")
        
        # Buscar producto
        producto_info = _buscar_producto(producto_nombre)
        if not producto_info:
            lineas_error.append(f"Línea {i}: producto '{producto_nombre}' no encontrado")
            continue
        
        # Si hay múltiples coincidencias para algún producto, retornar error antes de crear nada más
        if isinstance(producto_info, dict) and "sugerencias" in producto_info:
            sugerencias = [{"id": pid, "nombre": pnombre, "precio": pprecio} 
                          for pid, pnombre, pprecio in producto_info["sugerencias"]]
            return json.dumps({
                "error": f"Línea {i}: Se encontraron {len(sugerencias)} productos que coinciden con '{producto_nombre}'",
                "accion_requerida": "Debes especificar exactamente qué producto quieres en la línea",
                "linea_numero": i,
                "producto_buscado": producto_nombre,
                "sugerencias_productos": sugerencias
            }, ensure_ascii=False)
        
        producto_id, producto_nombre_real, precio_lista = producto_info
        precio_final = precio if precio is not None else precio_lista
        
        # Crear línea
        linea_vals = {
            "order_id": presupuesto_id,
            "product_id": producto_id,
            "name": producto_nombre_real,
            "product_uom_qty": float(cantidad),
            "price_unit": float(precio_final),
        }
        
        try:
            linea_ids = _create("sale.order.line", [linea_vals])
            lineas_creadas.append({
                "producto": producto_nombre_real,
                "cantidad": cantidad,
                "precio_unit": precio_final,
                "subtotal": cantidad * precio_final,
            })
        except Exception as e:
            lineas_error.append(f"Línea {i}: error al crear ({str(e)})")
    
    # 4. Obtener el presupuesto creado con su número
    presupuesto_final = _search_read("sale.order", [["id", "=", presupuesto_id]], 
                                     ["name", "partner_id", "amount_total", "state"])[0]
    
    resultado = {
        "success": True,
        "presupuesto": presupuesto_final["name"],
        "id": presupuesto_id,
        "cliente": presupuesto_final["partner_id"][1] if isinstance(presupuesto_final["partner_id"], list) else cliente_nombre,
        "estado": presupuesto_final["state"],
        "total_eur": presupuesto_final["amount_total"],
        "n_lineas": len(lineas_creadas),
        "lineas": lineas_creadas,
    }
    
    if lineas_error:
        resultado["advertencias"] = lineas_error
    
    return json.dumps(resultado, ensure_ascii=False)


# ─── registro de herramientas ─────────────────────────────────────────────────

#: Lista ordenada de funciones — usada como `tools=` en Gemini y en MCP
ALL_TOOLS: list = [
    odoo_presupuestos,
    odoo_lineas_presupuesto,
    odoo_facturas,
    odoo_compras,
    odoo_lineas_compra,
    odoo_mismatch,
    odoo_contraste,    odoo_crear_presupuesto,]

#: Mapa nombre → función para ejecutar por nombre (function calling manual)
TOOLS_MAP: dict = {f.__name__: f for f in ALL_TOOLS}
