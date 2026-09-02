import { OdooJson2Client, many2OneId, type OdooFieldMap, type OdooMany2One } from "../src/purchase-image/odoo-json2";
import { productLookupQueries, scoreProductMatch } from "../src/purchase-image/purchase-service";

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
  total: number;
};

type Partner = { id: number; name?: string; vat?: string };
type Product = { id: number; name?: string; display_name?: string; default_code?: string; uom_id?: OdooMany2One; uom_po_id?: OdooMany2One };
type Purchase = { id: number; name?: string };
type Tax = { id: number; amount?: number; name?: string };

const client = new OdooJson2Client();

const docs: Doc[] = [
  {
    vendorName: "PROINCER GLOBAL PROYECTS S.L.",
    vendorVat: "B12950895",
    date: "2026-06-10",
    reference: "ALBARAN 3290-26 / PEDIDO 260602",
    total: 101.54,
    lines: [
      { code: "0726TUB0001", description: "TUBO 40x20x2 L1125 A.C.", quantity: 1, unitPrice: 14.3, taxRate: 21 },
      { code: "0726TUB0002", description: "TUBO 40x20x2 L1165 A.C.", quantity: 2, unitPrice: 9.48, taxRate: 21 },
      { code: "0726TUB0003", description: "TUBO 40x20x2 L1135 A.C.", quantity: 2, unitPrice: 10.33, taxRate: 21 },
      { code: "0726TUB0004", description: "TUBO 40x20x2 L1175 A.C.", quantity: 4, unitPrice: 7.5, taxRate: 21 },
    ],
  },
  {
    vendorName: "COSUMSE SL",
    vendorVat: "B12610333",
    date: "2026-06-15",
    reference: "ALBARAN ALV/139853",
    total: 45.57,
    lines: [
      { code: "BRHSS025", description: "BROCA HSS DIAM. 02,50 MM", quantity: 10, unitPrice: 0.4379, taxRate: 21 },
      { code: "I529041", description: "MARTILLO BOCAS DE NYLON 44 MM", quantity: 1, unitPrice: 22.8, taxRate: 21 },
      { code: "DE1240022", description: "TORNILLO INVIOLABLE M7X70", quantity: 30, unitPrice: 0.1993, taxRate: 21 },
      { code: "FI70010", description: "TACO SX 10 X 50", quantity: 50, unitPrice: 0.09, taxRate: 21 },
    ],
  },
  {
    vendorName: "COSUMSE SL",
    vendorVat: "B12610333",
    date: "2026-06-16",
    reference: "ALBARAN ALV/139950",
    total: 14.52,
    lines: [
      { code: "BRI2273", description: "BRIDA NYLON 2273 NEGRA 370 X 7,6 MM", quantity: 100, unitPrice: 0.12, taxRate: 21 },
    ],
  },
  {
    vendorName: "BRICOLAJE BRICOMAN S.L.U. - OBRAMAT",
    vendorVat: "B84406289",
    date: "2026-06-12",
    reference: "FACTURA RECTIFICATIVA 006-006-0006-954301",
    total: 111.2,
    lines: [
      { code: "25021650", description: "CERRAD MET C/CIL 13. PIC/PAL D 1984/30", quantity: 4, unitPrice: 22.98, taxRate: 21 },
    ],
  },
];

async function main() {
  const created: Array<{ name: string; id: number; url: string; reference: string }> = [];

  for (const doc of docs) {
    const partnerId = await findOrCreateVendor(doc);
    const orderId = await createPurchase(doc, partnerId);
    const order = (await client.call<Purchase[]>("purchase.order", "search_read", {
      domain: [["id", "=", orderId]],
      fields: ["id", "name"],
      limit: 1,
    }))[0];

    created.push({
      id: orderId,
      name: order?.name || `Compra ${orderId}`,
      reference: doc.reference,
      url: `https://navagost.odoo.com/web#id=${orderId}&model=purchase.order&view_type=form`,
    });
  }

  console.log(JSON.stringify({ created }, null, 2));
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
  const vals: Record<string, unknown> = {
    partner_id: partnerId,
  };
  setIfWritable(purchaseFields, vals, "partner_ref", doc.reference);
  setIfWritable(purchaseFields, vals, "date_order", `${doc.date} 12:00:00`);

  const created = await client.call<number[] | number>("purchase.order", "create", { vals_list: [vals] });
  const orderId = Array.isArray(created) ? created[0] : created;

  for (const line of doc.lines) {
    const product = await findOrCreateProduct(line);
    await createPurchaseLine(orderId, line, product);
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

  if (best) {
    console.log(`Producto dudoso: ${line.description}. Se usara DUDA y se conserva la descripcion en la linea.`);
    return findOrCreateDoubtProduct(fields);
  }

  if (!isSpecificEnough(line)) {
    console.log(`Producto poco claro: ${line.description}. Se usara DUDA.`);
    return findOrCreateDoubtProduct(fields);
  }

  if (isParameterizedWorkshopMaterial(line.description)) {
    console.log(`Material parametrico sin coincidencia clara: ${line.description}. Se usara DUDA para evitar duplicados por medidas/albaranes.`);
    return findOrCreateDoubtProduct(fields);
  }

  console.log(`Producto nuevo: ${line.description}`);
  const vals: Record<string, unknown> = { name: line.description };
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
  return product[0] || { id: productId, name: line.description };
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

function isSpecificEnough(line: DocLine): boolean {
  return Boolean(line.code || (/\d/.test(line.description) && line.description.trim().split(/\s+/).length >= 3));
}

function isParameterizedWorkshopMaterial(description: string): boolean {
  const normalized = description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return /\b(TUBO|PERFIL|CHAPA|PLETINA|ANGULAR|REDONDO|CUADRADO|BARRA|VIGA|IPN|IPE|HEA|HEB|UPN)\b/.test(normalized);
}

async function createPurchaseLine(orderId: number, line: DocLine, product: Product) {
  const fields = await client.fieldsGet("purchase.order.line");
  const vals: Record<string, unknown> = {
    order_id: orderId,
    product_id: product.id,
    name: line.description,
    product_qty: line.quantity,
    price_unit: line.unitPrice,
  };
  setIfWritable(fields, vals, "date_planned", new Date().toISOString().slice(0, 10) + " 12:00:00");
  setIfWritable(fields, vals, "product_uom", many2OneId(product.uom_po_id || product.uom_id));
  setIfWritable(fields, vals, "taxes_id", await findTaxCommand(line.taxRate));
  await client.call<number[] | number>("purchase.order.line", "create", { vals_list: [vals] });
}

async function forcePurchaseDraft(orderId: number) {
  await client.call<boolean>("purchase.order", "write", {
    ids: [orderId],
    vals: { state: "draft" },
  });
}

async function findTaxCommand(taxRate: number) {
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
