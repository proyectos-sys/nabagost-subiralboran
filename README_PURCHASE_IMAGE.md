# Compras desde imagen para Odoo 19

Script y MCP server para crear Solicitudes de Presupuesto / Pedidos de compra en borrador desde una imagen de ticket, factura, presupuesto o albaran.

## Configuracion

Completa `.env` con:

```env
ODOO_URL=https://navagost.odoo.com
ODOO_DATABASE=navagost
ODOO_API_KEY=
OCR_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=
DEFAULT_PURCHASE_LOCATION=NAVAGOST: Recepciones
DEFAULT_VENDOR_ID=
FALLBACK_PRODUCT_ID=
SALE_MARKUP_PERCENT=40
ADD_COST_TO_SALE_ORDER=true
```

`ODOO_API_KEY`, `GEMINI_API_KEY` y `OPENAI_API_KEY` solo se usan en servidor/CLI. No se imprimen en logs.

Por defecto se usa Gemini (`OCR_PROVIDER=gemini`). Puedes cambiar a OpenAI con `OCR_PROVIDER=openai`.

## Uso CLI

```bash
npm install
npm run purchase:image -- ./ticket.jpg
```

El CLI:

1. Lee la imagen con IA/OCR.
2. Muestra un resumen de proveedor, fecha, lineas, productos encontrados y avisos.
3. Pide confirmacion.
4. Si escribes `SI`, crea una compra en borrador en Odoo.
5. Adjunta la imagen al pedido.

Nunca confirma automaticamente el pedido.

## Uso MCP

Arranca el servidor MCP por stdio:

```bash
npm run purchase:mcp
```

Herramientas disponibles:

- `analyze_purchase_image`
- `get_purchase_preview`
- `create_purchase_from_image`

`create_purchase_from_image` devuelve primero un objeto con `needs_confirmation: true` salvo que se llame con:

```json
{
  "imagePath": "./ticket.jpg",
  "confirmed": true
}
```

## Reglas

- Antes de crear cualquier producto, se buscan coincidencias existentes por nombre, familia, medidas y similitud. La reutilizacion tiene prioridad sobre el alta.
- Para tapones se busca primero la familia `TAPON`; para tubos, `TUBO` mas sus medidas; para laser, `LASER`, `CORTE` y `DESARROLLO`.
- Un producto existente no necesita tener exactamente el mismo texto: si familia, tipo y medidas encajan, se reutiliza.
- No crea proveedores nuevos.
- No crea productos nuevos.
- Si no encuentra proveedor usa `DEFAULT_VENDOR_ID`, si existe.
- Para productos normales, primero busca por referencia exacta y despues por descripcion simplificada.
- Al crear un producto nuevo desde una factura, el nombre debe salir de la descripcion reutilizable del producto. No se guarda la referencia/codigo del proveedor como nombre ni como codigo interno del producto.
- Para materiales parametricos de taller (`TUBO`, `PERFIL`, `CHAPA`, `PLETINA`, etc.) la referencia del proveedor no debe crear productos nuevos. Se extrae un producto generico por medida, por ejemplo `TUBO 40x20x2 L1125 A.C.` -> `TUBO 40 X 20 X 2`.
- Si el producto generico por medida no existe, se crea con nombre reutilizable, sin largo ni referencia de albaran. La descripcion original queda en la linea de compra.
- `DUDA` queda solo para casos sin medida clara o coincidencia realmente ambigua.
- No confirma pedidos automaticamente.
- Consulta `fields_get` antes de usar campos relevantes.
- Si el total extraido no cuadra con lineas, avisa antes de crear.
- No crea cuentas analiticas nuevas.
- Si el albaran trae una anotacion a mano de faena/cliente (ref tipo `S55` o nombre), se busca la cuenta analitica existente (`account.analytic.account`) por codigo normalizado o por nombre; si hay ref por linea, gana sobre la ref de todo el documento.
- Si no hay coincidencia clara, la linea se crea sin cuenta analitica y queda un aviso para revision manual.

## Linea en el presupuesto (coste + margen)

Ademas de imputar el coste a la cuenta analitica, si la faena manuscrita es un codigo de presupuesto (`S55` -> `S00055`, o una cuenta analitica cuyo nombre empieza por ese codigo) se anade una linea al `sale.order` correspondiente:

- Descripcion: `[IA] <descripcion del albaran> (albaran <ref> · <proveedor>)`. La marca `[IA]` indica que se metio automaticamente y hay que revisarla.
- Precio de venta = coste unitario sin IVA + `SALE_MARKUP_PERCENT` (por defecto 40%). El coste real se guarda en `purchase_price` (si el campo existe) para que el margen del presupuesto salga solo.
- La linea va sin producto, al final del presupuesto, con el IVA de venta que coincida con el de la linea.
- Solo se anade si el presupuesto esta en `draft`, `sent` o `sale`. Si esta bloqueado/cancelado, no existe o hay varios candidatos, la compra se crea igual y queda un aviso.
- No se anade si el presupuesto ya tiene alguna linea de `Soldadura`, `Horas Oficial`, `Horas Peon` u `Horas Pintura` (se comparan por el principio del nombre del producto o de la linea): lo mas probable es que alguien lo rellenara a mano y el material ya este puesto, asi que se duplicaria. La compra se crea igual, el coste se imputa a la analitica y el preview/`saleWarnings` avisa de por que no se anadio. Un presupuesto en blanco o solo con material si recibe la linea. Si no se pueden leer las lineas del presupuesto, tampoco se anade (se prefiere no duplicar).
- Si falla el presupuesto despues de crear la compra, la compra no se pierde: el error sale en `saleWarnings`.
- `ADD_COST_TO_SALE_ORDER=false` desactiva esta funcion.
- El preview (`saleLines`) muestra lo que se anadira antes de confirmar.
