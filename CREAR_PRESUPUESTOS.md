# Crear Presupuestos en Odoo

## 📋 Resumen

Se ha implementado la funcionalidad de **crear presupuestos draft** en Odoo desde dos interfaces:

1. **Script CLI interactivo** (`crear_presupuesto_cli.py`) → uso local/manual
2. **Función para el chatbot** (`odoo_crear_presupuesto`) → uso desde IA

Ambas validan cliente y productos, mostrando sugerencias cuando hay múltiples coincidencias.

---

## 1. Script CLI Interactivo

### Uso

```bash
python3.11 crear_presupuesto_cli.py
```

### Flujo

El script guía paso a paso:

1. **Buscar cliente**
   - Introduce nombre parcial (ej: "ATYCO")
   - Si hay 1 coincidencia → confirma
   - Si hay múltiples → muestra lista numerada para elegir
   - Si no encuentra nada → pide intentar con menos caracteres

2. **Añadir productos** (uno por uno)
   - Introduce nombre parcial del producto
   - Si hay 1 coincidencia → confirma
   - Si hay múltiples → muestra lista con precios para elegir
   - Introduce cantidad (enter = 1.0)
   - Introduce precio (enter = usar precio de lista)
   - Repite hasta escribir `fin`
   - Escribe `mostrar` para ver resumen acumulado

3. **Nota opcional**
   - Añade nota interna al presupuesto (opcional)

4. **Resumen y confirmación**
   - Muestra resumen completo con total
   - Confirma con `s` para crear o `n` para cancelar

5. **Creación en Odoo**
   - Crea presupuesto draft
   - Añade todas las líneas
   - Muestra número de presupuesto generado
   - Muestra enlace directo para abrir en Odoo

### Ejemplo de sesión

```
╔═══════════════════════════════════════════════════════════════════╗
║  Script CLI: Crear Presupuesto Draft en Odoo                     ║
╚═══════════════════════════════════════════════════════════════════╝

PASO 1: Buscar cliente
──────────────────────────────────────────────────────────────────────

📝 Nombre del cliente: ATYCO

🔍 Buscando clientes que coincidan con: 'ATYCO'...

✅ Se encontraron 2 clientes:
   1. ATYCO
   2. ATYCO CONSTRUCCION SL
   0. Cancelar

👉 Selecciona un número: 2

✅ Cliente seleccionado: ATYCO CONSTRUCCION SL (ID 33)

PASO 2: Añadir productos al presupuesto
──────────────────────────────────────────────────────────────────────

📦 Producto #1

📝 Nombre del producto: LASER

🔍 Buscando productos que coincidan con: 'LASER'...
✅ Producto encontrado: LASER (0.00 €)
   ¿Es correcto? (s/n): s

📊 Cantidad (enter para 1): 2

💰 Precio unitario (enter para usar 0.00 €): 5800

✅ Línea añadida: 2.0 x LASER = 11600.00 €

📦 Producto #2

📝 Nombre del producto: Soldadura

🔍 Buscando productos que coincidan con: 'Soldadura'...
✅ Producto encontrado: Soldadura/Montaje (42.00 €)
   ¿Es correcto? (s/n): s

📊 Cantidad (enter para 1): 100

💰 Precio unitario (enter para usar 42.00 €): 

✅ Línea añadida: 100.0 x Soldadura/Montaje = 4200.00 €

📦 Producto #3

📝 Nombre del producto: fin

PASO 3: Nota interna (opcional)
──────────────────────────────────────────────────────────────────────

📝 Nota para el presupuesto: Proyecto ampliación nave industrial

╔═══════════════════════════════════════════════════════════════════╗
║  RESUMEN DEL PRESUPUESTO                                          ║
╚═══════════════════════════════════════════════════════════════════╝

📌 Cliente: ATYCO CONSTRUCCION SL
📅 Fecha:   27/05/2026
📝 Nota:    Proyecto ampliación nave industrial

📦 Productos (2 líneas):
──────────────────────────────────────────────────────────────────────
  1. LASER
     2.0 x 5800.00 € = 11600.00 €
  2. Soldadura/Montaje
     100.0 x 42.00 € = 4200.00 €
──────────────────────────────────────────────────────────────────────
💰 TOTAL: 15,800.00 €

✅ ¿Crear este presupuesto en Odoo? (s/n): s

⏳ Creando presupuesto en Odoo...
✅ Presupuesto creado (ID 89)
⏳ Añadiendo 2 líneas...
   ✅ Línea 1/2
   ✅ Línea 2/2

╔═══════════════════════════════════════════════════════════════════╗
║  ✅ PRESUPUESTO CREADO EXITOSAMENTE                               ║
╚═══════════════════════════════════════════════════════════════════╝

📋 Número:  S00052
💰 Total:   15,800.00 €

🔗 Ver en Odoo:
   https://navagost.odoo.com/web#id=89&model=sale.order&view_type=form

🎉 ¡Listo!
```

