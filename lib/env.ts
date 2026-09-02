import { z } from "zod";

const envSchema = z.object({
  ODOO_URL: z.string().url().default("https://navagost.odoo.com"),
  ODOO_DATABASE: z.string().min(1).default("navagost"),
  ODOO_API_KEY: z.string().optional().default(""),
  ODOO_PROJECT_NAME: z.string().min(1).default("Taller y Faenas Navagost"),
  APP_ACCESS_PIN: z.string().optional().default(""),
  APP_TIMEZONE: z.string().min(1).default("Europe/Madrid"),
  APP_COOKIE_SECURE: z
    .string()
    .optional()
    .default("auto")
    .transform((value) => value.toLowerCase()),
  MOCK_ODOO: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}

export function assertRuntimeConfig() {
  const env = getEnv();
  const missing: string[] = [];

  if (!env.APP_ACCESS_PIN) {
    missing.push("APP_ACCESS_PIN");
  }

  if (!env.MOCK_ODOO && !env.ODOO_API_KEY) {
    missing.push("ODOO_API_KEY");
  }

  return {
    env,
    missing,
    ready: missing.length === 0,
  };
}
