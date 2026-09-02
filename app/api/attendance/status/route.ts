import { jsonError, normalizeError } from "@/lib/api";
import { getAttendanceStatus } from "@/lib/attendance-service";
import { logRouteError } from "@/lib/server-log";
import { requireSession } from "@/lib/session";
import { attendanceEmployeeSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const url = new URL(request.url);
    const employeeId = Number(url.searchParams.get("employeeId"));
    const input = attendanceEmployeeSchema.parse({ employeeId });
    const status = await getAttendanceStatus(input.employeeId);
    return Response.json({ status });
  } catch (error) {
    logRouteError("GET /api/attendance/status", error);
    return jsonError(normalizeError(error), 400);
  }
}
