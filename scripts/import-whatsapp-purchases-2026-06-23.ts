import { basename } from "node:path";
import { readFileSync } from "node:fs";
import { OdooJson2Client, many2OneId, type OdooFieldMap, type OdooMany2One } from "../src/purchase-image/odoo-json2";
import { cleanReusableProductName, productLookupQueries, scoreProductMatch } from "../src/purchase-image/purchase-service";

type DocLine = {
  code?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

type Doc = {
  vendorName: string;
  vendorVat?: string;
  date: string;
  reference: string;
  lines: DocLine[];
  attachments: string[];
};

type Partner = { id: number; name?: string; vat?: string };
type Product = { id: number; name?: string; display_name?: string; default_code?: string; uom_id?: OdooMany2One; uom_po_id?: OdooMany2One };
type Purchase = { id: number; name?: string; partner_ref?: string; state?: string; amount_untaxed?: number; amount_total?: number };
type Tax = { id: number; amount?: number; name?: string };

const client = new OdooJson2Client();
const download = "C:\\Users\\david\\Downloads";

const docs: Doc[] = [
  {
    vendorName: "HIERROS Y METALES CASTELLON S.L.",
    vendorVat: "B12836466",
    date: "2026-06-22",
    reference: "ALBARAN AV26/4777",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.48.jpeg`],
    lines: [
      { code: "001101050", description: "TUBO CUADRADO 40x40x1,5", quantity: 12, unitPrice: 1.99, taxRate: 0 },
      { code: "001102126", description: "TUBO RECTANGULAR 80x40x1,5", quantity: 24, unitPrice: 3.2, taxRate: 0 },
      { code: "001101051", description: "TUBO CUADRADO 40x40x2", quantity: 36, unitPrice: 2.9, taxRate: 0 },
      { code: "PORTE", description: "SERVICIO LOGISTICO", quantity: 1, unitPrice: 15, taxRate: 0 },
    ],
  },
  {
    vendorName: "PROINCER GLOBAL PROYECTS S.L.",
    vendorVat: "B12950895",
    date: "2026-06-23",
    reference: "ALBARAN 3494-26 / PEDIDO 3295-26",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.49 (1).jpeg`],
    lines: [
      { code: "0726TUB0009", description: "TUBO 60x60x2 L1955 A.C.", quantity: 2, unitPrice: 25.43, taxRate: 21 },
      { code: "0726TUB0010", description: "TUBO 60x20x2 L1955 A.C.", quantity: 1, unitPrice: 20.45, taxRate: 21 },
      { code: "0726TUB0011", description: "TUBO 60x20x2 L2655 2.0 A.C.", quantity: 1, unitPrice: 21.77, taxRate: 21 },
      { code: "0726TUB0012", description: "TUBO 60x20x2 L2635 A.C.", quantity: 1, unitPrice: 23.29, taxRate: 21 },
      { code: "0726TUB0013", description: "TUBO 60x20x2 L2610 A.C.", quantity: 1, unitPrice: 25.2, taxRate: 21 },
      { code: "0726TUB0014", description: "TUBO 60x20x2 L2650 A.C.", quantity: 2, unitPrice: 19.25, taxRate: 21 },
    ],
  },
  {
    vendorName: "DICOLASER S.L.U.",
    vendorVat: "B12555769",
    date: "2026-06-09",
    reference: "ALBARAN 002000",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.49 (2).jpeg`],
    lines: [
      { code: "228412", description: "CORTE DE PIEZA CONJUNTO DESARROLLO DIAMETRO 600 ALTO 60", quantity: 2, unitPrice: 42.12, taxRate: 21 },
    ],
  },
  {
    vendorName: "COSUMSE SL",
    vendorVat: "B12610333",
    date: "2026-06-10",
    reference: "ALBARAN ALV/139681",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.49 (3).jpeg`],
    lines: [{ code: "SPGALVF", description: "SPRAY GALVANIZADO F93 400 M.L.", quantity: 2, unitPrice: 4.22, taxRate: 21 }],
  },
  {
    vendorName: "PROINCER GLOBAL PROYECTS S.L.",
    vendorVat: "B12950895",
    date: "2026-06-19",
    reference: "ALBARAN 3495-26 / PEDIDO 3337-26",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.49.jpeg`],
    lines: [
      { code: "0726TUB0009", description: "TUBO 60x60x2 L1955 A.C.", quantity: 2, unitPrice: 25.43, taxRate: 21 },
      { code: "0726TUB0015", description: "TUBO 60x20x2 L2645 3.0 A.C.", quantity: 1, unitPrice: 22.66, taxRate: 21 },
      { code: "0726TUB0016", description: "TUBO 60x20x2 L2645 A.C.", quantity: 1, unitPrice: 24.07, taxRate: 21 },
      { code: "0726TUB0017", description: "TUBO 60x20x2 L2605 A.C.", quantity: 1, unitPrice: 25.72, taxRate: 21 },
      { code: "0726TUB0018", description: "TUBO 60x20x2 L2605 2.0 A.C.", quantity: 1, unitPrice: 24.23, taxRate: 21 },
    ],
  },
  {
    vendorName: "COSUMSE SL",
    vendorVat: "B12610333",
    date: "2026-06-17",
    reference: "ALBARAN ALV/140017",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.50 (1).jpeg`],
    lines: [
      { code: "FILM500", description: "ROLLO TRANSPARENTE FLEJADOR", quantity: 1, unitPrice: 6.47, taxRate: 21 },
      { code: "933A21050", description: "TORNILLO DIN 933 A2 M 10 X 50 INOX", quantity: 4, unitPrice: 0.21, taxRate: 21 },
      { code: "934G10", description: "TUERCA DIN 934 M10 ZINCADO", quantity: 8, unitPrice: 0.028, taxRate: 21 },
      { code: "125G10", description: "ARANDELA SIN BISEL M10 ZINCADO", quantity: 8, unitPrice: 0.0133, taxRate: 21 },
    ],
  },
  {
    vendorName: "COSUMSE SL",
    vendorVat: "B12610333",
    date: "2026-06-15",
    reference: "ALBARAN ALV/139838",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.50 (2).jpeg`],
    lines: [{ code: "FE115MAR", description: "ANTORCHA FB-15 MAR 4 MTS", quantity: 2, unitPrice: 41.09, taxRate: 21 }],
  },
  {
    vendorName: "HIERROS Y METALES CASTELLON S.L.",
    vendorVat: "B12836466",
    date: "2026-06-15",
    reference: "ALBARAN AV26/4594",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.50.jpeg`],
    lines: [
      { code: "001101079", description: "TUBO CUADRADO 60x60x2", quantity: 6, unitPrice: 4.69, taxRate: 21 },
      { code: "001103020", description: "TUBO REDONDO 16x1,5", quantity: 162, unitPrice: 0.89, taxRate: 21 },
      { code: "001102093", description: "TUBO RECTANGULAR 80x20x2", quantity: 24, unitPrice: 3.2, taxRate: 21 },
      { code: "PORTE", description: "SERVICIO LOGISTICO", quantity: 1, unitPrice: 15, taxRate: 21 },
    ],
  },
  {
    vendorName: "SOLDADURA MAQUINARIA Y SERVICIOS CASTELLON S.L.",
    vendorVat: "B12991378",
    date: "2026-06-17",
    reference: "ALBARAN A 2556",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.51 (1).jpeg`],
    lines: [
      { code: "7-FE08", description: "BOBINA DE HILO ER-70S 15Kg 0,8mm NIPPON", quantity: 2, unitPrice: 26.99, taxRate: 21 },
      { code: "4-199M608", description: "PUNTA DE CONTACTO CU M6 0,8mm DTO 25%", quantity: 15, unitPrice: 0.72, taxRate: 21 },
    ],
  },
  {
    vendorName: "MEDIA MARKT SATURN S.A.",
    vendorVat: "ESA82037292",
    date: "2026-06-17",
    reference: "FACTURA E234-60609541",
    attachments: [
      `${download}\\WhatsApp Image 2026-06-23 at 09.01.51 (2).jpeg`,
      `${download}\\WhatsApp Image 2026-06-23 at 09.01.51.jpeg`,
    ],
    lines: [
      { code: "1599170", description: "PEAQ MIA TAB 10 10.1P/H TABLET ANDROID", quantity: 1, unitPrice: 77.98, taxRate: 21 },
      { description: "CANON DERECHO A REEMBOLSO CON CERTIFICADO", quantity: 1, unitPrice: 3.75, taxRate: 21 },
      { description: "PROTECTORES TABLET CLEAR", quantity: 1, unitPrice: 13.22, taxRate: 21 },
    ],
  },
  {
    vendorName: "LEROY MERLIN ESPANA S.L.U.",
    vendorVat: "B84818442",
    date: "2026-06-12",
    reference: "FACTURA 110-0006-760135",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.52 (1).jpeg`],
    lines: [
      { code: "17915674", description: "CABLE RVK 5G1.5MM 25M NEGRO LEXMAN", quantity: 1, unitPrice: 46.27, taxRate: 21 },
      { code: "15778721", description: "CERR CARP MET PIC DESL 25MM", quantity: 4, unitPrice: 23.79, taxRate: 21 },
      { code: "16289980", description: "MANILLA DELTA LACADO NEGRO JUEGO DPY", quantity: 1, unitPrice: 8.26, taxRate: 21 },
      { code: "13646815", description: "PERNIO SOLDAR ACERO MOD3 100X16MM", quantity: 4, unitPrice: 1.81, taxRate: 21 },
      { code: "84914156", description: "CARRETILLA PLEG ALU 70KG STANDERS", quantity: 1, unitPrice: 25.87, taxRate: 21 },
    ],
  },
  {
    vendorName: "MAYENCOLORS S.L.",
    vendorVat: "B12871281",
    date: "2026-06-16",
    reference: "FACTURA T26.0001431",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 09.01.52.jpeg`],
    lines: [
      { code: "SAG20141902", description: "PISTOLA GRAVEDAD JUNIOR G 1.8", quantity: 1, unitPrice: 42.5, taxRate: 21 },
      { code: "N01AW91004", description: "ESMALTE S/R SINT. INDUSTRIAL BLANCO 4L", quantity: 1, unitPrice: 29.9, taxRate: 21 },
    ],
  },
  {
    vendorName: "PROINCER GLOBAL PROYECTS S.L.",
    vendorVat: "B12950895",
    date: "2026-06-13",
    reference: "ALBARAN 3291-26 / PEDIDO 3128-26",
    attachments: [`${download}\\WhatsApp Image 2026-06-23 at 08.52.07.jpeg`],
    lines: [
      { code: "0726TUB0005", description: "TUBO 40x20x2 L2080 A.C.", quantity: 1, unitPrice: 20.52, taxRate: 21 },
      { code: "0726TUB0006", description: "TUBO 40x20x2 L2120 A.C.", quantity: 2, unitPrice: 14.58, taxRate: 21 },
      { code: "0726TUB0007", description: "TUBO 40x20x2 L2060 A.C.", quantity: 1, unitPrice: 20.44, taxRate: 21 },
      { code: "0726TUB0008", description: "TUBO 40x20x2 L2100 A.C.", quantity: 2, unitPrice: 14.51, taxRate: 21 },
    ],
  },
];

async function main() {
  const results: Array<{ name: string; id: number; reference: string; status: "created" | "existing"; url: string }> = [];

  for (const doc of docs) {
    const existing = await findExistingPurchase(doc.reference);
    if (existing) {
      await attachImages(existing.id, doc);
      results.push({
        id: existing.id,
        name: existing.name || `Compra ${existing.id}`,
        reference: doc.reference,
        status: "existing",
        url: purchaseUrl(existing.id),
      });
      continue;
    }

    const partnerId = await findOrCreateVendor(doc);
    const orderId = await createPurchase(doc, partnerId);
    await attachImages(orderId, doc);
    const order = (await client.call<Purchase[]>("purchase.order", "search_read", {
      domain: [["id", "=", orderId]],
      fields: ["id", "name"],
      limit: 1,
    }))[0];

    results.push({
      id: orderId,
      name: order?.name || `Compra ${orderId}`,
      reference: doc.reference,
      status: "created",
      url: purchaseUrl(orderId),
    });
  }

  console.log(JSON.stringify({ results }, null, 2));
}

async function findExistingPurchase(reference: string): Promise<Purchase | undefined> {
  const rows = await client.call<Purchase[]>("purchase.order", "search_read", {
    domain: [["partner_ref", "=", reference]],
    fields: ["id", "name", "partner_ref", "state", "amount_untaxed", "amount_total"],
    limit: 1,
  });
  return rows[0];
}

async function findOrCreateVendor(doc: Doc): Promise<number> {
  const fields = await client.fieldsGet("res.partner");

  if (doc.vendorVat && fields.vat) {
    const existing = await client.call<Partner[]>("res.partner", "search_read", {
      domain: [["vat", "=", doc.vendorVat]],
      fields: ["id", "name", "vat"],
      limit: 1,
    });
    if (existing[0]) {
      return existing[0].id;
    }
  }

  const byName = await client.call<Partner[]>("res.partner", "search_read", {
    domain: [["name", "ilike", doc.vendorName]],
    fields: ["id", "name", "vat"],
    limit: 1,
  });
  if (byName[0]) {
    return byName[0].id;
  }

  const vals: Record<string, unknown> = { name: doc.vendorName };
  setIfWritable(fields, vals, "vat", doc.vendorVat);
  setIfWritable(fields, vals, "supplier_rank", 1);
  const created = await client.call<number[] | number>("res.partner", "create", { vals_list: [vals] });
  return Array.isArray(created) ? created[0] : created;
}

async function createPurchase(doc: Doc, partnerId: number): Promise<number> {
  const purchaseFields = await client.fieldsGet("purchase.order");
  const vals: Record<string, unknown> = { partner_id: partnerId };
  setIfWritable(purchaseFields, vals, "partner_ref", doc.reference);
  setIfWritable(purchaseFields, vals, "date_order", `${doc.date} 12:00:00`);

  const created = await client.call<number[] | number>("purchase.order", "create", { vals_list: [vals] });
  const orderId = Array.isArray(created) ? created[0] : created;

  for (const line of doc.lines) {
    const product = await findOrCreateProduct(line);
    await createPurchaseLine(orderId, line, product, doc.date);
  }

  await forcePurchaseDraft(orderId);
  return orderId;
}

async function findOrCreateProduct(line: DocLine): Promise<Product> {
  const fields = await client.fieldsGet("product.product");

  if (line.code && fields.default_code) {
    const exactCode = await client.call<Product[]>("product.product", "search_read", {
      domain: [["default_code", "=", line.code]],
      fields: productFields(fields),
      limit: 1,
    });
    if (exactCode[0]) {
      return exactCode[0];
    }
  }

  const candidates = await searchProductCandidates(line, fields);
  const scored = candidates
    .map((product) => ({ product, score: scoreProductMatch({ description: line.description, productReference: line.code }, product) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0];
  const second = scored[1];

  if (best && best.score >= 0.55 && (!second || best.score - second.score >= 0.18)) {
    console.log(`Producto reutilizado: ${line.description} -> ${best.product.display_name || best.product.name || best.product.id}`);
    return best.product;
  }

  if (isParameterizedWorkshopMaterial(line.description) || best) {
    console.log(`Producto a revisar: ${line.description}. Se usara DUDA para evitar duplicados.`);
    return findOrCreateDoubtProduct(fields);
  }

  console.log(`Producto nuevo general: ${line.description}`);
  const vals: Record<string, unknown> = { name: genericProductName(line.description) };
  setIfWritable(fields, vals, "purchase_ok", true);
  setIfWritable(fields, vals, "sale_ok", false);
  setIfWritable(fields, vals, "list_price", 0);
  setIfWritable(fields, vals, "standard_price", line.unitPrice);
  const created = await client.call<number[] | number>("product.product", "create", { vals_list: [vals] });
  const productId = Array.isArray(created) ? created[0] : created;
  const product = await client.call<Product[]>("product.product", "search_read", {
    domain: [["id", "=", productId]],
    fields: productFields(fields),
    limit: 1,
  });
  return product[0] || { id: productId, name: genericProductName(line.description) };
}

async function searchProductCandidates(line: DocLine, fields: OdooFieldMap): Promise<Product[]> {
  const rows = new Map<number, Product>();
  for (const query of productLookupQueries({ description: line.description, productReference: line.code })) {
    const found = await client.call<Product[]>("product.product", "search_read", {
      domain: [
        "|",
        ["display_name", "ilike", query],
        ["default_code", "ilike", query],
      ],
      fields: productFields(fields),
      limit: 8,
    });
    for (const row of found) {
      rows.set(row.id, row);
    }
  }

  return Array.from(rows.values());
}

async function findOrCreateDoubtProduct(fields: OdooFieldMap): Promise<Product> {
  const existing = await client.call<Product[]>("product.product", "search_read", {
    domain: [
      "|",
      ["default_code", "=", "DUDA"],
      ["name", "=", "DUDA"],
    ],
    fields: productFields(fields),
    limit: 1,
  });
  if (existing[0]) {
    return existing[0];
  }

  const vals: Record<string, unknown> = { name: "DUDA" };
  setIfWritable(fields, vals, "default_code", "DUDA");
  setIfWritable(fields, vals, "purchase_ok", true);
  setIfWritable(fields, vals, "sale_ok", false);
  setIfWritable(fields, vals, "list_price", 0);
  setIfWritable(fields, vals, "standard_price", 0);
  const created = await client.call<number[] | number>("product.product", "create", { vals_list: [vals] });
  const productId = Array.isArray(created) ? created[0] : created;
  const product = await client.call<Product[]>("product.product", "search_read", {
    domain: [["id", "=", productId]],
    fields: productFields(fields),
    limit: 1,
  });
  return product[0] || { id: productId, name: "DUDA", default_code: "DUDA" };
}

async function createPurchaseLine(orderId: number, line: DocLine, product: Product, date: string) {
  const fields = await client.fieldsGet("purchase.order.line");
  const vals: Record<string, unknown> = {
    order_id: orderId,
    product_id: product.id,
    name: line.description,
    product_qty: line.quantity,
    price_unit: line.unitPrice,
  };
  setIfWritable(fields, vals, "date_planned", `${date} 12:00:00`);
  setIfWritable(fields, vals, "product_uom", many2OneId(product.uom_po_id || product.uom_id));
  setIfWritable(fields, vals, "taxes_id", await findTaxCommand(line.taxRate));
  await client.call<number[] | number>("purchase.order.line", "create", { vals_list: [vals] });
}

async function attachImages(orderId: number, doc: Doc) {
  for (const imagePath of doc.attachments) {
    const name = `Imagen ${doc.reference} - ${basename(imagePath)}`;
    const existing = await client.call<Array<{ id: number }>>("ir.attachment", "search_read", {
      domain: [
        ["res_model", "=", "purchase.order"],
        ["res_id", "=", orderId],
        ["name", "=", name],
      ],
      fields: ["id"],
      limit: 1,
    });
    if (existing[0]) {
      continue;
    }

    const fields = await client.fieldsGet("ir.attachment");
    const vals: Record<string, unknown> = {
      name,
      res_model: "purchase.order",
      res_id: orderId,
      datas: readFileSync(imagePath).toString("base64"),
    };
    validateWritable(fields, vals, "ir.attachment");
    await client.call<number[] | number>("ir.attachment", "create", { vals_list: [vals] });
  }
}

async function forcePurchaseDraft(orderId: number) {
  await client.call<boolean>("purchase.order", "write", {
    ids: [orderId],
    vals: { state: "draft" },
  });
}

async function findTaxCommand(taxRate: number) {
  if (taxRate <= 0) {
    return undefined;
  }

  const taxes = await client.call<Tax[]>("account.tax", "search_read", {
    domain: [
      ["amount", "=", taxRate],
      ["type_tax_use", "=", "purchase"],
    ],
    fields: ["id", "name", "amount"],
    limit: 1,
  });
  return taxes[0] ? [[6, 0, [taxes[0].id]]] : undefined;
}

function productFields(fields: OdooFieldMap): string[] {
  return [
    "id",
    fields.display_name ? "display_name" : "name",
    ...(fields.default_code ? ["default_code"] : []),
    ...(fields.uom_po_id ? ["uom_po_id"] : fields.uom_id ? ["uom_id"] : []),
  ];
}

function setIfWritable(fields: OdooFieldMap, vals: Record<string, unknown>, field: string, value: unknown) {
  if (value !== undefined && fields[field] && !fields[field].readonly) {
    vals[field] = value;
  }
}

function validateWritable(fields: OdooFieldMap, vals: Record<string, unknown>, model: string) {
  const missing = Object.keys(vals).filter((field) => !fields[field]);
  if (missing.length) {
    throw new Error(`${model}: campos no disponibles en Odoo: ${missing.join(", ")}`);
  }
}

function genericProductName(description: string): string {
  return cleanReusableProductName(description);
}

function isParameterizedWorkshopMaterial(description: string): boolean {
  const normalized = description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return /\b(TUBO|PERFIL|CHAPA|PLETINA|ANGULAR|REDONDO|CUADRADO|BARRA|VIGA|IPN|IPE|HEA|HEB|UPN)\b/.test(normalized);
}

function purchaseUrl(orderId: number): string {
  return `https://navagost.odoo.com/web#id=${orderId}&model=purchase.order&view_type=form`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
