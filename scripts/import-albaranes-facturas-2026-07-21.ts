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
};

const imageDir = "C:/Users/david/Escritorio/NAVAGOST/navagost-agente-main/imagenesalbaranfacuras";

const P = {
  DUDA: 322,
  CORTE_LASER: 360,
  SERVICIO_LOGISTICO: 71,
  TRANSPORTE: 85,
  TUBO_40_40_15: 73,
  TUBO_50_50_2: 350,
  TAPON_40_40: 86,
  TAPON_60_60: 442,
  TAPON_TUBO_40: 156,
  TAPON_TUBO_50: 157,
  PERNIO_10_60: 40,
  DESACHEM: 243,
  TAMIZ_DESACHEM: 244,
  DISCO_LAMINAS_40: 215,
  ESMALTE_RAL_7032_4L: 367,
};

const docs: Doc[] = [
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.15 (1).jpeg"],
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-15",
    reference: "ALV/141164",
    expectedTotal: 11.8,
    lines: [{ productName: "PORTATUBOS", description: "PORTA TUBOS SB250A", quantity: 5, unitPrice: 1.95 }],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.15 (2).jpeg"],
    vendor: { name: "TALLERES JUMAVI S.L.", createIfMissing: true },
    date: "2026-07-10",
    reference: "5769",
    expectedTotal: 180,
    lines: [
      {
        productName: "TRABAJO DE CILINDRADO Y PUNTEADO",
        description: "TRABAJOS REALIZADOS EN CILINDRAR Y PUNTEAR 8 TUBOS DIAMETRO 750X3 MM",
        quantity: 1,
        unitPrice: 180,
        taxRate: 0,
      },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.15 (3).jpeg"],
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-10",
    reference: "ALV/141000",
    expectedTotal: 376.41,
    lines: [
      { productId: P.TAPON_40_40, description: "TAPON PLASTICO 40 X 40", quantity: 4, unitPrice: 0.1 },
      { productName: "LLAVE IMPACTO 18V", description: "LLAVE IMPACTO BL 18V 330 NM 1/2", quantity: 1, unitPrice: 224.9 },
      { productId: P.TAPON_60_60, description: "TAPON PLASTICO 60 X 60", quantity: 12, unitPrice: 0.32 },
      { productId: P.TAPON_TUBO_40, description: "TAPON PLASTICO PARA TUBO 40", quantity: 2, unitPrice: 0.21 },
      { productName: "BASE MULTIPLE 3 TOMAS", description: "BASE MULTIPLE 3 TOMAS", quantity: 1, unitPrice: 6.22 },
      { productName: "JUEGO VASOS IMPACTO 1/2", description: "JUEGO VASOS IMP. 1/2 20 PIEZAS", quantity: 1, unitPrice: 75.3 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.15 (4).jpeg"],
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-10",
    reference: "3978-26",
    expectedTotal: 277.19,
    lines: [
      { productId: P.CORTE_LASER, description: "CHAPAS MESAS 2500X1106X2", quantity: 2, unitPrice: 53.34 },
      { productId: P.CORTE_LASER, description: "CHAPAS MESAS 2500X550X2", quantity: 2, unitPrice: 30.6 },
      { productId: P.CORTE_LASER, description: "CHAPAS MESAS 2500X550X2", quantity: 2, unitPrice: 30.6 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.15.jpeg"],
    vendor: { name: "TALLERES JUMAVI S.L.", createIfMissing: true },
    date: "2026-07-16",
    reference: "5776",
    expectedTotal: 135,
    lines: [
      {
        productName: "TRABAJO DE ENROLLADO Y PUNTEADO",
        description: "TRABAJOS EN ENROLLAR Y PUNTEAR 6 TUBOS DIAMETRO 750 DE 3 MM",
        quantity: 1,
        unitPrice: 135,
        taxRate: 0,
      },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.16 (1).jpeg"],
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-10",
    reference: "3976-26",
    expectedTotal: 228.64,
    lines: [
      { productId: P.CORTE_LASER, description: "BRIDA DIAMETRO 120", quantity: 16, unitPrice: 3.96 },
      { productId: P.CORTE_LASER, description: "BRIDA DIAMETRO 200", quantity: 20, unitPrice: 6.28 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.16 (2).jpeg"],
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-14",
    reference: "ALV/141105",
    expectedTotal: 123.78,
    lines: [
      { productName: "PERFIL CAUCHO NATURAL ADHESIVO", description: "PERFIL DE CAUCHO NATURAL ADHESIVO 30 X 05MM", quantity: 50, unitPrice: 0.81 },
      { productId: P.PERNIO_10_60, description: "PERNIO PALA 10 X 60 X 2", quantity: 12, unitPrice: 0.35 },
      { productName: "CIERRE REGULABLE ACERO ZINCADO", description: "CIERRE + ENGANCHE REGULABLE 2500 N ACERO ZINCADO", quantity: 12, unitPrice: 4.8 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.16.jpeg"],
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-10",
    reference: "3977-26",
    expectedTotal: 48.11,
    lines: [
      { productId: P.CORTE_LASER, description: "VALONA DIAMETRO 767,5", quantity: 2, unitPrice: 11.87 },
      { productId: P.CORTE_LASER, description: "VALONA DIAMETRO 313,5", quantity: 6, unitPrice: 0.87 },
      { productId: P.CORTE_LASER, description: "VALONA DIAMETRO 214,5", quantity: 8, unitPrice: 1.35 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.17 (1).jpeg"],
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-17",
    reference: "ALV/141315",
    expectedTotal: 10.59,
    lines: [
      { productId: P.DESACHEM, description: "DESACHEM PSF. 410ML", quantity: 1, unitPrice: 7.5 },
      { productId: P.TAMIZ_DESACHEM, description: "TAMIZ DESA-CHEM 12 X 80", quantity: 5, unitPrice: 0.25 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.17 (2).jpeg"],
    vendor: { id: 88, name: "HIERROS Y METALES CASTELLON S.L.", vat: "B12836466" },
    date: "2026-07-15",
    reference: "AV26/5410",
    expectedTotal: 421.08,
    lines: [
      { productName: "TUBO REDONDO 120 X 3", description: "TUBO REDONDO 120X3 - 18 MT", quantity: 18, unitPrice: 18.5 },
      { productId: P.SERVICIO_LOGISTICO, description: "SERVICIO LOGISTICO", quantity: 1, unitPrice: 15 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.17.jpeg", "WhatsApp Image 2026-07-21 at 15.31.18.jpeg"],
    vendor: { name: "DATACOL HISPANIA S.L.", vat: "B18884718", createIfMissing: true },
    date: "2026-07-07",
    reference: "100057404",
    expectedTotal: 56.33,
    lines: [{ productId: P.DISCO_LAMINAS_40, description: "DISCO LAM.CONIC STANDARD LINE 125MM P40", quantity: 19, unitPrice: 2.45 }],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.18 (1).jpeg"],
    vendor: { name: "MESSER IBERICA DE GASES S.A.U.", vat: "A08255317", createIfMissing: true },
    date: "2026-07-20",
    reference: "6501234969",
    expectedTotal: 124.61,
    lines: [
      { productName: "GAS FERROLINO", description: "FERROLINO C12X2 F50 P300", quantity: 1, unitPrice: 85.5 },
      { productId: P.TRANSPORTE, description: "TRANSPORTE POR BOTELLA", quantity: 1, unitPrice: 11 },
      { productName: "CUOTA AMBIENTAL", description: "CUOTA AMBIENTAL", quantity: 1, unitPrice: 3.49 },
      { productId: P.TRANSPORTE, description: "ADR", quantity: 1, unitPrice: 2.99 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.18 (2).jpeg"],
    vendor: { id: 30, name: "DICOLASER SLU", vat: "B12555769" },
    date: "2026-07-03",
    reference: "002343",
    expectedTotal: 55.37,
    lines: [{ productId: P.CORTE_LASER, description: "CORTE DE PIEZA EN A.INOX. PLACA 107X86", quantity: 8, unitPrice: 5.72 }],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.18 (3).jpeg"],
    vendor: { id: 30, name: "DICOLASER SLU", vat: "B12555769" },
    date: "2026-07-13",
    reference: "002458",
    expectedTotal: 454.04,
    lines: [
      { productId: P.CORTE_LASER, description: "CORTE DE PIEZA 6X100X120", quantity: 48, unitPrice: 2.85 },
      { productId: P.CORTE_LASER, description: "CORTE DE PIEZA 6X200X200", quantity: 12, unitPrice: 19.87 },
    ],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.19 (1).jpeg"],
    vendor: { id: 28, name: "MAYENCOLORS SL.", vat: "B12871281" },
    date: "2026-07-15",
    reference: "026.0007023",
    expectedTotal: 105.79,
    lines: [{ productId: P.ESMALTE_RAL_7032_4L, description: "RAL 7032 ESMALTE S/R 4L", quantity: 3, unitPrice: 29.143333 }],
  },
  {
    files: ["WhatsApp Image 2026-07-21 at 15.31.19.jpeg"],
    vendor: { id: 88, name: "HIERROS Y METALES CASTELLON S.L.", vat: "B12836466" },
    date: "2026-07-06",
    reference: "AV26/5111",
    expectedTotal: 43.27,
    lines: [
      { productId: P.TUBO_50_50_2, description: "TUBO CUADRADO 50X50X2 - 60 MT", quantity: 12, unitPrice: 2.98 },
      { productId: P.SERVICIO_LOGISTICO, description: "SERVICIO LOGISTICO", quantity: 1, unitPrice: 0 },
    ],
  },
];

const client = new OdooJson2Client();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const [partnerFields, productFields, orderFields, lineFields, attachmentFields] = await Promise.all([
    client.fieldsGet("res.partner"),
    client.fieldsGet("product.product"),
    client.fieldsGet("purchase.order"),
    client.fieldsGet("purchase.order.line"),
    client.fieldsGet("ir.attachment"),
  ]);
  const taxIds = await findTaxIds();
  const results: Array<Record<string, unknown>> = [];

  for (const doc of docs) {
    const partnerId = await ensurePartner(doc.vendor, partnerFields);
    await updateVatIfMissing(partnerId, doc.vendor.vat, partnerFields);

    const existing = await client.call<Array<{ id: number; name?: string; amount_total?: number }>>("purchase.order", "search_read", {
      domain: [
        ["partner_id", "=", partnerId],
        ["partner_ref", "=", doc.reference],
      ],
      fields: ["id", "name", "amount_total"],
      limit: 1,
    });
    if (existing[0]) {
      for (const file of doc.files) {
        await attachIfMissing(existing[0].id, join(imageDir, file), attachmentFields);
      }
      results.push({ reference: doc.reference, status: "skip", purchase: existing[0].name, id: existing[0].id, total: existing[0].amount_total });
      console.log(`SKIP ${doc.reference}: ${existing[0].name}`);
      continue;
    }

    const orderVals: Record<string, unknown> = { partner_id: partnerId };
    setIfWritable(orderFields, orderVals, "partner_ref", doc.reference);
    setIfWritable(orderFields, orderVals, "date_order", `${doc.date} 12:00:00`);
    const orderCreated = await client.call<number[] | number>("purchase.order", "create", { vals_list: [orderVals] });
    const orderId = Array.isArray(orderCreated) ? orderCreated[0] : orderCreated;

    for (const line of doc.lines) {
      const productId = line.productId ?? (await ensureProduct(line.productName || line.description, productFields));
      const vals: Record<string, unknown> = {
        order_id: orderId,
        product_id: productId,
        name: line.description,
        product_qty: line.quantity,
        price_unit: line.unitPrice,
      };
      setIfWritable(lineFields, vals, "date_planned", `${doc.date} 12:00:00`);
      setIfWritable(lineFields, vals, "product_uom", 1);
      if (lineFields.tax_ids && !lineFields.tax_ids.readonly) {
        vals.tax_ids = [[6, 0, taxIdsForLine(line.taxRate ?? 21, taxIds)]];
      }
      await client.call<number[] | number>("purchase.order.line", "create", { vals_list: [vals] });
    }

    for (const file of doc.files) {
      await attachIfMissing(orderId, join(imageDir, file), attachmentFields);
    }

    const created = (await client.call<Array<{ id: number; name?: string; amount_total?: number }>>("purchase.order", "search_read", {
      domain: [["id", "=", orderId]],
      fields: ["id", "name", "amount_total"],
      limit: 1,
    }))[0];
    const diff = doc.expectedTotal === undefined || created?.amount_total === undefined ? 0 : Number((created.amount_total - doc.expectedTotal).toFixed(2));
    results.push({ reference: doc.reference, status: "created", purchase: created?.name, id: orderId, total: created?.amount_total, expectedTotal: doc.expectedTotal, diff });
    console.log(`CREATED ${doc.reference}: ${created?.name} total=${created?.amount_total ?? ""} diff=${diff}`);
    await sleep(900);
  }

  console.log(JSON.stringify(results, null, 2));
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
