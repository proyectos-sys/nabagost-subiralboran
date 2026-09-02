import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function clientFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return clientFiles(path);
    }

    return path.endsWith(".tsx") || path.endsWith(".ts") ? [path] : [];
  });
}

describe("proteccion de secretos", () => {
  it("no referencia la clave de Odoo en componentes cliente", () => {
    const files = [...clientFiles("app"), ...clientFiles("components")];
    const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(combined).not.toContain("ODOO_API_KEY");
    expect(combined).not.toContain("Authorization: `bearer");
  });
});
