import { buildPurchasePreview, createPurchaseOrder, getPurchasePreview } from "./purchase-service";
import { extractedPurchaseSchema } from "./types";
import type { PurchasePreview } from "./types";

type JsonRpcRequest = {
  jsonrpc?: "2.0";
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
};

const previews = new Map<string, PurchasePreview>();

process.stdin.setEncoding("utf8");
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index = buffer.indexOf("\n");
  while (index >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) {
      void handleLine(line);
    }
    index = buffer.indexOf("\n");
  }
});

async function handleLine(line: string) {
  const request = JSON.parse(line) as JsonRpcRequest;
  try {
    if (request.method === "initialize") {
      return respond(request.id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "navagost-purchase-image", version: "1.0.0" },
        capabilities: { tools: {} },
      });
    }

    if (request.method === "tools/list") {
      return respond(request.id, { tools: toolsList() });
    }

    if (request.method === "tools/call") {
      const name = String(request.params?.name || "");
      const args = (request.params?.arguments || {}) as Record<string, unknown>;
      const result = await callTool(name, args);
      return respond(request.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    }

    return respond(request.id, {});
  } catch (error) {
    return respondError(request.id, error instanceof Error ? error.message : String(error));
  }
}

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "analyze_purchase_image" || name === "get_purchase_preview") {
    const imagePath = requireImagePath(args);
    const preview = args.purchaseData
      ? await buildPurchasePreview(imagePath, extractedPurchaseSchema.parse(args.purchaseData))
      : await getPurchasePreview(imagePath);
    previews.set(imagePath, preview);
    return preview;
  }

  if (name === "create_purchase_from_image") {
    const imagePath = requireImagePath(args);
    const confirmed = args.confirmed === true;
    const preview = args.purchaseData
      ? await buildPurchasePreview(imagePath, extractedPurchaseSchema.parse(args.purchaseData))
      : previews.get(imagePath) || (await getPurchasePreview(imagePath));
    if (!confirmed) {
      previews.set(imagePath, preview);
      return preview;
    }
    return createPurchaseOrder(preview);
  }

  throw new Error(`Herramienta desconocida: ${name}`);
}

function toolsList() {
  const imageInputSchema = {
    type: "object",
    required: ["imagePath"],
    properties: {
      imagePath: { type: "string", description: "Ruta local de la imagen del ticket/factura/presupuesto." },
      purchaseData: {
        type: "object",
        description: "Datos extraidos corregidos manualmente cuando el OCR necesite revision.",
      },
    },
  };

  return [
    {
      name: "analyze_purchase_image",
      description: "Lee una imagen con IA/OCR y devuelve datos estructurados y avisos sin crear nada en Odoo.",
      inputSchema: imageInputSchema,
    },
    {
      name: "get_purchase_preview",
      description: "Devuelve preview de proveedor, productos, totales y needs_confirmation para revisar antes de crear.",
      inputSchema: imageInputSchema,
    },
    {
      name: "create_purchase_from_image",
      description: "Crea una compra en borrador desde imagen solo si confirmed=true; si no, devuelve needs_confirmation.",
      inputSchema: {
        type: "object",
        required: ["imagePath"],
        properties: {
          imagePath: { type: "string" },
          confirmed: { type: "boolean", description: "Debe ser true para crear la compra en Odoo." },
          purchaseData: {
            type: "object",
            description: "Datos corregidos que sustituyen la extraccion OCR antes de crear.",
          },
        },
      },
    },
  ];
}

function requireImagePath(args: Record<string, unknown>): string {
  if (typeof args.imagePath !== "string" || !args.imagePath.trim()) {
    throw new Error("Falta imagePath.");
  }
  return args.imagePath;
}

function respond(id: JsonRpcRequest["id"], result: unknown) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function respondError(id: JsonRpcRequest["id"], message: string) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } })}\n`);
}
