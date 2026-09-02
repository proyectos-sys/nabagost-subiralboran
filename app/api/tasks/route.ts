import { jsonError, normalizeError } from "@/lib/api";
import { listTasks } from "@/lib/odoo-service";
import { logRouteError } from "@/lib/server-log";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const tasks = await listTasks();
    return Response.json({ tasks });
  } catch (error) {
    logRouteError("GET /api/tasks", error);
    return jsonError(normalizeError(error), 500);
  }
}
