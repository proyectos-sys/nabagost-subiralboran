import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { getPurchaseEnv } from "./env";
import { extractedPurchaseSchema, type ExtractedPurchaseData } from "./types";

const extractionPrompt = [
  "Extrae datos de compra de esta factura o albaran recibido por Navagost.",
  "NAVAGOST PARTNERS, NAVAGOST PARTNERS S.L. y el NIF B26849596 son siempre el comprador/destinatario, nunca el proveedor.",
  "El proveedor es la empresa emisora del documento, normalmente identificada por su logotipo y datos fiscales propios.",
  "Devuelve solo JSON valido con vendorName, vendorVat, date YYYY-MM-DD, reference, lines[{productReference,description,quantity,unitPrice,taxRate,jobRef}], total, documentJobRef.",
  "productReference es la referencia/codigo de articulo de la linea si aparece. unitPrice debe ser el precio unitario sin IVA y total el total final del documento con impuestos cuando aparezca.",
  "Ademas del contenido impreso original del documento, busca texto anadido a mano por separado (letra manuscrita, con boligrafo o rotulador, distinta de la tipografia impresa) que indique a que faena o cliente se debe imputar el coste. Suele tener forma de codigo tipo S seguido de digitos (por ejemplo S55, s066) o un nombre de cliente/faena escrito a mano.",
  "Si esa anotacion a mano aparece junto a una linea concreta, ponla en el campo jobRef de esa linea. Si aparece una sola vez en todo el documento (margen, esquina, cabecera) sin asociarse a una linea concreta, ponla en documentJobRef y deja jobRef vacio en todas las lineas.",
  "Si no ves ninguna anotacion a mano, deja jobRef y documentJobRef como cadena vacia. No inventes ni deduzcas una faena a partir de datos impresos del documento (referencia de proveedor, codigo de producto, etc.); solo cuenta lo que este realmente escrito a mano.",
  "Si un dato no aparece usa cadena vacia o 0. No inventes productos ni datos fiscales.",
].join(" ");

export async function extractPurchaseDataFromImage(imagePath: string): Promise<ExtractedPurchaseData> {
  const env = getPurchaseEnv();
  if (env.OCR_PROVIDER === "gemini") {
    return extractWithGemini(imagePath);
  }

  return extractWithOpenAI(imagePath);
}

async function extractWithGemini(imagePath: string): Promise<ExtractedPurchaseData> {
  const env = getPurchaseEnv();
  if (!env.GEMINI_API_KEY) {
    throw new Error("Falta GEMINI_API_KEY para leer imagenes con Gemini.");
  }

  const image = readFileSync(imagePath);
  const mediaType = mediaTypeFromPath(imagePath);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      env.GEMINI_MODEL,
    )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: extractionPrompt },
              {
                inline_data: {
                  mime_type: mediaType,
                  data: image.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          response_mime_type: "application/json",
        },
      }),
    },
  );
  const json = (await response.json()) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!response.ok) {
    throw new Error(`Gemini no pudo leer la imagen: ${json.error?.message || response.statusText}`);
  }

  const text = json.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!text) {
    throw new Error("Gemini no devolvio JSON de extraccion.");
  }

  return extractedPurchaseSchema.parse(JSON.parse(stripJsonFence(text)));
}

async function extractWithOpenAI(imagePath: string): Promise<ExtractedPurchaseData> {
  const env = getPurchaseEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error("Falta OPENAI_API_KEY para leer imagenes con OCR/IA.");
  }

  const image = readFileSync(imagePath);
  const mediaType = mediaTypeFromPath(imagePath);
  const dataUrl = `data:${mediaType};base64,${image.toString("base64")}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_PURCHASE_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: extractionPrompt,
            },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "purchase_image_extraction",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["vendorName", "vendorVat", "date", "reference", "lines", "total", "documentJobRef"],
            properties: {
              vendorName: { type: "string" },
              vendorVat: { type: "string" },
              date: { type: "string" },
              reference: { type: "string" },
              lines: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["productReference", "description", "quantity", "unitPrice", "taxRate", "jobRef"],
                  properties: {
                    productReference: { type: "string" },
                    description: { type: "string" },
                    quantity: { type: "number" },
                    unitPrice: { type: "number" },
                    taxRate: { type: "number" },
                    jobRef: { type: "string" },
                  },
                },
              },
              total: { type: "number" },
              documentJobRef: { type: "string" },
            },
          },
          strict: true,
        },
      },
    }),
  });

  const json = (await response.json()) as { output_text?: string; error?: { message?: string }; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (!response.ok) {
    throw new Error(`OpenAI no pudo leer la imagen: ${json.error?.message || response.statusText}`);
  }

  const text = json.output_text || json.output?.flatMap((item) => item.content || []).find((content) => content.text)?.text;
  if (!text) {
    throw new Error("OpenAI no devolvio JSON de extraccion.");
  }

  return extractedPurchaseSchema.parse(JSON.parse(text));
}

function mediaTypeFromPath(imagePath: string): string {
  const ext = extname(imagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
