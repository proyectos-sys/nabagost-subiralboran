import { describe, expect, it } from "vitest";
import { claimIdempotencyKey, releaseIdempotencyKey } from "../lib/idempotency";

describe("idempotencia de partes", () => {
  it("bloquea una clave repetida y permite liberarla si falla", () => {
    const key = "00000000-0000-4000-8000-000000000001";

    expect(claimIdempotencyKey(key)).toBe(true);
    expect(claimIdempotencyKey(key)).toBe(false);

    releaseIdempotencyKey(key);
    expect(claimIdempotencyKey(key)).toBe(true);
    releaseIdempotencyKey(key);
  });
});
