import { jsonError, normalizeError } from "@/lib/api";
import { claimIdempotencyKey, releaseIdempotencyKey } from "@/lib/idempotency";
import { createTimesheet } from "@/lib/odoo-service";
import { logRouteError } from "@/lib/server-log";
import { requireSession } from "@/lib/session";
import { timesheetSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  let idempotencyKey: string | null = null;

  try {
    const input = timesheetSchema.parse(await request.json());
    idempotencyKey = input.idempotencyKey;

    if (!claimIdempotencyKey(input.idempotencyKey)) {
      return jsonError("Este registro ya se esta procesando. Espera unos segundos.", 409);
    }

    const timesheet = await createTimesheet(input);
    return Response.json({ timesheet });
  } catch (error) {
    if (idempotencyKey) {
      releaseIdempotencyKey(idempotencyKey);
    }

    logRouteError("POST /api/timesheets", error);
    return jsonError(normalizeError(error), 400);
  }
}
