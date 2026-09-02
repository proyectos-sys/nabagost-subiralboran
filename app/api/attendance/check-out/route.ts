import { jsonError, normalizeError } from "@/lib/api";
import { checkOut } from "@/lib/attendance-service";
import { claimIdempotencyKey, releaseIdempotencyKey } from "@/lib/idempotency";
import { logRouteError } from "@/lib/server-log";
import { requireSession } from "@/lib/session";
import { attendanceActionSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  let idempotencyKey: string | null = null;

  try {
    const input = attendanceActionSchema.parse(await request.json());
    idempotencyKey = input.idempotencyKey;

    if (!claimIdempotencyKey(input.idempotencyKey)) {
      return jsonError("Este fichaje ya se esta procesando. Espera unos segundos.", 409);
    }

    const status = await checkOut(input.employeeId, input.occurredAt);
    return Response.json({ status });
  } catch (error) {
    if (idempotencyKey) {
      releaseIdempotencyKey(idempotencyKey);
    }

    logRouteError("POST /api/attendance/check-out", error);
    return jsonError(normalizeError(error), 400);
  }
}
