const processedKeys = new Map<string, number>();
const TTL_MS = 5 * 60 * 1000;

function prune(now = Date.now()) {
  for (const [key, expiresAt] of processedKeys.entries()) {
    if (expiresAt <= now) {
      processedKeys.delete(key);
    }
  }
}

export function claimIdempotencyKey(key: string): boolean {
  const now = Date.now();
  prune(now);

  if (processedKeys.has(key)) {
    return false;
  }

  processedKeys.set(key, now + TTL_MS);
  return true;
}

export function releaseIdempotencyKey(key: string) {
  processedKeys.delete(key);
}
