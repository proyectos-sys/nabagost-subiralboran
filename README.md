# Tablet Navagost: fichaje y partes

Aplicacion web para fichar entradas/salidas y registrar partes de horas de empleados en Odoo 19 desde una tablet compartida.

## Requisitos

- Node.js 22
- npm
- Odoo 19 con API JSON-2 activa
- Una clave API de Odoo con permisos sobre `project.task`, `hr.employee`, `hr.attendance`, `project.project` y `account.analytic.line`

## Instalacion

```bash
npm install
cp .env.example .env
npm run dev
```

Abre `http://localhost:3000` en la tablet o en el navegador.

Despues del PIN aparece un menu con:

- `FICHAJE`: entradas y salidas de empleados usando `hr.attendance`.
- `PARTES DE TRABAJO`: registro de horas reales contra tareas usando `account.analytic.line`.

## Variables de entorno

Completa estas variables en `.env`:

```env
ODOO_URL=https://navagost.odoo.com
ODOO_DATABASE=navagost
ODOO_API_KEY=TU_CLAVE_API_DE_ODOO
ODOO_PROJECT_NAME=Taller y Faenas Navagost
APP_ACCESS_PIN=PIN_PARA_LA_TABLET
APP_TIMEZONE=Europe/Madrid
APP_COOKIE_SECURE=false
MOCK_ODOO=false
```

`ODOO_API_KEY` nunca se envia al navegador. Todas las llamadas a Odoo salen desde las API Routes del servidor.

Usa `APP_COOKIE_SECURE=true` si publicas la app solo por HTTPS. Para pruebas locales por `http://localhost:3000`, mantenlo en `false`.

## Modo prueba

Para probar sin conectar con Odoo:

```env
MOCK_ODOO=true
APP_ACCESS_PIN=1234
```

Despues ejecuta:

```bash
npm run dev
```

Entra con el PIN `1234` y registra horas contra los datos simulados.

## Comprobar conexion con Odoo

Con `MOCK_ODOO=false` y las variables reales configuradas:

```bash
npm run dev
```

Visita:

```text
http://localhost:3000/api/health
```

Si todo esta bien, devuelve `ok: true`, el modo `odoo`, el proyecto configurado y el numero de tareas y empleados leidos.

## Fichaje sin conexion

La tablet normalmente abre la aplicacion publicada en Vercel. Si en el momento de fichar no puede llegar a Vercel o Vercel no puede llegar a Odoo, el fichaje se guarda en IndexedDB dentro de la propia tablet.

Cuando vuelve la conexion, la app intenta sincronizar los fichajes pendientes con Odoo automaticamente. Tambien aparece el boton `Pendientes` para forzar el reintento manualmente.

Importante: IndexedDB esta en el navegador de esa tablet. No borres los datos del navegador ni cambies de dispositivo antes de sincronizar los fichajes pendientes.

## Endpoints internos

Fichaje:

- `GET /api/attendance/employees`
- `GET /api/attendance/status?employeeId=ID`
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`

Partes:

- `GET /api/tasks`
- `GET /api/employees`
- `POST /api/timesheets`

## Scripts

```bash
npm run lint
npm run test
npm run build
```

## Docker

```bash
docker build -t navagost-partes .
docker run --env-file .env -p 3000:3000 navagost-partes
```

## Seguridad

- La sesion se guarda en una cookie `HttpOnly`.
- El PIN se valida en el servidor.
- La clave API de Odoo solo vive en variables de entorno del servidor.
- La fecha del parte se genera en servidor con `APP_TIMEZONE`.
- El backend valida empleado activo, proyecto de la tarea, duracion e idempotencia del envio.
- El fichaje evita doble entrada, salida sin entrada y doble pulsacion.
