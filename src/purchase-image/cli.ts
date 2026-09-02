import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import { createPurchaseOrder, getPurchasePreview } from "./purchase-service";
import { withoutSecrets } from "./env";

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    throw new Error("Uso: npm run purchase:image -- ./ticket.jpg");
  }

  if (!existsSync(imagePath)) {
    throw new Error(`No existe la imagen: ${imagePath}`);
  }

  const preview = await getPurchasePreview(imagePath);
  console.log(JSON.stringify({
    proveedor: preview.vendor,
    fecha: preview.extracted.date,
    referencia: preview.extracted.reference,
    faena_documento: preview.extracted.documentJobRef
      ? { texto: preview.extracted.documentJobRef, resuelto: preview.documentAnalytic }
      : undefined,
    lineas: preview.lines.map((line) => ({
      descripcion: line.description,
      cantidad: line.quantity,
      precio: line.unitPrice,
      producto: line.product,
      subtotal: line.subtotal,
      faena: line.analytic,
    })),
    total_extraido: preview.totalExtracted,
    total_lineas: preview.totalLines,
    avisos: preview.warnings,
  }, null, 2));

  const rl = createInterface({ input, output });
  const answer = await rl.question("Crear compra en borrador en Odoo? Escribe SI para confirmar: ");
  rl.close();

  if (answer.trim().toUpperCase() !== "SI") {
    console.log("Cancelado. No se ha creado nada en Odoo.");
    return;
  }

  const created = await createPurchaseOrder(preview);
  console.log(JSON.stringify({ compra: created.name, id: created.id, url: created.url }, null, 2));
}

main().catch((error: unknown) => {
  console.error(withoutSecrets(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
