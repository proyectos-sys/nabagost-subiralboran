import { timingSafeEqual } from "node:crypto";
import { jsonError, normalizeError } from "@/lib/api";
import { assertRuntimeConfig } from "@/lib/env";
import { createSessionCookie } from "@/lib/session";
import { loginSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function pinMatches(receivedPin: string, expectedPin: string): boolean {
  const received = Buffer.from(receivedPin.trim(), "utf8");
  const expected = Buffer.from(expectedPin.trim(), "utf8");

  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  try {
    const { env, ready, missing } = assertRuntimeConfig();
    if (!ready) {
      return jsonError(`Faltan variables de entorno: ${missing.join(", ")}.`, 500);
    }

    const body = loginSchema.parse(await request.json());
    if (!pinMatches(body.pin, env.APP_ACCESS_PIN)) {
      return jsonError("PIN incorrecto.", 401);
    }

    await createSessionCookie();
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(normalizeError(error), 400);
  }
}
