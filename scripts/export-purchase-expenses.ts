import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { OdooJson2Client } from "../src/purchase-image/odoo-json2";

type Many2One = false | [number, string];

type PurchaseOrder = {
  id: number;
  name: string;
  partner_id: Many2One;
  partner_ref?: string | false;
  date_order?: string | false;
  date_approve?: string | false;
  amount_total?: number;
  state?: string;
};

type PurchaseLine = {
  id: number;
  order_id: Many2One;
  product_id: Many2One;
  name?: string;
  product_qty?: number;
  price_unit?: number;
  price_subtotal?: number;
};

type ReportRow = {
  fecha: string;
  pedido: string;
  referenciaProveedor: string;
  proveedor: string;
  estado: string;
  conceptoGeneral: string;
  detalleLineas: string;
  importe: number;
};

const client = new OdooJson2Client();
const outputRoot = join(dirname(process.cwd()), "contabilidad", "gastosmesodo");

async function main() {
  const orders = await fetchAllOrders();
  const lines = await fetchLinesForOrders(orders.map((order) => order.id));
  const linesByOrder = groupByOrder(lines);

  const rows = orders
    .map((order) => toReportRow(order, linesByOrder.get(order.id) || []))
    .sort((a, b) => `${a.fecha}${a.pedido}`.localeCompare(`${b.fecha}${b.pedido}`));

  for (const [month, monthRows] of groupRowsByMonth(rows)) {
    const outputDir = join(outputRoot, month);
    mkdirSync(outputDir, { recursive: true });
    const csvPath = join(outputDir, `gastos-compras-odoo-${month}.csv`);
    const mdPath = join(outputDir, `gastos-compras-odoo-${month}.md`);
    writeFileSync(csvPath, "\uFEFF" + toCsv(monthRows), "utf8");
    writeFileSync(mdPath, toMarkdown(monthRows, month), "utf8");
    console.log(`${month}: ${monthRows.length} compras, ${formatEuro(total(monthRows))}`);
    console.log(`  CSV: ${csvPath}`);
    console.log(`  MD: ${mdPath}`);
  }

  console.log(`Compras exportadas: ${rows.length}`);
  console.log(`Total: ${formatEuro(total(rows))}`);
}

async function fetchAllOrders() {
  const rows: PurchaseOrder[] = [];
  const limit = 80;
  for (let offset = 0; ; offset += limit) {
    const batch = await client.call<PurchaseOrder[]>("purchase.order", "search_read", {
      domain: [["state", "!=", "cancel"]],
      fields: ["id", "name", "partner_id", "partner_ref", "date_order", "date_approve", "amount_total", "state"],
      limit,
      offset,
      order: "date_order asc, id asc",
    });
    rows.push(...batch);
    if (batch.length < limit) break;
  }
  return rows;
}

async function fetchLinesForOrders(orderIds: number[]) {
  const rows: PurchaseLine[] = [];
  const chunkSize = 40;
  for (let index = 0; index < orderIds.length; index += chunkSize) {
    const ids = orderIds.slice(index, index + chunkSize);
    const batch = await client.call<PurchaseLine[]>("purchase.order.line", "search_read", {
      domain: [["order_id", "in", ids]],
      fields: ["id", "order_id", "product_id", "name", "product_qty", "price_unit", "price_subtotal"],
      limit: 1000,
      order: "order_id asc, id asc",
    });
    rows.push(...batch);
    await sleep(500);
  }
  return rows;
}

function groupByOrder(lines: PurchaseLine[]) {
  const grouped = new Map<number, PurchaseLine[]>();
  for (const line of lines) {
    const orderId = many2OneId(line.order_id);
    if (!orderId) continue;
    const current = grouped.get(orderId) || [];
    current.push(line);
    grouped.set(orderId, current);
  }
  return grouped;
}

function toReportRow(order: PurchaseOrder, lines: PurchaseLine[]): ReportRow {
  return {
    fecha: String(order.date_approve || "").slice(0, 10),
    pedido: order.name,
    referenciaProveedor: String(order.partner_ref || ""),
    proveedor: normalizeProvider(many2OneName(order.partner_id)),
    estado: translateState(order.state || ""),
    conceptoGeneral: inferConcept(lines),
    detalleLineas: summarizeLines(lines),
    importe: Number(order.amount_total || 0),
  };
}

