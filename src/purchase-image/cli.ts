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
    lineas_presupuesto: preview.saleLines.map((plan) => ({
      presupuesto: plan.order.name,
      cliente: plan.order.partnerName,
      estado: plan.order.state,
      descripcion: plan.description,
      cantidad: plan.quantity,
      coste: plan.costUnit,
      precio_venta: plan.priceUnit,
      margen_sobre_coste: `${preview.markupPercent}%`,
    })),
    total_extraido: preview.totalExtracted,
    total_lineas: preview.totalLines,
    avisos: preview.warnings,
  }, null, 2));

  const saleSummary = preview.saleLines.length
    ? ` y anadir ${preview.saleLines.length} linea(s) a presupuestos`
    : "";
  const rl = createInterface({ input, output });
  const answer = await rl.question(`Crear compra en borrador en Odoo${saleSummary}? Escribe SI para confirmar: `);
  rl.close();

  if (answer.trim().toUpperCase() !== "SI") {
    console.log("Cancelado. No se ha creado nada en Odoo.");
    return;
  }

  const created = await createPurchaseOrder(preview);
  console.log(JSON.stringify({
    compra: created.name,
    id: created.id,
    url: created.url,
    lineas_presupuesto_creadas: created.saleLines,
    avisos_presupuesto: created.saleWarnings,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(withoutSecrets(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
