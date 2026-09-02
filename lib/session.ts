import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";

const COOKIE_NAME = "navagost_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

function secret(): string {
  return getEnv().APP_ACCESS_PIN.trim() || "navagost-dev-session-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

export async function createSessionCookie() {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ expiresAt })).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  const cookieSecure = shouldUseSecureCookie();

  (await cookies()).set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function hasValidSession(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;

  if (!value) {
    return false;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      expiresAt?: number;
    };

    return typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export async function requireSession(): Promise<Response | null> {
  if (await hasValidSession()) {
    return null;
  }

  return Response.json({ error: "Sesion caducada. Vuelve a introducir el PIN." }, { status: 401 });
}

function shouldUseSecureCookie(): boolean {
  const value = getEnv().APP_COOKIE_SECURE;

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}
