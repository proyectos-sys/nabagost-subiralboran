import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { OdooJson2Client, type OdooFieldMap } from "../src/purchase-image/odoo-json2";

type Vendor = {
  id?: number;
  name: string;
  vat?: string;
  createIfMissing?: boolean;
};

type Line = {
  productId?: number;
  productName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: 0 | 21;
};

type Doc = {
  files: string[];
  vendor: Vendor;
  date: string;
  reference: string;
  lines: Line[];
  expectedTotal?: number;
  updateExisting?: boolean;
};

const imageDir = "C:/Users/david/Escritorio/NAVAGOST/navagost-agente-main/imagenesalbaranfacuras";

const P = {
  CORTE_LASER: 360,
  DESARROLLO: 396,
  DIESEL: 211,
  ELECTRODO: 208,
  SERVICIO_LOGISTICO: 71,
  TAPON_60_20: 358,
  TENSOR: 283,
};

const docs: Doc[] = [
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.45 (1).jpeg"],
    vendor: { id: 96, name: "TALLERES ALTOR SL", vat: "B12409702" },
    date: "2026-07-27",
    reference: "19486",
    expectedTotal: 50,
    lines: [{ productName: "VALVULA GAS Y CASQUILLO", description: "CONSULTA VALVULA GAS Y CASQUILLO", quantity: 1, unitPrice: 50, taxRate: 0 }],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.45.jpeg"],
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-27",
    reference: "4356-26",
    expectedTotal: 185.76,
    lines: [
      { productId: P.CORTE_LASER, description: "CHAPA 828,3X500X2", quantity: 1, unitPrice: 12.71 },
      { productId: P.CORTE_LASER, description: "CHAPA 125X450X2", quantity: 1, unitPrice: 10.77 },
      { productId: P.CORTE_LASER, description: "CHAPA 1300X500X2", quantity: 3, unitPrice: 14.42 },
      { productId: P.CORTE_LASER, description: "CHAPA 100X500X2", quantity: 2, unitPrice: 18.72 },
      { productId: P.CORTE_LASER, description: "CHAPA 1100X500X2", quantity: 2, unitPrice: 13.31 },
      { productId: P.CORTE_LASER, description: "CHAPA 311X500X2", quantity: 2, unitPrice: 11.36 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.46 (1).jpeg"],
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-24",
    reference: "ALV/141595",
    expectedTotal: 272.4,
    lines: [
      { productName: "CABLE GALVA 6 X 7 + 1", description: "CABLE GALVA 06 6 X 7 + 1", quantity: 100, unitPrice: 0.6325 },
      { productId: P.ELECTRODO, description: "ELECTRODO BASICO 2,5 X 350MM", quantity: 1.7, unitPrice: 6.4508 },
      { productId: P.TENSOR, description: "TENSOR GANCHO-ANILLA M08 GALVANIZADO", quantity: 25, unitPrice: 1.8051 },
      { productName: "SUJETACABLE GALVANIZADO CABLE 6", description: "SUJETACABLE GALVANIZADO PARA CABLE 6", quantity: 100, unitPrice: 0.2302 },
      { productName: "TORNILLO DIN 933 M 8 X 60 ZINC", description: "TORNILLO DIN 933 M 8 X 60 ZINC", quantity: 100, unitPrice: 0.0622 },
      { productName: "VASO BIHEXAGONAL 8MM", description: "VASO 1/2 BIHEXAGONAL 8MM", quantity: 1, unitPrice: 2.832 },
      { productName: "TUBO POLIAMIDA 6 X 8 AZUL", description: "M.L. TUBO POLIAMIDA 11/12 6 X 8 AZUL (ROLLO 25 M.L.)", quantity: 25, unitPrice: 1.1 },
      { productName: "CORDON FIBRA VIDRIO 8MM", description: "M.T CORDON FIBRA VIDRIO 8MM", quantity: 100, unitPrice: 0.462 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.46 (2).jpeg"],
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-21",
    reference: "ALV/141433",
    expectedTotal: 183.56,
    updateExisting: true,
    lines: [{ productId: P.TAPON_60_20, description: "TAPON PLASTICO 60 X 20 MM", quantity: 4, unitPrice: 0.25 }],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.46 (3).jpeg"],
    vendor: { id: 30, name: "DICOLASER SLU", vat: "B12555769" },
    date: "2026-07-20",
    reference: "002537",
    expectedTotal: 7.74,
    lines: [{ productId: P.CORTE_LASER, description: "CORTE DE PIEZA EMC", quantity: 2, unitPrice: 3.2 }],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.46.jpeg"],
    vendor: { id: 28, name: "MAYENCOLORS SL.", vat: "B12871281" },
    date: "2026-07-27",
    reference: "026.0007444",
    expectedTotal: 10.55,
    lines: [{ productName: "SPRAY RAL 5015 AZUL CIELO 400ML", description: "SPRAY AMBRO-SOL RAL 5015 AZUL CIELO 400ML", quantity: 2, unitPrice: 4.36 }],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.47 (1).jpeg", "WhatsApp Image 2026-07-28 at 14.42.47.jpeg"],
    vendor: { id: 104, name: "DATACOL HISPANIA S.L.", vat: "B18884718" },
    date: "2026-07-21",
    reference: "90080095",
    expectedTotal: 65.9,
    lines: [
      { productName: "SURTIDO BROCAS HSS 1-13MM", description: "SURTIDO BROCAS HSS 1-13MM", quantity: 1, unitPrice: 65.9, taxRate: 0 },
      { productName: "BLOC DE NOTAS", description: "BLOC DE NOTAS A5", quantity: 1, unitPrice: 0, taxRate: 0 },
      { productName: "BOLIGRAFO PERSONALIZADO", description: "BOLIGRAFOS PERSONALIZADOS DATA", quantity: 3, unitPrice: 0, taxRate: 0 },
      { productName: "POCKET LIGHT", description: "POCKET LIGHT", quantity: 1, unitPrice: 0, taxRate: 0 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.47 (2).jpeg"],
    vendor: { name: "DELFIN TRAVER SL", vat: "B12455176", createIfMissing: true },
    date: "2026-07-22",
    reference: "VCO/26-000242",
    expectedTotal: 205.35,
    lines: [
      { productName: "CILINDRO HIDRAULICO", description: "CILINDRO 0822120004 32/100 PRA", quantity: 1, unitPrice: 111.2 },
      { productName: "AMARRE HEMBRA", description: "AMARRE 1827001289 FC-32 (HEMBRA)", quantity: 1, unitPrice: 22.11 },
      { productName: "BULON", description: "BULON 1823120020 32M/M", quantity: 1, unitPrice: 2.64 },
      { productName: "HORQUILLA", description: "HORQUILLA G 32 - M10X1.25", quantity: 1, unitPrice: 4.69 },
      { productName: "RACOR RECTO", description: "RECTO 8-1/8 2121008180", quantity: 2, unitPrice: 3.48 },
      { productName: "AMARRE MACHO", description: "AMARRE 1827001283 FCM-32 (MACHO)", quantity: 1, unitPrice: 22.11 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.48 (1).jpeg"],
    vendor: { id: 60, name: "MARKOIL SA", vat: "A79209854" },
    date: "2026-07-23",
    reference: "25026TC000082986",
    expectedTotal: 50,
    lines: [{ productId: P.DIESEL, description: "DIESEL ACTIVE 27,49 L", quantity: 1, unitPrice: 41.32 }],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.48 (2).jpeg"],
    vendor: { id: 104, name: "DATACOL HISPANIA S.L.", vat: "B18884718" },
    date: "2026-07-07",
    reference: "90074922",
    expectedTotal: 46.55,
    lines: [{ productName: "DISCO LAMINAS 125 X 22 GRANO 40", description: "DISCO LAM.CONIC STANDARD LINE 125MM P40", quantity: 19, unitPrice: 2.45, taxRate: 0 }],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.48 (3).jpeg"],
    vendor: { id: 30, name: "DICOLASER SLU", vat: "B12555769" },
    date: "2026-07-27",
    reference: "002620",
    expectedTotal: 36.58,
    lines: [{ productId: P.CORTE_LASER, description: "CORTE DE PIEZA CONJUNTO PISTON D200", quantity: 1, unitPrice: 30.23 }],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.48.jpeg"],
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-24",
    reference: "4227-26",
    expectedTotal: 261.94,
    lines: [
      { productId: P.CORTE_LASER, description: "SALIDA D750 D200", quantity: 1, unitPrice: 15.02 },
      { productId: P.CORTE_LASER, description: "SALIDA D400 D315", quantity: 2, unitPrice: 24.48 },
      { productId: P.CORTE_LASER, description: "SALIDA D700 D315", quantity: 3, unitPrice: 31.19 },
      { productId: P.CORTE_LASER, description: "SALIDA D400 D315", quantity: 1, unitPrice: 39.93 },
      { productId: P.SERVICIO_LOGISTICO, description: "SERVICIO LOGISTICO", quantity: 1, unitPrice: 19 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.49 (1).jpeg"],
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-24",
    reference: "4222-26",
    expectedTotal: 0,
    lines: [
      { productId: P.DESARROLLO, description: "REPOSICION DESARROLLO TUBO D700 L1000", quantity: 3, unitPrice: 0, taxRate: 0 },
      { productId: P.DESARROLLO, description: "REPOSICION DESARROLLO TUBO D580 L1000", quantity: 11, unitPrice: 0, taxRate: 0 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.49 (2).jpeg"],
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-23",
    reference: "4256-26",
    expectedTotal: 42.77,
    lines: [
      { productId: P.CORTE_LASER, description: "REMATES ASCENSOR L1565 1310X120X1", quantity: 1, unitPrice: 12.98 },
      { productId: P.CORTE_LASER, description: "REMATES ASCENSOR L1330 1330X120X1", quantity: 1, unitPrice: 11.26 },
      { productId: P.CORTE_LASER, description: "REMATES ASCENSOR L1310 1310X120X1", quantity: 1, unitPrice: 11.11 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-28 at 14.42.49.jpeg"],
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-23",
    reference: "4265-26",
    expectedTotal: 3485.62,
    lines: [
      { productId: P.DESARROLLO, description: "DESARROLLO D315 L1500", quantity: 32, unitPrice: 51.78 },
      { productId: P.CORTE_LASER, description: "BRIDA DIAMETRO 315 ESP. 5MM", quantity: 50, unitPrice: 11.88 },
      { productId: P.DESARROLLO, description: "DESARROLLO CODO D315 ESP. 3MM", quantity: 10, unitPrice: 21.58 },
      { productId: P.DESARROLLO, description: "REDUCCION D400 D120 L250", quantity: 1, unitPrice: 13.96 },
      { productId: P.CORTE_LASER, description: "TAPA CODO FLEXIBLE D315", quantity: 2, unitPrice: 30.6 },
      { productId: P.CORTE_LASER, description: "BRIDA DIAMETRO 904 - 704", quantity: 4, unitPrice: 41.51 },
      { productId: P.CORTE_LASER, description: "BRIDA DIAMETRO 505 - 505", quantity: 6, unitPrice: 18.3 },
      { productId: P.CORTE_LASER, description: "BRIDA DIAMETRO 684 - 584", quantity: 2, unitPrice: 31.46 },
    ],
  },
];

const client = new OdooJson2Client();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const partnerFields = writableFields(["vat", "supplier_rank"]);
  const productFields = writableFields(["purchase_ok", "sale_ok"]);
  const orderFields = writableFields(["partner_ref", "date_order"]);
  const lineFields = writableFields(["date_planned", "tax_ids"]);
  const attachmentFields = writableFields(["name", "res_model", "res_id", "datas"]);
  const taxIds = await findTaxIds();
  const results: Array<Record<string, unknown>> = [];

  for (const doc of docs) {
    const partnerId = await ensurePartner(doc.vendor, partnerFields);
    await updateVatIfMissing(partnerId, doc.vendor.vat, partnerFields);

    const existing = await findExistingOrder(partnerId, doc.reference);
    if (existing[0]) {
      for (const line of doc.lines) {
        await addLineIfMissing(existing[0].id, line, productFields, lineFields, taxIds, doc.date);
      }
      for (const file of doc.files) {
        await attachIfMissing(existing[0].id, join(imageDir, file), attachmentFields);
      }
      const refreshed = await readOrder(existing[0].id);
      results.push({ reference: doc.reference, status: doc.updateExisting ? "updated" : "checked", purchase: refreshed?.name, id: existing[0].id, total: refreshed?.amount_total });
      console.log(`${doc.updateExisting ? "UPDATED" : "CHECKED"} ${doc.reference}: ${refreshed?.name} total=${refreshed?.amount_total ?? ""}`);
      continue;
    }

    const orderVals: Record<string, unknown> = { partner_id: partnerId };
    setIfWritable(orderFields, orderVals, "partner_ref", doc.reference);
    setIfWritable(orderFields, orderVals, "date_order", `${doc.date} 12:00:00`);
    const orderCreated = await client.call<number[] | number>("purchase.order", "create", { vals_list: [orderVals] });
    const orderId = Array.isArray(orderCreated) ? orderCreated[0] : orderCreated;

    for (const line of doc.lines) {
      await addLine(orderId, line, productFields, lineFields, taxIds, doc.date);
    }
    for (const file of doc.files) {
      await attachIfMissing(orderId, join(imageDir, file), attachmentFields);
    }

    const created = await readOrder(orderId);
    const diff = doc.expectedTotal === undefined || created?.amount_total === undefined ? 0 : Number((created.amount_total - doc.expectedTotal).toFixed(2));
    results.push({ reference: doc.reference, status: "created", purchase: created?.name, id: orderId, total: created?.amount_total, expectedTotal: doc.expectedTotal, diff });
    console.log(`CREATED ${doc.reference}: ${created?.name} total=${created?.amount_total ?? ""} diff=${diff}`);
    await sleep(800);
  }

  console.log(JSON.stringify(results, null, 2));
}

async function findExistingOrder(partnerId: number, reference: string) {
  return client.call<Array<{ id: number; name?: string; amount_total?: number }>>("purchase.order", "search_read", {
    domain: [
      ["partner_id", "=", partnerId],
      ["partner_ref", "=", reference],
    ],
    fields: ["id", "name", "amount_total"],
    limit: 1,
  });
}

async function readOrder(orderId: number) {
  return (await client.call<Array<{ id: number; name?: string; amount_total?: number; state?: string }>>("purchase.order", "search_read", {
    domain: [["id", "=", orderId]],
    fields: ["id", "name", "amount_total", "state"],
    limit: 1,
  }))[0];
}

async function addLineIfMissing(
  orderId: number,
  line: Line,
  productFields: OdooFieldMap,
  lineFields: OdooFieldMap,
  taxIds: Record<21, number | undefined>,
  date: string,
) {
  const existing = await client.call<Array<{ id: number }>>("purchase.order.line", "search_read", {
    domain: [
      ["order_id", "=", orderId],
      ["name", "=", line.description],
    ],
    fields: ["id"],
    limit: 1,
  });
  if (existing[0]) return;
  await addLine(orderId, line, productFields, lineFields, taxIds, date);
}

async function addLine(
  orderId: number,
  line: Line,
  productFields: OdooFieldMap,
  lineFields: OdooFieldMap,
  taxIds: Record<21, number | undefined>,
  date: string,
) {
  const productId = line.productId ?? (await ensureProduct(line.productName || line.description, productFields));
  const vals: Record<string, unknown> = {
    order_id: orderId,
    product_id: productId,
    name: line.description,
    product_qty: line.quantity,
    price_unit: line.unitPrice,
  };
  setIfWritable(lineFields, vals, "date_planned", `${date} 12:00:00`);
  setIfWritable(lineFields, vals, "product_uom", 1);
  if (lineFields.tax_ids && !lineFields.tax_ids.readonly) {
    vals.tax_ids = [[6, 0, taxIdsForLine(line.taxRate ?? 21, taxIds)]];
  }
  await client.call<number[] | number>("purchase.order.line", "create", { vals_list: [vals] });
}

async function ensurePartner(vendor: Vendor, fields: OdooFieldMap): Promise<number> {
  if (vendor.id) return vendor.id;
  if (vendor.vat) {
    const byVat = await client.call<Array<{ id: number; name?: string }>>("res.partner", "search_read", {
      domain: [["vat", "ilike", vendor.vat]],
      fields: ["id", "name", "vat"],
      limit: 1,
    });
    if (byVat[0]) return byVat[0].id;
  }
  const byName = await client.call<Array<{ id: number; name?: string }>>("res.partner", "search_read", {
    domain: [["name", "ilike", vendor.name]],
    fields: ["id", "name", "vat"],
    limit: 1,
  });
  if (byName[0]) return byName[0].id;
  if (!vendor.createIfMissing) {
    throw new Error(`Proveedor no encontrado: ${vendor.name}`);
  }
  const vals: Record<string, unknown> = { name: vendor.name };
  setIfWritable(fields, vals, "vat", vendor.vat);
  setIfWritable(fields, vals, "supplier_rank", 1);
  const created = await client.call<number[] | number>("res.partner", "create", { vals_list: [vals] });
  return Array.isArray(created) ? created[0] : created;
}

async function updateVatIfMissing(partnerId: number, vat: string | undefined, fields: OdooFieldMap) {
  if (!vat || !fields.vat || fields.vat.readonly) return;
  const rows = await client.call<Array<{ id: number; vat?: string | false }>>("res.partner", "search_read", {
    domain: [["id", "=", partnerId]],
    fields: ["id", "vat"],
    limit: 1,
  });
  if (!rows[0]?.vat) {
    await client.call<boolean>("res.partner", "write", { ids: [partnerId], vals: { vat } });
  }
}

async function ensureProduct(name: string, fields: OdooFieldMap): Promise<number> {
  const existing = await client.call<Array<{ id: number; name?: string }>>("product.product", "search_read", {
    domain: [["name", "=ilike", name]],
    fields: ["id", "name"],
    limit: 1,
  });
  if (existing[0]) return existing[0].id;

  const vals: Record<string, unknown> = { name };
  setIfWritable(fields, vals, "purchase_ok", true);
  setIfWritable(fields, vals, "sale_ok", false);
  const created = await client.call<number[] | number>("product.product", "create", { vals_list: [vals] });
  return Array.isArray(created) ? created[0] : created;
}

async function attachIfMissing(orderId: number, imagePath: string, fields: OdooFieldMap) {
  const name = `Imagen compra - ${basename(imagePath)}`;
  const existing = await client.call<Array<{ id: number }>>("ir.attachment", "search_read", {
    domain: [
      ["res_model", "=", "purchase.order"],
      ["res_id", "=", orderId],
      ["name", "=", name],
    ],
    fields: ["id"],
    limit: 1,
  });
  if (existing[0]) return;

  const vals: Record<string, unknown> = {
    name,
    res_model: "purchase.order",
    res_id: orderId,
    datas: readFileSync(imagePath).toString("base64"),
  };
  for (const field of Object.keys(vals)) {
    if (!fields[field] || fields[field].readonly) delete vals[field];
  }
  await client.call<number[] | number>("ir.attachment", "create", { vals_list: [vals] });
}

async function findTaxIds(): Promise<Record<21, number | undefined>> {
  const rows = await client.call<Array<{ id: number; name: string; amount: number }>>("account.tax", "search_read", {
    domain: [
      ["type_tax_use", "=", "purchase"],
      ["amount", "=", 21],
      ["name", "=", "21% G"],
    ],
    fields: ["id", "name", "amount"],
    limit: 1,
  });
  return { 21: rows[0]?.id };
}

function taxIdsForLine(rate: 0 | 21, taxIds: Record<21, number | undefined>): number[] {
  if (rate === 0) return [];
  return taxIds[21] ? [taxIds[21]] : [];
}

function setIfWritable(fields: OdooFieldMap, vals: Record<string, unknown>, field: string, value: unknown) {
  if (value !== undefined && fields[field] && !fields[field].readonly) {
    vals[field] = value;
  }
}

function writableFields(fields: string[]): OdooFieldMap {
  return Object.fromEntries(fields.map((field) => [field, { readonly: false }]));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
