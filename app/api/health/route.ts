import { assertRuntimeConfig } from "@/lib/env";
import { getOdooDiagnostics } from "@/lib/odoo-service";
import { logRouteError } from "@/lib/server-log";

export const runtime = "nodejs";

export async function GET() {
  const { env, missing, ready } = assertRuntimeConfig();

  if (!ready) {
    return Response.json(
      {
        ok: false,
        mode: env.MOCK_ODOO ? "mock" : "odoo",
        missing,
      },
      { status: 500 },
    );
  }

  try {
    const diagnostics = await getOdooDiagnostics();
    return Response.json({
      ok: true,
      mode: env.MOCK_ODOO ? "mock" : "odoo",
      project: env.ODOO_PROJECT_NAME,
      diagnostics,
    });
  } catch (error) {
    logRouteError("GET /api/health", error);
    return Response.json(
      {
        ok: false,
        mode: env.MOCK_ODOO ? "mock" : "odoo",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
