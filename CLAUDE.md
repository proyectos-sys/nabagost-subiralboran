# Instrucciones para Claude Code — Conciliación de gastos (facturas vs banco)

> Este archivo es solo para la tarea "conciliar facturas de gasto contra el extracto bancario"
> (solo lectura, no toca Odoo). Para la tarea de subir facturas/tickets de proveedor a Odoo
> (`src/purchase-image/`, sí escribe en Odoo), ver `AGENTS.md` en la raíz del repo — ese archivo
> ya existía y contiene las reglas de búsqueda/creación de proveedores y productos.


## Cuándo usar esto

Cuando el usuario pida revisar/comprobar/cuadrar los gastos de un periodo, o pregunte cosas
como "qué facturas faltan", "qué gastos del banco no tienen factura", "compárame las
diferencias entre las facturas y el extracto", etc.

## Carpetas de trabajo

- **Facturas de gasto** (PDF e imágenes de facturas/tickets/albaranes, sin organizar, con
  duplicados frecuentes):
  `C:\Users\david\Escritorio\NAVAGOST\navagost-agente-main\iamgenesfacutragastos`
- **Extracto(s) bancario(s)** (PDF, CSV, XLS o XLSX; puede haber más de un archivo o más de una
  cuenta):
  `C:\Users\david\Escritorio\NAVAGOST\navagost-agente-main\extractosbancarios`

El usuario rellena estas dos carpetas a mano antes de pedir la revisión (las vacía y las vuelve
a llenar cada trimestre/periodo). No asumas que están vacías ni que tienen un número fijo de
archivos: compruébalo siempre al empezar.

No hace falta Odoo ni GEMINI_API_KEY para esto — es una conciliación local leyendo los archivos
directamente con tus propias herramientas de lectura (los PDF e imágenes los lees de forma
nativa).

## Proceso a seguir

1. Lista los archivos de ambas carpetas primero, para saber con cuántos archivos se trabaja.

2. **Facturas**: si hay más de ~20 archivos, NO los leas todos tú mismo uno a uno — repártelos
   en lotes de 15-20 archivos y lanza un subagente (Task tool) por lote, EN PARALELO (todas las
   llamadas Task en el mismo mensaje/turno, no una detrás de otra). Cada subagente debe:
   - Leer cada archivo de su lote con la herramienta de lectura de archivos (funciona
     directamente con PDF e imágenes).
   - Extraer por factura: fecha, proveedor/emisor (nunca el cliente, que es NAVAGOST/NOVAGOST
     PARTNERS SL), concepto breve, base imponible, IVA, total, número de factura.
   - Marcar como NO LEGIBLE si un archivo no se puede leer bien, sin inventar datos.
   - Devolver los resultados en una tabla de texto plano.

   Si hay 20 archivos o menos, léelos tú mismo directamente sin subagentes — no compensa el
   overhead de repartir tan pocos.

3. Une los resultados de todos los lotes. Detecta y marca duplicados: mismo proveedor + mismo
   importe total + misma fecha (o mismo número de factura) = duplicado, cuenta solo una vez en
   los totales.

4. **Extracto bancario**: lee cada archivo de la carpeta de extractos. Si es PDF, léelo
   directamente. Si es CSV/XLS/XLSX y no lo puedes abrir en binario, pide al usuario que lo
   exporte como CSV o que suba también la versión en PDF — no intentes adivinar el contenido de
   un binario que no puedes leer. Extrae todos los movimientos: fecha, concepto, importe
   (negativo = cargo/gasto, positivo = ingreso).

5. **Cruce**: para cada cargo (importe negativo) del banco, busca una factura con el mismo
   importe total (tolerancia ±0,05 €). Si hay varias facturas candidatas con el mismo importe,
   prioriza la que tenga el nombre del proveedor dentro del concepto del banco. Clasifica en:
   - Gastos del banco con factura encontrada (cuadrado, ok).
   - **Gastos del banco SIN factura** → esto es lo más importante para el usuario, siempre
     destácalo primero.
   - Facturas sin pago identificado en el banco (puede ser normal si están dentro de una remesa
     agrupada a proveedores, o si el pago aún no se ha hecho).

6. Presenta el resultado en el chat de forma concisa: lista de gastos del banco sin factura con
   fecha/concepto/importe y el total. No hace falta un informe larguísimo salvo que el usuario
   lo pida explícitamente. Si pide guardar un informe, escribe un `.md` o `.csv` con el detalle
   completo (por ejemplo en una carpeta `output/` o donde te indique).

## Notas aprendidas de la revisión del Q2 2026 (abril-junio)

- Los gastos suelen llegar duplicados: la misma factura guardada dos o tres veces con nombres de
  archivo tipo `FACTURA.pdf`, `FACTURA(1).pdf`, `(2)`, o con nombre de archivo distinto pero
  mismo contenido (foto y escaneo del mismo ticket, por ejemplo). Compara siempre por
  proveedor+importe+fecha, nunca por nombre de archivo.
- Puede haber facturas con fecha de un trimestre pero pagadas en el banco durante el trimestre
  siguiente, o al revés (facturas de marzo pagadas en abril/mayo). No las descartes solo por la
  fecha de la factura — cuadra por el pago real y avisa de la diferencia de fechas en vez de
  ocultarla.
- Algunos pagos del banco son remesas agrupadas a varios proveedores en un único movimiento
  (concepto tipo "REMESA TRANSFERENCIAS..."). Esas no se pueden cuadrar 1:1 contra una factura
  concreta — indícalo como "pago agrupado, revisar aparte" en vez de forzar un cruce dudoso.
- Alquileres y seguros suelen ser recibos domiciliados recurrentes sin "factura" tradicional en
  PDF adjunto — puede ser normal que no tengan documento, coméntalo pero no lo trates igual que
  una compra a proveedor sin justificar.
- Cuando dos facturas distintas (mismo importe, misma fecha, proveedor con nombre parecido)
  podrían ser el mismo gasto fotografiado dos veces, el extracto bancario es el desempate: si
  solo hay UN cargo por ese importe en esa fecha, son duplicado; si hay dos cargos, son gastos
  reales distintos.

## Alternativa con script (opcional)

También existe `scripts/conciliacion_gastos.py`, que hace lo mismo de forma automatizada usando
la API de Gemini (`GEMINI_API_KEY` en `.env`) en vez de tu lectura nativa, útil si se quiere
ejecutar sin ti (cron, CI, etc.). Para el uso normal de "pregúntale a Claude" no hace falta:
sigue el proceso de arriba directamente.
