# Reglas permanentes de importacion de compras

> Este archivo son las reglas de la tarea "subir facturas/tickets de proveedor a Odoo"
> (`src/purchase-image/`, escribe en Odoo). Para la tarea de conciliar gastos contra el
> extracto bancario (solo lectura, sin Odoo), ver `CLAUDE.md` en la raiz del repo.


- Navagost, Novagost y `B26849596` son siempre el comprador, nunca el proveedor.
- Antes de crear un producto, buscar siempre productos existentes por nombre, familia, medidas y similitud.
- La referencia o codigo del proveedor nunca debe usarse como nombre ni codigo interno de un producto nuevo.
- Reutilizar familias existentes aunque el texto no sea identico. Casos prioritarios:
  - Tapones: buscar primero `TAPON` y comparar tipo y medidas.
  - Tubos: buscar primero `TUBO` y comparar forma, material, medidas y espesor.
  - Laser: buscar `LASER`, `CORTE` y `DESARROLLO`; reutilizar el producto equivalente existente.
- Para proveedores de laser, clasificar cada linea como tubo, corte laser o desarrollo. Conservar el texto original del documento en la descripcion de la linea.
- Crear un producto solo cuando no exista una coincidencia razonable. El nombre nuevo debe ser generico y reutilizable.
- Usar `DUDA` unicamente cuando no se pueda identificar la familia ni una equivalencia razonable.
- Buscar y reutilizar siempre el proveedor existente por NIF o nombre antes de plantear un alta.
- Si en un documento aparece `HIERROS Y METALES CASTELLON S.L.` o Himecas, usar siempre el proveedor existente Himecas/HIERROS Y METALES CASTELLON S.L. de Odoo (`res.partner` id 88). No crear otro proveedor ni tratarlo como empresa distinta.
- Si en un documento aparece `LASERTAS` o `LA SERTAS` (nombre comercial en el membrete), el proveedor real es `PROINCER GLOBAL PROYECTS SL.` (`res.partner` id 32, NIF B12950895, confirmado por el CIF al pie del documento) — usar siempre ese proveedor existente, no crear ni buscar uno nuevo llamado Lasertas.
- Las compras se crean en borrador y la imagen original se adjunta al pedido.
- No crea cuentas analiticas nuevas.
- Si el albaran tiene una anotacion a mano (no impresa) indicando una faena/cliente (tipo `S55`, `s066` o un nombre), esa anotacion determina la cuenta analitica de la linea o del documento entero. La anotacion de una linea concreta tiene prioridad sobre la anotacion general del documento.
- Distinguir siempre texto impreso original de texto anadido a mano; solo el texto a mano se usa para la faena. No usar datos impresos (referencia de proveedor, codigo de producto, etc.) para inferir una faena.
- Si no se encuentra o es ambigua la cuenta analitica para una faena anotada, se deja la linea sin `analytic_distribution` y se avisa; nunca se adivina ni se crea una cuenta nueva.
- Si la faena anotada corresponde a un presupuesto (`S55` -> `S00055`), se anade tambien una linea a ese `sale.order` con descripcion que empieza por `[IA]` y precio de venta = coste + `SALE_MARKUP_PERCENT` (40% por defecto). Nunca se crean presupuestos nuevos ni se tocan lineas existentes; solo se anaden lineas al final, y solo en presupuestos en estado `draft`, `sent` o `sale`.
- Si el presupuesto no se encuentra, es ambiguo o no admite lineas, se crea igualmente la compra y se avisa.
