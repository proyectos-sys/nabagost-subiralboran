"""
mcp_server.py  –  Servidor MCP de Navagost / Odoo
===================================================
Expone las herramientas de chatbot/odoo_tools.py como tools MCP
para que Copilot Chat pueda invocarlas directamente.

Herramientas disponibles:
  • odoo_presupuestos         – Presupuestos de venta (sale.order)
  • odoo_lineas_presupuesto   – Detalle de líneas de presupuesto
  • odoo_facturas             – Facturas (account.move out_invoice)
  • odoo_compras              – Órdenes de compra (purchase.order)
  • odoo_lineas_compra        – Detalle de líneas de compra
  • odoo_mismatch             – Presupuestos sin factura (cruce cliente+importe)
  • odoo_contraste            – Tasa de conversión presupuesto → factura
  • odoo_crear_presupuesto    – Crear presupuesto draft con líneas [ESCRITURA]

Arranque:  python3.11 mcp_server.py
"""

from mcp.server.fastmcp import FastMCP
from chatbot.odoo_tools import (
    odoo_presupuestos       as _presupuestos,
    odoo_lineas_presupuesto as _lineas_venta,
    odoo_facturas           as _facturas,
    odoo_compras            as _compras,
    odoo_lineas_compra      as _lineas_compra,
    odoo_mismatch           as _mismatch,
    odoo_contraste          as _contraste,
    odoo_crear_presupuesto  as _crear_presupuesto,
)

mcp = FastMCP("navagost-odoo")


# ─── wrappers MCP ─────────────────────────────────────────────────────────────
# Las funciones reales viven en chatbot/odoo_tools.py.
# Aquí solo añadimos el decorador @mcp.tool() para exponerlas a Copilot.

@mcp.tool()
def odoo_presupuestos(cliente: str = "") -> str:
    """
    Devuelve los presupuestos / pedidos de venta de Odoo (sale.order).
    Parámetro opcional: cliente (filtro parcial por nombre, p.ej. 'ATYCO').
    Incluye: número, cliente, fecha, total, estado, estado de facturación.
    """
    return _presupuestos(cliente=cliente)


@mcp.tool()
def odoo_lineas_presupuesto(numero: str) -> str:
    """
    Devuelve las líneas de detalle de un presupuesto concreto.
    Parámetro requerido: numero (p.ej. 'S00034').
    Incluye: producto, descripción, cantidad, precio unitario, subtotal.
    """
    return _lineas_venta(numero=numero)


@mcp.tool()
def odoo_lineas_compra(numero: str) -> str:
    """
    Devuelve las líneas de detalle de una orden de compra concreta.
    Parámetro requerido: numero (p.ej. 'P00012').
    Incluye: producto, descripción, cantidad, precio unitario, subtotal.
    """
    return _lineas_compra(numero=numero)


@mcp.tool()
def odoo_crear_presupuesto(cliente: str, lineas: list, nota: str = "") -> str:
    """
    Crea un presupuesto draft en Odoo (sale.order).
    
    Parámetros:
      - cliente: Nombre del cliente (busca por coincidencia parcial)
      - lineas: Lista de diccionarios con:
          * producto: nombre del producto (busca por coincidencia)
          * cantidad: cantidad a presupuestar
          * precio: precio unitario (opcional, usa precio de lista si no se indica)
      - nota: Nota interna opcional para el presupuesto
    
    Ejemplo:
        odoo_crear_presupuesto(
            cliente="ATYCO",
            lineas=[
                {"producto": "LASER", "cantidad": 1, "precio": 5800},
                {"producto": "Soldadura", "cantidad": 160, "precio": 42}
            ],
            nota="Presupuesto para proyecto X"
        )
    
    Devuelve JSON con el número del presupuesto creado y detalles.
    """
    return _crear_presupuesto(cliente=cliente, lineas=lineas, nota=nota)


@mcp.tool()
def odoo_facturas(cliente: str = "", estado: str = "") -> str:
    """
    Devuelve las facturas de venta de Odoo (account.move, tipo out_invoice).
    Parámetros opcionales:
      - cliente: filtro parcial por nombre de cliente
      - estado: 'draft' (borrador), 'posted' (confirmada), 'cancel'
    Incluye: número, cliente, fecha, total, estado.
    """
    return _facturas(cliente=cliente, estado=estado)


@mcp.tool()
def odoo_compras(proveedor: str = "") -> str:
    """
    Devuelve las órdenes de compra de Odoo (purchase.order).
    Parámetro opcional: proveedor (filtro parcial por nombre).
    Incluye: número, proveedor, fecha, total, estado.
    """
    return _compras(proveedor=proveedor)


@mcp.tool()
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
    return _mismatch(cliente=cliente, solo_confirmados=solo_confirmados,
                     tolerancia_eur=tolerancia_eur)


@mcp.tool()
def odoo_contraste(cliente: str = "") -> str:
    """
    Calcula la tasa de conversión de presupuestos a facturas usando el enlace
    nativo de Odoo (campo invoice_ids en sale.order).

    Devuelve:
      - Resumen: total presupuestos, confirmados, facturados, sin facturar, tasa de conversión
      - Detalle por pedido: número, cliente, importe, estado, facturas vinculadas

    Parámetro opcional: cliente (filtro parcial por nombre).
    """
    return _contraste(cliente=cliente)


if __name__ == "__main__":
    mcp.run(transport="stdio")