function inferConcept(lines: PurchaseLine[]) {
  const text = lines.map((line) => `${many2OneName(line.product_id)} ${line.name || ""}`).join(" ").toUpperCase();
  const concepts: Array<[string, string[]]> = [
    ["Laser / corte / desarrollo", ["LASER", "CORTE DE PIEZA", "DESARROLLO", "BRIDA", "VALONA"]],
    ["Tubos y metal", ["TUBO", "CHAPA", "PLETINA", "ANGULO", "TRAMEX", "INOX"]],
    ["Tornilleria y fijaciones", ["TORNILLO", "TUERCA", "ARANDELA", "TACO", "SUJETACABLE", "TAPON", "BRIDA NYLON"]],
    ["Pintura y acabado", ["PINTURA", "ESMALTE", "SPRAY", "LACADO", "RAL"]],
    ["Herramientas y consumibles", ["BROCA", "DISCO", "FLEXOMETRO", "VASO", "LLAVE", "ELECTRODO", "TAMIZ", "DESACHEM"]],
    ["Combustible", ["DIESEL", "GASOLINA", "S PLOMO"]],
    ["Transporte / servicios", ["SERVICIO LOGISTICO", "TRANSPORTE", "PORTES", "ADR"]],
  ];
  for (const [concept, needles] of concepts) {
    if (needles.some((needle) => text.includes(needle))) return concept;
  }
  const products = unique(lines.map((line) => many2OneName(line.product_id)).filter(Boolean));
  return products.slice(0, 3).join(", ") || "Sin lineas";
}

function summarizeLines(lines: PurchaseLine[]) {
  return lines
    .map((line) => {
      const qty = cleanNumber(line.product_qty || 0);
      const product = many2OneName(line.product_id) || "Producto";
      const name = (line.name || "").replace(/\s+/g, " ").trim();
      return `${qty} x ${product}${name && name !== product ? ` (${name})` : ""}`;
    })
    .join(" | ");
}

function toCsv(rows: ReportRow[]) {
  const headers = ["Fecha", "Pedido", "Referencia proveedor", "Proveedor", "Estado", "Concepto general", "Detalle lineas", "Importe"];
  const body = rows.map((row) => [
    row.fecha,
    row.pedido,
    row.referenciaProveedor,
    row.proveedor,
    row.estado,
    row.conceptoGeneral,
    row.detalleLineas,
    formatDecimal(row.importe),
  ]);
  return [headers, ...body].map((line) => line.map(csvEscape).join(";")).join("\r\n") + "\r\n";
}

function groupRowsByMonth(rows: ReportRow[]) {
  const grouped = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const month = row.fecha.slice(0, 7) || "sin-fecha";
    const current = grouped.get(month) || [];
    current.push(row);
    grouped.set(month, current);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function toMarkdown(rows: ReportRow[], month: string) {
  const byProvider = new Map<string, { count: number; total: number }>();
  for (const row of rows) {
    const current = byProvider.get(row.proveedor) || { count: 0, total: 0 };
    current.count += 1;
    current.total += row.importe;
    byProvider.set(row.proveedor, current);
  }
  const summary = [...byProvider.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([provider, data]) => `| ${mdEscape(provider)} | ${data.count} | ${formatEuro(data.total)} |`)
    .join("\n");

  const detail = rows
    .map((row) =>
      `| ${row.fecha} | ${mdEscape(row.pedido)} | ${mdEscape(row.referenciaProveedor)} | ${mdEscape(row.proveedor)} | ${mdEscape(row.estado)} | ${mdEscape(
        row.conceptoGeneral,
      )} | ${formatEuro(row.importe)} | ${mdEscape(row.detalleLineas)} |`,
    )
    .join("\n");

  return `# Gastos de compras en Odoo - ${month}

Generado: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}

Total compras: ${rows.length}

Importe total: ${formatEuro(total(rows))}

## Resumen por proveedor

| Proveedor | Compras | Importe |
|---|---:|---:|
${summary}

## Detalle

| Fecha | Pedido | Ref. proveedor | Proveedor | Estado | Concepto general | Importe | Lineas |
|---|---|---|---|---|---|---:|---|
${detail}
`;
}

function total(rows: ReportRow[]) {
  return rows.reduce((sum, row) => sum + row.importe, 0);
}

function many2OneId(value: Many2One | undefined) {
  return Array.isArray(value) ? value[0] : undefined;
}

function many2OneName(value: Many2One | undefined) {
  return Array.isArray(value) ? value[1] : "";
}

function translateState(state: string) {
  const states: Record<string, string> = {
    draft: "SdP",
    sent: "SdP enviada",
    "to approve": "Pendiente aprobar",
    purchase: "Pedido confirmado",
    done: "Bloqueado",
  };
  return states[state] || state;
}

function normalizeProvider(provider: string) {
  const normalized = provider.toUpperCase().replace(/[.,]/g, "").trim();
  if (normalized.includes("HIERROS Y METALES CASTELLON") || normalized.includes("HIMECAS")) {
    return "HIMECAS";
  }
  return provider;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function csvEscape(value: string) {
  const normalized = String(value).replace(/\r?\n/g, " ");
  return /[";]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function mdEscape(value: string) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function cleanNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4))).replace(".", ",");
}

function formatDecimal(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function formatEuro(value: number) {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