---

## 2. Función para Chatbot / API

### Uso desde Python

```python
from chatbot.odoo_tools import odoo_crear_presupuesto
import json

result = odoo_crear_presupuesto(
    cliente="ATYCO CONSTRUCCION SL",
    lineas=[
        {"producto": "LASER", "cantidad": 2, "precio": 5800},
        {"producto": "Soldadura", "cantidad": 100}  # sin precio → usa precio lista
    ],
    nota="Proyecto ampliación nave industrial"
)

print(json.dumps(json.loads(result), indent=2))
```

### Respuestas posibles

#### ✅ Éxito (presupuesto creado)

```json
{
  "success": true,
  "presupuesto": "S00052",
  "id": 89,
  "cliente": "ATYCO CONSTRUCCION SL",
  "estado": "draft",
  "total_eur": 15800.0,
  "n_lineas": 2,
  "lineas": [
    {
      "producto": "LASER",
      "cantidad": 2.0,
      "precio_unit": 5800.0,
      "subtotal": 11600.0
    },
    {
      "producto": "Soldadura/Montaje",
      "cantidad": 100.0,
      "precio_unit": 42.0,
      "subtotal": 4200.0
    }
  ]
}
```

#### ⚠️ Cliente ambiguo (múltiples coincidencias)

```json
{
  "error": "Se encontraron 2 clientes que coinciden con 'ATY'",
  "accion_requerida": "Debes especificar exactamente cuál cliente quieres usar",
  "sugerencias_clientes": [
    {
      "id": 56,
      "nombre": "ATYCO"
    },
    {
      "id": 33,
      "nombre": "ATYCO CONSTRUCCION SL"
    }
  ]
}
```

El LLM puede mostrar estas opciones al usuario y pedirle que elija.

#### ⚠️ Producto ambiguo (múltiples coincidencias)

```json
{
  "error": "Línea 1: Se encontraron 5 productos que coinciden con 'TUB'",
  "accion_requerida": "Debes especificar exactamente qué producto quieres en la línea",
  "linea_numero": 1,
  "producto_buscado": "TUB",
  "sugerencias_productos": [
    {
      "id": 159,
      "nombre": "FABRICAR SOPORTE TUBULAR ACERO INOXIDABLE",
      "precio": 1.0
    },
    {
      "id": 8,
      "nombre": "TUBO 100 X 100 X 2",
      "precio": 1.0
    },
    {
      "id": 84,
      "nombre": "TUBO 100 X 20 X 2",
      "precio": 0.0
    }
  ]
}
```

#### ❌ Cliente no encontrado

```json
{
  "error": "No se encontró el cliente 'CLIENTEFALSO'. Verifica el nombre e intenta con menos caracteres."
}
```

#### ⚠️ Presupuesto creado pero con advertencias

```json
{
  "success": true,
  "presupuesto": "S00053",
  "id": 90,
  "cliente": "ATYCO",
  "estado": "draft",
  "total_eur": 11600.0,
  "n_lineas": 1,
  "lineas": [
    {
      "producto": "LASER",
      "cantidad": 2.0,
      "precio_unit": 5800.0,
      "subtotal": 11600.0
    }
  ],
  "advertencias": [
    "Línea 2: producto 'PRODUCTOFALSO' no encontrado"
  ]
}
```

---

## 3. Uso desde el Chatbot

El LLM tiene acceso a `odoo_crear_presupuesto` automáticamente.

### Ejemplos de conversación

**Usuario:**
> Crea un presupuesto para BECSA con 10 LASER a 5800€ y 50 horas de soldadura a 42€

**Bot:**
```
🔧 odoo_crear_presupuesto(cliente="BECSA", lineas=[...])

✅ Presupuesto S00054 creado para BECSA SOCIEDAD ANONIMA
   - 10x LASER = 58.000,00 €
   - 50x Soldadura/Montaje = 2.100,00 €
   
💰 Total: 60.100,00 €

🔗 Ver en Odoo: https://navagost.odoo.com/web#id=91&model=sale.order&view_type=form
```

**Usuario:**
> Crea presupuesto para ATY con 5 tubos

**Bot:**
```
🔧 odoo_crear_presupuesto(cliente="ATY", ...)

⚠️ Encontré 2 clientes con "ATY":
   1. ATYCO
   2. ATYCO CONSTRUCCION SL

¿Cuál quieres usar?
```

**Usuario:**  
> El segundo

