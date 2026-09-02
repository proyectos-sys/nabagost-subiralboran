import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { OdooJson2Client, type OdooFieldMap } from "../src/purchase-image/odoo-json2";

type Line = {
  productId?: number;
  productName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type Doc = {
  file: string;
  vendor: {
    id?: number;
    name: string;
    vat?: string;
    createIfMissing?: boolean;
  };
  date: string;
  reference: string;
  lines: Line[];
};

const imageDir = "C:/Users/david/Escritorio/NAVAGOST/navagost-agente-main/iamgenesfacutragastos";

const P = {
  DUDA: 322,
  CORTE_LASER: 360,
  DESARROLLO: 396,
  SERVICIO_LOGISTICO: 71,
  TUBO_30_30_2: 388,
  TUBO_60_60_2: 250,
  CHAPA_2000_1000_2: 108,
  PLETINA_100_6: 393,
  PLETINA_120_6: 392,
  PLETINA_40_6: 394,
  ANGULO_NEGRO_40: 395,
  TRAMEX_1000_1000: 378,
  TRAMEX_2000_1000: 379,
  ROTULADOR_BLANCO: 400,
  ROTULADOR_NEGRO: 402,
  TORNILLO_571_6_70: 401,
  ARANDELA_9021_M6: 403,
  BROCA_HSS_12_25: 404,
  RUEDA_80: 371,
  RUEDA_80_FRENO: 370,
  TACO_LARGO_10_120: 407,
  TORNILLO_7504_4_2_32: 409,
  TORNILLO_INVIOLABLE_M7_70: 318,
  BROCA_PARED_10_200: 408,
  DISCO_LAMINAS_60: 414,
  TACO_SX_10_50: 319,
  FLEXOMETRO_5M: 412,
  FLEXOMETRO_3M: 413,
  ARANDELA_9021_M8: 418,
  TORNILLO_933_M8_30: 420,
  TUERCA_934_M08: 419,
  PINTURA_NEGRA: 105,
  PINTURA: 51,
  PISTOLA_GRAVEDAD: 344,
  ESMALTE_BLANCO_4L: 303,
  MOTOR: 56,
  DIESEL: 211,
  GASOLINA: 311,
  AGUA: 411,
  COCA_COLA: 415,
  WINSTON: 416,
};

const docs: Doc[] = [
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.36 (1).jpeg",
    vendor: { id: 88, name: "HIERROS Y METALES CASTELLON S.L.", vat: "B12836466" },
    date: "2026-07-20",
    reference: "AV26/5513",
    lines: [
      { productId: P.PLETINA_100_6, description: "PLETINA CALIBRADA 100X6", quantity: 120, unitPrice: 2.09 },
      { productId: P.PLETINA_120_6, description: "PLETINA CALIBRADA 120X6", quantity: 144, unitPrice: 2.39 },
      { productId: P.SERVICIO_LOGISTICO, description: "SERVICIO LOGISTICO", quantity: 1, unitPrice: 15 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.36 (2).jpeg",
    vendor: { id: 88, name: "HIERROS Y METALES CASTELLON S.L.", vat: "B12836466" },
    date: "2026-07-16",
    reference: "AV26/5441",
    lines: [
      { productId: P.ANGULO_NEGRO_40, description: "ANGULO NEGRO 40", quantity: 32, unitPrice: 0.99 },
      { productId: P.PLETINA_40_6, description: "PLETINA NEGRA 40X6", quantity: 24, unitPrice: 1.05 },
      { productId: P.SERVICIO_LOGISTICO, description: "SERVICIO LOGISTICO", quantity: 1, unitPrice: 15 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.36 (3).jpeg",
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-08",
    reference: "3921-26",
    lines: [
      { productId: P.CORTE_LASER, description: "BRIDA DIAMETRO 750 ESP. 5MM", quantity: 9, unitPrice: 41.46 },
      { productId: P.DESARROLLO, description: "DESARROLLO D750 L1000", quantity: 16, unitPrice: 74.04 },
      { productId: P.DESARROLLO, description: "DESARROLLO CODO 90 D750", quantity: 1, unitPrice: 103.74 },
      { productId: P.CORTE_LASER, description: "CHAPA 500X350X2", quantity: 2, unitPrice: 5.9 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.36.jpeg",
    vendor: { id: 88, name: "HIERROS Y METALES CASTELLON S.L.", vat: "B12836466" },
    date: "2026-07-20",
    reference: "AV26/5531",
    lines: [{ productId: P.TUBO_30_30_2, description: "TUBO GALVA 30X30X2 SUS MEDIOS", quantity: 12, unitPrice: 2.98 }],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.37 (1).jpeg",
    vendor: { id: 88, name: "HIERROS Y METALES CASTELLON S.L.", vat: "B12836466" },
    date: "2026-07-08",
    reference: "AV26/5197",
    lines: [
      { productId: P.TRAMEX_1000_1000, description: "TRAMEX GALVA 1000X1000 30X2", quantity: 1, unitPrice: 38 },
      { productId: P.TRAMEX_2000_1000, description: "TRAMEX GALVA 2000X1000 30X2", quantity: 2, unitPrice: 65 },
      { productId: P.CHAPA_2000_1000_2, description: "CHAPA NEGRA 2000X1000X2", quantity: 32, unitPrice: 1.07 },
      { productId: P.ANGULO_NEGRO_40, description: "ANGULO NEGRO 40", quantity: 16, unitPrice: 0.99 },
      { productId: P.SERVICIO_LOGISTICO, description: "SERVICIO LOGISTICO", quantity: 1, unitPrice: 34 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.37 (2).jpeg",
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-08",
    reference: "ALV/140902",
    lines: [
      { productId: P.TORNILLO_571_6_70, description: "TORNILLO DIN 571 ZC 6 X 70", quantity: 100, unitPrice: 0.04 },
      { productId: P.ARANDELA_9021_M6, description: "ARANDELA DIN 9021 M-6 ZINCADO", quantity: 20, unitPrice: 0.009 },
      { productId: P.ROTULADOR_BLANCO, description: "ROTULADOR EDDING BLANCO", quantity: 2, unitPrice: 4.49 },
      { productId: P.ROTULADOR_NEGRO, description: "ROTULADOR EDDING 3000 NEGRO", quantity: 2, unitPrice: 2.74 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.37 (3).jpeg",
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-07",
    reference: "ALV/140801",
    lines: [{ productId: P.BROCA_HSS_12_25, description: "BROCA HSS DIAM 12,25", quantity: 1, unitPrice: 7.55 }],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.37 (4).jpeg",
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-06",
    reference: "ALV/140726",
    lines: [
      { productId: P.RUEDA_80, description: "RUEDA INOX DIAM 80", quantity: 2, unitPrice: 26.95 },
      { productId: P.RUEDA_80_FRENO, description: "RUEDA INOX DIAM 80 FRENO", quantity: 2, unitPrice: 32.95 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.37.jpeg",
    vendor: { id: 88, name: "HIERROS Y METALES CASTELLON S.L.", vat: "B12836466" },
    date: "2026-07-09",
    reference: "AV26/5245",
    lines: [
      { productId: P.TUBO_60_60_2, description: "TUBO CUADRADO 60X60X2", quantity: 30, unitPrice: 4.4 },
      { productId: P.SERVICIO_LOGISTICO, description: "SERVICIO LOGISTICO", quantity: 1, unitPrice: 15 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.38 (1).jpeg",
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-03",
    reference: "ALV/140659",
    lines: [
      { productId: P.TACO_LARGO_10_120, description: "TACO LARGO MQL-ST 10 X 120", quantity: 7, unitPrice: 0.95 },
      { productId: P.TORNILLO_7504_4_2_32, description: "TORNILLO DIN 7504-N M-4,2 X 32", quantity: 10, unitPrice: 0.05 },
      { productId: P.TORNILLO_INVIOLABLE_M7_70, description: "TORNILLO INVIOLABLE M7X70", quantity: 10, unitPrice: 0.1993 },
      { productId: P.BROCA_PARED_10_200, description: "BROCA PARED PROFESIONAL DIAM 10 X 200 MM", quantity: 1, unitPrice: 4.7 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.38 (2).jpeg",
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-01",
    reference: "ALV/140575",
    lines: [{ productId: P.DISCO_LAMINAS_60, description: "DISCO LAMINAR CERAMICO 125 X 22,23 GR 60 INOX", quantity: 20, unitPrice: 11.683 }],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.38.jpeg",
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-06",
    reference: "ALV/140749",
    lines: [
      { productId: P.DUDA, description: "DISCO CORTE 3M 125 X 1", quantity: 50, unitPrice: 0.98 },
      { productId: P.DISCO_LAMINAS_60, description: "DISCO LAMINAS 125 X 22 GRANO 60", quantity: 20, unitPrice: 1.97 },
      { productId: P.TACO_SX_10_50, description: "TACO SX 10 X 50", quantity: 50, unitPrice: 0.09 },
      { productId: P.FLEXOMETRO_5M, description: "FLEXOMETRO CARCASA ERGONOMICA MOD. PROERGO 5MX19MM", quantity: 1, unitPrice: 7.94 },
      { productId: P.FLEXOMETRO_3M, description: "FLEXOMETRO CARCASA ERGONOMICA MOD. PROERGO 3M X 16MM", quantity: 2, unitPrice: 5.7 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.38 (3).jpeg",
    vendor: { name: "MERCADONA S.A.", vat: "A46103834", createIfMissing: true },
    date: "2026-07-02",
    reference: "4385-010-512201",
    lines: [{ productId: P.AGUA, description: "AGUA MINERAL 1L P-6", quantity: 3, unitPrice: 2.183333 }],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.38 (4).jpeg",
    vendor: { id: 94, name: "GRUPO MAICAS PEIRO SL", vat: "B12819017" },
    date: "2026-07-07",
    reference: "03126FI031000000870",
    lines: [{ productId: P.GASOLINA, description: "S PLOMO 95 ACTIVE 18,88 L", quantity: 1, unitPrice: 24.02 }],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.39 (1).jpeg",
    vendor: { id: 94, name: "GRUPO MAICAS PEIRO SL", vat: "B12819017" },
    date: "2026-07-08",
    reference: "03126FI031000000872",
    lines: [
      { productId: P.COCA_COLA, description: "COCA COLA LATA 33 CL", quantity: 2, unitPrice: 1.528926 },
      { productId: P.WINSTON, description: "WINSTON SELECCION 100s", quantity: 1, unitPrice: 4.46281 },
      { productId: P.DIESEL, description: "DIESEL ACTIVE 31,47 L", quantity: 1, unitPrice: 41.33 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.39 (2).jpeg",
    vendor: { id: 94, name: "GRUPO MAICAS PEIRO SL", vat: "B12819017" },
    date: "2026-07-17",
    reference: "03126FI031000000916",
    lines: [{ productId: P.DIESEL, description: "DIESEL ACTIVE 29,26 L", quantity: 1, unitPrice: 41.32 }],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.39 (3).jpeg",
    vendor: { id: 21, name: "COSUMSE SL", vat: "B12610333" },
    date: "2026-07-21",
    reference: "ALV/141433",
    lines: [
      { productId: P.ARANDELA_9021_M8, description: "ARANDELA DIN 9021 M-8 ZINCADO", quantity: 2000, unitPrice: 0.025 },
      { productId: P.TORNILLO_933_M8_30, description: "TORNILLO DIN 933 M 8 X 30 ZINC", quantity: 1000, unitPrice: 0.0877 },
      { productId: P.TUERCA_934_M08, description: "TUERCA DIN 934 M08 ZINCADO", quantity: 1000, unitPrice: 0.013 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.39 (4).jpeg",
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-16",
    reference: "4121-26",
    lines: [
      { productId: P.DESARROLLO, description: "DESARROLLO CONO D580 d400 L500", quantity: 1, unitPrice: 39.52 },
      { productId: P.DESARROLLO, description: "DESARROLLO CONO D700 d580 L500", quantity: 1, unitPrice: 48.13 },
      { productId: P.DESARROLLO, description: "DESARROLLO CONO D750 d700 L500", quantity: 1, unitPrice: 46.24 },
      { productId: P.DESARROLLO, description: "DESARROLLO TUBO D400 L1000", quantity: 2, unitPrice: 41.11 },
      { productId: P.DESARROLLO, description: "DESARROLLO TUBO D580 L1000", quantity: 14, unitPrice: 71.81 },
      { productId: P.DESARROLLO, description: "DESARROLLO TUBO D700 L1000", quantity: 16, unitPrice: 85.04 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.39 (5).jpeg",
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-20",
    reference: "4154-26",
    lines: [
      { productId: P.CORTE_LASER, description: "BRIDA D856-d756", quantity: 2, unitPrice: 38.56 },
      { productId: P.CORTE_LASER, description: "BRIDA D804-d704", quantity: 10, unitPrice: 32.57 },
      { productId: P.CORTE_LASER, description: "BRIDA D684-d584", quantity: 12, unitPrice: 27.83 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.39.jpeg",
    vendor: { id: 28, name: "MAYENCOLORS SL.", vat: "B12871281" },
    date: "2026-07-09",
    reference: "T26.0001741",
    lines: [{ productId: P.PINTURA_NEGRA, description: "PINTYPLUS EVOLUTION 520CC RAL 9005 MATT JET BLACK", quantity: 1, unitPrice: 4.41 }],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.40 (1).jpeg",
    vendor: { id: 32, name: "PROINCER GLOBAL PROYECTS SL.", vat: "B12950895" },
    date: "2026-07-16",
    reference: "4165-26",
    lines: [{ productId: P.CORTE_LASER, description: "BRIDA D856-d756", quantity: 4, unitPrice: 42.28 }],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.40 (2).jpeg",
    vendor: { id: 45, name: "ASUCER ACEROS Y SUMINISTROS SLL", vat: "B12504437" },
    date: "2026-07-17",
    reference: "J26/011701",
    lines: [
      { productName: "CHAPA INOX 3000 X 1500 X 2", description: "CHAPA INOX 304 2B 3000X1500X2", quantity: 72, unitPrice: 3.18 },
      { productId: P.SERVICIO_LOGISTICO, description: "PORTES", quantity: 1, unitPrice: 10 },
    ],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.40 (3).jpeg",
    vendor: { id: 38, name: "UNI-ROL CASTELLON SA", vat: "A12387650" },
    date: "2026-07-16",
    reference: "A26-3278",
    lines: [{ productId: P.MOTOR, description: "MOTOR CANTONI T.90L 1,9/2,7cv 1500/3000rpm B14 (24/140) 400v", quantity: 1, unitPrice: 466.23 }],
  },
  {
    file: "WhatsApp Image 2026-07-21 at 14.16.40.jpeg",
    vendor: { name: "METALPAINT SANDBLASTING S.L.", vat: "B13754494", createIfMissing: true },
    date: "2026-07-07",
    reference: "A26/000849",
    lines: [{ productId: P.PINTURA_NEGRA, description: "CONJUNTO BARANDILLAS + PASAMANOS LACADO NEGRO MATE", quantity: 1, unitPrice: 96.5 }],
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
  const taxId = await findTaxId();
  const results: Array<Record<string, unknown>> = [];

  for (const doc of docs) {
    const partnerId = await ensurePartner(doc.vendor, partnerFields);
    await updateVatIfMissing(partnerId, doc.vendor.vat, partnerFields);
    const existing = await client.call<Array<{ id: number; name?: string }>>("purchase.order", "search_read", {
      domain: [
        ["partner_id", "=", partnerId],
        ["partner_ref", "=", doc.reference],
      ],
      fields: ["id", "name"],
      limit: 1,
    });
    if (existing[0]) {
      results.push({ reference: doc.reference, status: "skip", purchase: existing[0].name, id: existing[0].id });
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
      if (taxId) setIfWritable(lineFields, vals, "taxes_id", [[6, 0, [taxId]]]);
      await client.call<number[] | number>("purchase.order.line", "create", { vals_list: [vals] });
    }

    await attach(orderId, join(imageDir, doc.file), attachmentFields);
    const created = (await client.call<Array<{ id: number; name?: string; amount_total?: number }>>("purchase.order", "search_read", {
      domain: [["id", "=", orderId]],
      fields: ["id", "name", "amount_total"],
      limit: 1,
    }))[0];
    results.push({ reference: doc.reference, status: "created", purchase: created?.name, id: orderId, total: created?.amount_total });
    console.log(`CREATED ${doc.reference}: ${created?.name} ${created?.amount_total ?? ""}`);
    await sleep(900);
  }

  console.log(JSON.stringify(results, null, 2));
}

async function ensurePartner(vendor: Doc["vendor"], fields: OdooFieldMap): Promise<number> {
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

async function attach(orderId: number, imagePath: string, fields: OdooFieldMap) {
  const vals: Record<string, unknown> = {
    name: `Imagen compra - ${basename(imagePath)}`,
    res_model: "purchase.order",
    res_id: orderId,
    datas: readFileSync(imagePath).toString("base64"),
  };
  for (const field of Object.keys(vals)) {
    if (!fields[field] || fields[field].readonly) delete vals[field];
  }
  await client.call<number[] | number>("ir.attachment", "create", { vals_list: [vals] });
}

async function findTaxId(): Promise<number | undefined> {
  const rows = await client.call<Array<{ id: number }>>("account.tax", "search_read", {
    domain: [
      ["amount", "=", 21],
      ["type_tax_use", "=", "purchase"],
    ],
    fields: ["id"],
    limit: 1,
  });
  return rows[0]?.id;
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
