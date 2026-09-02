import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { OdooJson2Client } from "../src/purchase-image/odoo-json2";

type Many2One = false | [number, string];

type CustomerInvoice = {
  id: number;
  name?: string | false;
  partner_id: Many2One;
  invoice_date?: string | false;
  amount_total?: number;
  amount_total_signed?: number;
  move_type?: string;
  state?: string;
};

type IncomeRow = {
  fecha: string;
  factura: string;
  cliente: string;
  importe: number;
};

const client = new OdooJson2Client();
const outputRoot = join(dirname(process.cwd()), "contabilidad", "ingresosmesodo");

async function main() {
  const invoices = await fetchAllCustomerInvoices();
  const rows = invoices
    .map(toIncomeRow)
    .filter((row) => row.factura && row.factura !== "/")
    .sort((a, b) => `${a.fecha}${a.factura}`.localeCompare(`${b.fecha}${b.factura}`));

  for (const [month, monthRows] of groupRowsByMonth(rows)) {
    const outputDir = join(outputRoot, month);
    mkdirSync(outputDir, { recursive: true });
    const csvPath = join(outputDir, `ingresos-facturas-cliente-odoo-${month}.csv`);
    const mdPath = join(outputDir, `ingresos-facturas-cliente-odoo-${month}.md`);
    writeFileSync(csvPath, "\uFEFF" + toCsv(monthRows), "utf8");
    writeFileSync(mdPath, toMarkdown(monthRows, month), "utf8");
    console.log(`${month}: ${monthRows.length} facturas, ${formatEuro(total(monthRows))}`);
    console.log(`  CSV: ${csvPath}`);
    console.log(`  MD: ${mdPath}`);
  }

  console.log(`Facturas exportadas: ${rows.length}`);
  console.log(`Total: ${formatEuro(total(rows))}`);
}

async function fetchAllCustomerInvoices() {
  const rows: CustomerInvoice[] = [];
  const limit = 80;
  for (let offset = 0; ; offset += limit) {
    const batch = await client.call<CustomerInvoice[]>("account.move", "search_read", {
      domain: [
        ["move_type", "in", ["out_invoice", "out_refund"]],
        ["state", "!=", "cancel"],
      ],
      fields: ["id", "name", "partner_id", "invoice_date", "amount_total", "amount_total_signed", "move_type", "state"],
      limit,
      offset,
      order: "invoice_date asc, id asc",
    });
    rows.push(...batch);
    if (batch.length < limit) break;
    await sleep(500);
  }
  return rows;
}

function toIncomeRow(invoice: CustomerInvoice): IncomeRow {
  return {
    fecha: String(invoice.invoice_date || "").slice(0, 10),
    factura: String(invoice.name || ""),
    cliente: many2OneName(invoice.partner_id),
    importe: Number(invoice.amount_total_signed ?? invoice.amount_total ?? 0),
  };
}

function groupRowsByMonth(rows: IncomeRow[]) {
  const grouped = new Map<string, IncomeRow[]>();
  for (const row of rows) {
    const month = row.fecha.slice(0, 7) || "sin-fecha";
    const current = grouped.get(month) || [];
    current.push(row);
    grouped.set(month, current);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function toCsv(rows: IncomeRow[]) {
  const headers = ["Fecha", "Numero factura", "Cliente", "Importe"];
  const body = rows.map((row) => [row.fecha, row.factura, row.cliente, formatDecimal(row.importe)]);
  return [headers, ...body].map((line) => line.map(csvEscape).join(";")).join("\r\n") + "\r\n";
}

function toMarkdown(rows: IncomeRow[], month: string) {
  const detail = rows
    .map((row) => `| ${row.fecha} | ${mdEscape(row.factura)} | ${mdEscape(row.cliente)} | ${formatEuro(row.importe)} |`)
    .join("\n");

  return `# Ingresos facturas cliente Odoo - ${month}

Generado: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}

Total facturas: ${rows.length}

Importe total: ${formatEuro(total(rows))}

| Fecha | Numero factura | Cliente | Importe |
|---|---|---|---:|
${detail}
`;
}

function total(rows: IncomeRow[]) {
  return rows.reduce((sum, row) => sum + row.importe, 0);
}

function many2OneName(value: Many2One | undefined) {
  return Array.isArray(value) ? value[1] : "";
}

function csvEscape(value: string) {
  const normalized = String(value).replace(/\r?\n/g, " ");
  return /[";]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function mdEscape(value: string) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function formatDecimal(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function formatEuro(value: number) {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