**Bot:**
```
🔧 odoo_crear_presupuesto(cliente="ATYCO CONSTRUCCION SL", lineas=[{"producto":"tubos",...}])

⚠️ Encontré 5 productos que coinciden con "tubos":
   1. TUBO 100 X 100 X 2 (1.00 €)
   2. TUBO 100 X 20 X 2 (0.00 €)
   3. TUBO DIAMETRO 120 X 2 (12.90 €)
   4. TUBO DIAMETRO 200 X 3 (24.00 €)
   5. FABRICAR SOPORTE TUBULAR ACERO INOXIDABLE (1.00 €)

¿Cuál necesitas?
```

---

## 4. Presupuestos creados en pruebas

Durante el desarrollo se crearon los siguientes presupuestos de prueba:

| Número | Cliente | Total | Líneas | Creado con |
|--------|---------|-------|--------|------------|
| S00040 | ANA MARIA TENA CAÑIZAL | 8,47 € | 2 | test_create_presupuesto.py |
| S00041 | ATYCO | 2.571,25 € | 2 | odoo_crear_presupuesto (Python) |
| S00042-S00050 | Varios | - | - | Pruebas de validación |
| S00051 | ATYCO CONSTRUCCION SL | 0,00 € | 0 | Prueba error producto no encontrado |

Todos están en estado `draft` y se pueden eliminar desde Odoo si es necesario.

---

## 5. Validaciones Implementadas

### En ambas interfaces (CLI y función)

✅ **Cliente:**
- Si no se encuentra → error claro
- Si se encuentra 1 coincidencia exacta → confirma (CLI) / usa directamente (función)
- Si se encuentran múltiples → muestra lista (CLI) / retorna sugerencias (función)

✅ **Productos:**
- Si no se encuentra → advertencia (se crea presupuesto sin esa línea)
- Si se encuentra 1 coincidencia exacta → confirma (CLI) / usa directamente (función)
- Si se encuentran múltiples → muestra lista (CLI) / retorna sugerencias (función)

✅ **Precio:**
- Si se indica → usa el indicado
- Si no se indica → usa precio de lista de Odoo

✅ **Cantidad:**
- Debe ser > 0
- Acepta decimales (ej: 2.5)

---

## 6. Archivos Modificados/Creados

### Nuevos archivos

- `crear_presupuesto_cli.py` → Script interactivo CLI
- `CREAR_PRESUPUESTOS.md` → Esta documentación
- `test_create_presupuesto.py` → Script de prueba automatizado

### Archivos modificados

- `chatbot/odoo_tools.py`:
  - `_search_read`: añadido parámetro `limit`
  - `_create`: nueva función helper para crear registros
  - `_buscar_cliente`: retorna sugerencias si hay múltiples
  - `_buscar_producto`: retorna sugerencias si hay múltiples
  - `odoo_crear_presupuesto`: nueva función pública (tool #8)
  
- `chatbot/prompts.py`:
  - Actualizado SYSTEM_PROMPT con 8 herramientas (7 lectura + 1 escritura)
  - Documentación de formato de `lineas` para crear presupuestos
  - Ejemplos de uso
  
- `mcp_server.py`:
  - Añadido wrapper `@mcp.tool()` para `odoo_crear_presupuesto`
  
- `chatbot/templates/index.html`:
  - Footer: "Solo lectura" → "Lectura/Escritura"

---

## 7. Próximos Pasos Recomendados

### Mejoras inmediatas

1. **Añadir más validaciones**
   - Verificar que cantidad * precio no supere un límite (ej: 100.000 € por línea)
   - Validar que el cliente tenga datos completos (dirección, CIF, etc.)

2. **Enviar presupuesto por email**
   - Función `odoo_enviar_presupuesto(numero)` que llame al action_quotation_send de Odoo
   
3. **Confirmar presupuesto (draft → sale)**
   - Función `odoo_confirmar_presupuesto(numero)` con confirmación obligatoria

### Mejoras futuras

4. **Crear factura desde presupuesto**
   - `odoo_facturar_presupuesto(numero)`

5. **Duplicar presupuesto existente**
   - `odoo_duplicar_presupuesto(numero, nuevo_cliente)`

6. **Dashboard de presupuestos**
   - Script CLI que muestre estadísticas de presupuestos creados por el chatbot

---

## 8. Troubleshooting

### Error: "No se encontró el cliente"

- Intenta con menos caracteres (ej: "BEC" en lugar de "BECSA SOCIEDAD")
- Verifica que el cliente existe en Odoo y tiene `customer_rank > 0`

### Error: "Producto no encontrado"

- Intenta con menos caracteres o parte del nombre
- Verifica que el producto existe en Odoo y tiene `sale_ok = True`

### Presupuesto creado con total 0€

- Revisa las advertencias en la respuesta
- Puede que algún producto no se haya encontrado o tenga precio 0 en Odoo

### Script CLI no arranca

```bash
# Verifica que tienes el .env configurado
python3.11 -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('ODOO_URL'))"

# Si devuelve None, copia .env.example a .env y configura
```

---

**Fin de la documentación** 🎉
