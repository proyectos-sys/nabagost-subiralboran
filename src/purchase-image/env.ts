import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  ODOO_URL: z.string().url().default("https://navagost.odoo.com"),
  ODOO_DATABASE: z.string().min(1).default("navagost"),
  ODOO_API_KEY: z.string().min(1, "Falta ODOO_API_KEY."),
  OPENAI_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-2.5-flash"),
  OCR_PROVIDER: z.enum(["gemini", "openai"]).optional(),
  DEFAULT_PURCHASE_LOCATION: z.string().optional().default("NAVAGOST: Recepciones"),
  DEFAULT_VENDOR_ID: z.coerce.number().int().positive().optional(),
  FALLBACK_PRODUCT_ID: z.coerce.number().int().positive().optional(),
  SALE_MARKUP_PERCENT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(0).max(1000).default(40),
  ),
  ADD_COST_TO_SALE_ORDER: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["true", "false"]).default("true"),
  ),
});

export type PurchaseEnv = z.infer<typeof envSchema>;

let loaded = false;

export function loadDotEnv(path = ".env") {
  if (loaded) {
    return;
  }

  loaded = true;
  const file = resolve(process.cwd(), path);
  if (!existsSync(file)) {
    return;
  }

  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getPurchaseEnv(): PurchaseEnv {
  loadDotEnv();
  const parsed = envSchema.parse({
    ...process.env,
    ODOO_DATABASE: process.env.ODOO_DATABASE || process.env.DATABASE,
    ODOO_API_KEY: process.env.ODOO_API_KEY || process.env.API_KEY,
  });

  return {
    ...parsed,
    OCR_PROVIDER: parsed.OCR_PROVIDER || (parsed.GEMINI_API_KEY ? "gemini" : "openai"),
  };
}

export function withoutSecrets(message: string): string {
  return message
    .replace(/bearer\s+[A-Za-z0-9._-]+/gi, "bearer [REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]+/g, "AIza[REDACTED]")
    .replace(/sk-[A-Za-z0-9._-]+/g, "sk-[REDACTED]");
}
