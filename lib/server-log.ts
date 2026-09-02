import { normalizeError } from "./api";

export function logRouteError(route: string, error: unknown) {
  const details =
    error instanceof Error
      ? {
          name: error.name,
          message: normalizeError(error),
        }
      : {
          name: "UnknownError",
          message: normalizeError(error),
        };

  console.error(`[${route}]`, details);
}
