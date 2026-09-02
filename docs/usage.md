# Uso y configuración

Coloca un archivo `.env` en la raíz con estas variables mínimas:

- `ODOO_HOST` — host de Odoo (ej. localhost)
- `ODOO_PORT` — puerto XML-RPC (ej. 8069)
- `ODOO_DB` — nombre de la base de datos
- `ODOO_USER` — usuario admin (ej. admin)
- `ODOO_PASSWORD` — contraseña del usuario
- `PG_USER`, `PG_PASSWORD`, `PG_HOST`, `PG_PORT`, `PG_DATABASE` — para backups con `pg_dump`
- `OPENAI_API_KEY` — (opcional) para ejemplos IA

Ejemplos de comandos:

Crear entorno e instalar deps:

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Hacer backup:

```bash
.venv\Scripts\python scripts\backup.py --out backups/db_2026-05-23.sql
```

Restaurar backup:

```bash
.venv\Scripts\python scripts\restore.py --file backups/db_2026-05-23.sql
```

Despliegue de módulo (esqueleto):

```bash
.venv\Scripts\python scripts\deploy_module.py --module my_module --path /ruta/al/module
```

Lee los scripts en `scripts/` para más detalles y parámetros.

## Conciliación de gastos (facturas vs banco)

Cruza todas las facturas de gasto (PDF/imagen) de una carpeta contra el extracto bancario
(PDF/CSV/XLS/XLSX) de otra carpeta y genera un informe en Markdown con lo que falta por
imputar. No escribe nada en Odoo. Necesita `GEMINI_API_KEY` en `.env` para leer PDFs/imágenes.

```bash
.venv\Scripts\python scripts\conciliacion_gastos.py --facturas "C:\ruta\facturas" --banco "C:\ruta\extracto" --out output\conciliacion_gastos.md
```

El informe indica: facturas duplicadas, gastos del banco sin factura, facturas sin pago
identificado, cruces ambiguos a revisar a mano, y los gastos ya cuadrados.
