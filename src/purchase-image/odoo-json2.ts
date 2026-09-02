import { getPurchaseEnv, withoutSecrets } from "./env";

export type OdooMany2One = false | [number, string];
export type OdooFieldMap = Record<string, { readonly?: boolean; required?: boolean; type?: string; relation?: string }>;

export class OdooJson2Error extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "OdooJson2Error";
  }
}

export class OdooJson2Client {
  private readonly env = getPurchaseEnv();
  private readonly baseUrl = this.env.ODOO_URL.replace(/\/$/, "");

  async call<T>(model: string, method: string, payload: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/json/2/${model}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `bearer ${this.env.ODOO_API_KEY}`,
        "X-Odoo-Database": this.env.ODOO_DATABASE,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch((error: unknown) => {
      throw new OdooJson2Error(`No se puede conectar con Odoo: ${error instanceof Error ? error.message : "error desconocido"}`);
    });

    const text = await response.text();
    const data = text ? parseJson(text) : null;

    if (!response.ok) {
      throw new OdooJson2Error(withoutSecrets(`Odoo ${model}/${method} respondio ${response.status}: ${extractMessage(data, text)}`), response.status);
    }

    return data as T;
  }

  fieldsGet(model: string): Promise<OdooFieldMap> {
    return this.call<OdooFieldMap>(model, "fields_get", {
      attributes: ["string", "type", "relation", "required", "readonly"],
    });
  }
}

export function many2OneId(value: OdooMany2One | undefined): number | undefined {
  return Array.isArray(value) ? value[0] : undefined;
}

export function many2OneName(value: OdooMany2One | undefined): string {
  return Array.isArray(value) ? value[1] : "";
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data) {
    const body = data as { message?: string; name?: string; arguments?: unknown[] };
    return String(body.message || body.arguments?.[0] || body.name || fallback);
  }

  return fallback;
}
