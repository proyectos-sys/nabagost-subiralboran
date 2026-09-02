import { jsonError, normalizeError } from "@/lib/api";
import { listAttendanceEmployees } from "@/lib/attendance-service";
import { logRouteError } from "@/lib/server-log";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const employees = await listAttendanceEmployees();
    return Response.json({ employees });
  } catch (error) {
    logRouteError("GET /api/attendance/employees", error);
    return jsonError(normalizeError(error), 500);
  }
}
