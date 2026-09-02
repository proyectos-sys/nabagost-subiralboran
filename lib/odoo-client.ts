import { getEnv } from "./env";

export type OdooModel =
  | "project.project"
  | "project.task"
  | "hr.employee"
  | "hr.attendance"
  | "account.analytic.line";

type OdooErrorBody = {
  message?: string;
  name?: string;
  debug?: string;
  arguments?: unknown[];
};

export class OdooError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "OdooError";
  }
}

export class OdooClient {
  private readonly url: string;
  private readonly database: string;
  private readonly apiKey: string;

  constructor() {
    const env = getEnv();
    this.url = env.ODOO_URL.replace(/\/$/, "");
    this.database = env.ODOO_DATABASE;
    this.apiKey = env.ODOO_API_KEY;
  }

  async call<T>(model: OdooModel, method: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new OdooError("Falta ODOO_API_KEY. Activa MOCK_ODOO=true o configura la clave API.");
    }

    const response = await fetch(`${this.url}/json/2/${model}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `bearer ${this.apiKey}`,
        "X-Odoo-Database": this.database,
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "navagost-partes-trabajo/1.0",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }).catch((error: unknown) => {
      throw new OdooError(buildNetworkErrorMessage(this.url, model, method, error));
    });

    const text = await response.text();
    const data = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      const detail = getOdooErrorMessage(data, text);
      throw new OdooError(`Odoo ha respondido con error: ${detail || response.statusText}`, response.status);
    }

    return data as T;
  }
}

export const odooClient = new OdooClient();

function buildNetworkErrorMessage(url: string, model: OdooModel, method: string, error: unknown): string {
  const cause = error instanceof Error ? error.message : "error desconocido";

  return `No se puede conectar con Odoo (${url}). Comprueba internet, la URL de Odoo y que Odoo no este bloqueando la conexion. Operacion: ${model}/${method}. Detalle tecnico: ${cause}.`;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getOdooErrorMessage(data: unknown, fallback: string): string {
  if (typeof fallback === "string" && fallback.toLowerCase().includes("rate limit exceeded")) {
    return "Odoo ha limitado temporalmente las peticiones desde esta conexion. Espera unos minutos y vuelve a probar.";
  }

  if (typeof fallback === "string" && fallback.trim().startsWith("<")) {
    return "Odoo ha devuelto una pagina HTML de error. Revisa conectividad, permisos o vuelve a intentarlo en unos minutos.";
  }

  if (typeof data === "object" && data) {
    const body = data as OdooErrorBody;
    const firstArgument = Array.isArray(body.arguments) ? body.arguments.find(Boolean) : null;
    return String(body.message || firstArgument || body.name || fallback);
  }

  return fallback;
}
