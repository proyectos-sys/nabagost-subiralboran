import { basename } from "node:path";
import { readFileSync } from "node:fs";
import { getPurchaseEnv } from "./env";
import { extractPurchaseDataFromImage } from "./openai-vision";
import { many2OneId, many2OneName, OdooJson2Client, type OdooMany2One } from "./odoo-json2";
import type {
  AnalyticMatch,
  CreatedPurchase,
  CreatedSaleLine,
  ExtractedPurchaseData,
  ProductMatch,
  PurchaseLineInput,
  PurchasePreview,
  PurchasePreviewLine,
  SaleLinePlan,
  SaleOrderMatch,
  VendorMatch,
} from "./types";

type PartnerRow = { id: number; name?: string; vat?: string };
export type ProductRow = { id: number; display_name?: string; name?: string; default_code?: string; uom_po_id?: OdooMany2One; uom_id?: OdooMany2One };
type PurchaseRow = { id: number; name?: string };
type PickingTypeRow = { id: number; name?: string; complete_name?: string };
type TaxRow = { id: number; name?: string; amount?: number };
type AnalyticRow = { id: number; name?: string };
type SaleOrderRow = { id: number; name?: string; state?: string; partner_id?: OdooMany2One };
type SequenceRow = { sequence?: number };

// Estados en los que aun se pueden anadir lineas al presupuesto (no bloqueado ni cancelado).
const SALE_ORDER_EDITABLE_STATES = ["draft", "sent", "sale"];

const client = new OdooJson2Client();

export async function getPurchasePreview(imagePath: string): Promise<PurchasePreview> {
  const extracted = await extractPurchaseDataFromImage(imagePath);
  return buildPurchasePreview(imagePath, extracted);
}

export async function buildPurchasePreview(imagePath: string, extracted: ExtractedPurchaseData): Promise<PurchasePreview> {
  const warnings: string[] = [];
  const vendor = await findVendor(extracted).catch((error: unknown) => {
    warnings.push(error instanceof Error ? error.message : "No se ha encontrado proveedor.");
    return undefined;
  });
  const env = getPurchaseEnv();
  const addToSaleOrder = env.ADD_COST_TO_SALE_ORDER === "true";
  const saleOrderByRef = new Map<string, Promise<SaleOrderMatch | undefined>>();
  const documentAnalytic = extracted.documentJobRef
    ? await findAnalyticAccount(extracted.documentJobRef, warnings)
    : undefined;
  const lines: PurchasePreviewLine[] = await Promise.all(
    extracted.lines.map(async (line) => {
      const product = await findProduct(line, warnings, extracted.vendorName);
      const analytic = line.jobRef
        ? await findAnalyticAccount(line.jobRef, warnings)
        : documentAnalytic;
      const jobRef = line.jobRef || extracted.documentJobRef;
      let saleOrder: SaleOrderMatch | undefined;
      if (addToSaleOrder && jobRef) {
        const key = jobRef.trim().toUpperCase();
        if (!saleOrderByRef.has(key)) {
          saleOrderByRef.set(key, findSaleOrder(jobRef, analytic, warnings));
        }
        saleOrder = await saleOrderByRef.get(key);
      }
      return {
        ...line,
        product,
        subtotal: roundMoney(line.quantity * line.unitPrice),
        analytic,
        saleOrder,
      };
    }),
  );
  const saleLines = buildSaleLinePlans(lines, extracted, vendor?.name, env.SALE_MARKUP_PERCENT);
  if (saleLines.some((plan) => plan.taxRate === undefined)) {
    warnings.push("Hay lineas sin IVA detectado: se anadiran al presupuesto sin impuesto. Revisalo.");
  }
  const totalLines = roundMoney(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const totalLinesWithTax = roundMoney(
    lines.reduce((sum, line) => sum + line.subtotal * (1 + (line.taxRate || 0) / 100), 0),
  );
  const totalExtracted = roundMoney(extracted.total || 0);

  if (!extracted.vendorName && !extracted.vendorVat && !vendor) {
    warnings.push("Falta proveedor. Configura DEFAULT_VENDOR_ID o revisa manualmente.");
  }

  if (lines.length === 0) {
    warnings.push("No se han detectado lineas de compra.");
  }

  if (
    totalExtracted > 0 &&
    Math.abs(totalExtracted - totalLines) > 0.05 &&
    Math.abs(totalExtracted - totalLinesWithTax) > 0.05
  ) {
    warnings.push(
      `El total extraido (${totalExtracted}) no cuadra con lineas sin IVA (${totalLines}) ni con IVA (${totalLinesWithTax}).`,
    );
  }

  return {
    needs_confirmation: true,
    imagePath,
    extracted,
    vendor,
    lines,
    warnings: Array.from(new Set(warnings)),
    totalExtracted,
    totalLines,
    documentAnalytic,
    saleLines,
    markupPercent: env.SALE_MARKUP_PERCENT,
  };
}

export function applyMarkup(cost: number, markupPercent: number): number {
  return roundMoney(cost * (1 + markupPercent / 100));
}

export function buildSaleLineDescription(
  description: string,
  document: Pick<ExtractedPurchaseData, "reference" | "vendorName">,
  vendorName = "",
): string {
  const origin = [
    document.reference ? `albarán ${document.reference}` : "albarán",
    document.vendorName || vendorName,
  ]
    .filter(Boolean)
    .join(" · ");
  return `[IA] ${description.trim()} (${origin})`;
}

export function buildSaleLinePlans(
  lines: PurchasePreviewLine[],
  document: Pick<ExtractedPurchaseData, "reference" | "vendorName">,
  vendorName: string | undefined,
  markupPercent: number,
): SaleLinePlan[] {
  return lines.flatMap((line) =>
    line.saleOrder
      ? [{
          order: line.saleOrder,
          description: buildSaleLineDescription(line.description, document, vendorName),
          quantity: line.quantity,
          costUnit: line.unitPrice,
          priceUnit: applyMarkup(line.unitPrice, markupPercent),
          taxRate: line.taxRate,
        }]
      : [],
  );
}

// "S55" -> "55"; si la anotacion no es un codigo S, se intenta con el nombre de la cuenta analitica ("S00055 - Cliente").
export function saleOrderDigits(rawRef: string, analyticName?: string): string {
  const digits =
    rawRef.trim().match(/^s\s*0*(\d{1,6})$/i)?.[1] || analyticName?.match(/^S0*(\d+)/i)?.[1] || "";
  return Number(digits) > 0 ? digits.replace(/^0+/, "") : "";
}

// Odoo numera los presupuestos como S00055, pero se aceptan variantes con menos ceros.
export function saleOrderNameCandidates(digits: string): string[] {
  const names: string[] = [];
  for (let width = digits.length; width <= 6; width += 1) {
    names.push(`S${digits.padStart(width, "0")}`);
  }
  return names;
}

export async function findSaleOrder(
  rawRef: string,
  analytic: AnalyticMatch | undefined,
  warnings: string[],
): Promise<SaleOrderMatch | undefined> {
  const digits = saleOrderDigits(rawRef, analytic?.name);
  if (!digits) {
    return undefined;
  }

  const rows = await client.call<SaleOrderRow[]>("sale.order", "search_read", {
    domain: [["name", "in", saleOrderNameCandidates(digits)]],
    fields: ["id", "name", "state", "partner_id"],
    limit: 5,
  });
  if (rows.length === 0) {
    warnings.push(`No se encontro presupuesto para la faena "${rawRef}". No se anadira linea al presupuesto.`);
    return undefined;
  }
  if (rows.length > 1) {
    warnings.push(`Varios presupuestos coinciden con la faena "${rawRef}". Revisa manualmente.`);
    return undefined;
  }

  const row = rows[0];
  const name = row.name || `S${digits}`;
  if (!SALE_ORDER_EDITABLE_STATES.includes(row.state || "")) {
    warnings.push(`El presupuesto ${name} esta en estado "${row.state}" y no admite lineas nuevas. No se anadira linea.`);
    return undefined;
  }

  return { id: row.id, name, state: row.state || "", partnerName: many2OneName(row.partner_id) || undefined };
}

export async function findVendor(data: Pick<ExtractedPurchaseData, "vendorVat" | "vendorName">): Promise<VendorMatch> {
  const env = getPurchaseEnv();
  await client.fieldsGet("res.partner");

  if (data.vendorVat) {
    const normalizedVat = normalizeVat(data.vendorVat);
    const rows = await client.call<PartnerRow[]>("res.partner", "search_read", {
      domain: [["vat", "ilike", normalizedVat]],
      fields: ["id", "name", "vat"],
      limit: 20,
    });
    const exactVat = rows.find((row) => normalizeVat(row.vat) === normalizedVat);
    if (exactVat) {
      return { id: exactVat.id, name: exactVat.name || `Proveedor ${exactVat.id}`, source: "vat" };
    }
  }

  if (data.vendorName) {
    const rows = await client.call<PartnerRow[]>("res.partner", "search_read", {
      domain: [["name", "ilike", data.vendorName]],
      fields: ["id", "name", "vat"],
      limit: 20,
    });
    if (rows.length === 1) {
      return { id: rows[0].id, name: rows[0].name || data.vendorName, source: "name" };
    }
    if (rows.length > 1) {
      const exactName = rows.filter((row) => normalizeName(row.name) === normalizeName(data.vendorName));
      const exactWithVat = exactName.filter((row) => Boolean(row.vat));
      if (exactWithVat.length === 1) {
        return { id: exactWithVat[0].id, name: exactWithVat[0].name || data.vendorName, source: "name" };
      }
      if (exactName.length === 1) {
        return { id: exactName[0].id, name: exactName[0].name || data.vendorName, source: "name" };
      }
      throw new Error(`Hay varios proveedores que coinciden con "${data.vendorName}". Revisa manualmente.`);
    }
  }

  if (env.DEFAULT_VENDOR_ID) {
    return { id: env.DEFAULT_VENDOR_ID, name: `Proveedor por defecto ${env.DEFAULT_VENDOR_ID}`, source: "default" };
  }

  throw new Error(`No se encontro proveedor para "${data.vendorName || data.vendorVat || "sin datos"}".`);
}

export async function findAnalyticAccount(rawRef: string, warnings: string[]): Promise<AnalyticMatch | undefined> {
  const ref = rawRef.trim();
  if (!ref) {
    return undefined;
  }

  const codeMatch = ref.match(/^s\s*0*(\d{1,6})$/i);
  if (codeMatch) {
    const digits = codeMatch[1];
    const rows = await client.call<AnalyticRow[]>("account.analytic.account", "search_read", {
      domain: ["|", "|", "|", "|",
        ["name", "ilike", `S${digits}`],
        ["name", "ilike", `S0${digits}`],
        ["name", "ilike", `S00${digits}`],
        ["name", "ilike", `S000${digits}`],
        ["name", "ilike", `S0000${digits}`],
      ],
      fields: ["id", "name"],
      limit: 20,
    });
    const matches = rows.filter((row) => {
      const codeDigits = row.name?.match(/^S(\d+)/i)?.[1];
      return codeDigits !== undefined && codeDigits.replace(/^0+/, "") === digits.replace(/^0+/, "");
    });
    if (matches.length === 1) {
      return { id: matches[0].id, name: matches[0].name || ref, source: "code" };
    }
    if (matches.length > 1) {
      warnings.push(`Varias cuentas analiticas coinciden con la faena "${ref}". Revisa manualmente.`);
      return undefined;
    }
  }

  const nameRows = await client.call<AnalyticRow[]>("account.analytic.account", "search_read", {
    domain: [["name", "ilike", ref]],
    fields: ["id", "name"],
    limit: 20,
  });
  if (nameRows.length === 1) {
    return { id: nameRows[0].id, name: nameRows[0].name || ref, source: "name" };
  }
  if (nameRows.length > 1) {
    const exactName = nameRows.filter((row) => normalizeName(row.name) === normalizeName(ref));
    if (exactName.length === 1) {
      return { id: exactName[0].id, name: exactName[0].name || ref, source: "name" };
    }
    warnings.push(`Varias cuentas analiticas coinciden con la faena "${ref}". Revisa manualmente.`);
    return undefined;
  }

  warnings.push(`No se encontro cuenta analitica para la faena "${ref}". Revisa manualmente.`);
  return undefined;
}

export async function findProduct(
  line: PurchaseLineInput,
  warnings: string[] = [],
  vendorName = "",
): Promise<ProductMatch> {
  const env = getPurchaseEnv();
  const productFields = await client.fieldsGet("product.product");
  const uomField = productFields.uom_po_id ? "uom_po_id" : productFields.uom_id ? "uom_id" : null;

  const isLaserVendor = /LASER/.test(simplifyProductText(vendorName));
  const isTube = workshopFamily(line.description) === "TUBO";
  if (isParameterizedWorkshopMaterial(line.description) && (!isLaserVendor || isTube)) {
    return findOrCreateGenericWorkshopProduct(line, productFields, uomField, warnings);
  }

  const laserProductName = genericLaserProductName(line.description, vendorName);
  if (laserProductName) {
    return findOrCreateReusableProduct(laserProductName, line, productFields, uomField, warnings);
  }

  if (line.productReference && productFields.default_code) {
    const exactCode = await client.call<ProductRow[]>("product.product", "search_read", {
      domain: [["default_code", "=", line.productReference]],
      fields: ["id", "display_name", "name", "default_code", ...(uomField ? [uomField] : [])],
      limit: 1,
    });
    if (exactCode[0]) {
      return productMatchFromRow(exactCode[0], line);
    }
  }

  const rows = await searchProductCandidates(line, uomField);
  const scoredRows = rows
    .map((row) => ({ row, score: scoreProductMatch(line, row) }))
    .sort((left, right) => right.score - left.score);
  const best = scoredRows[0];
  const second = scoredRows[1];

  if (best && best.score >= 0.55 && (!second || best.score - second.score >= 0.18)) {
    return productMatchFromRow(best.row, line);
  }

  if (best) {
    if (looksSpecificEnoughToCreate(line.description)) {
      return findOrCreateReusableProduct(
        cleanReusableProductName(line.description),
        line,
        productFields,
        uomField,
        warnings,
      );
    }
    warnings.push(`Producto dudoso para "${line.description}". Se usara DUDA/fallback y la descripcion quedara en la linea.`);
    return fallbackProduct(line, warnings, "doubt");
  }

  if (!line.productReference && !looksSpecificEnoughToCreate(line.description)) {
    warnings.push(`Producto poco claro para "${line.description}". Se usara DUDA/fallback y la descripcion quedara en la linea.`);
    return fallbackProduct(line, warnings, "doubt");
  }

  if (looksSpecificEnoughToCreate(line.description)) {
    return findOrCreateReusableProduct(
      cleanReusableProductName(line.description),
      line,
      productFields,
      uomField,
      warnings,
    );
  }

  warnings.push(`Producto no encontrado: "${line.description}". Se usara DUDA/fallback salvo que configures alta manual de productos.`);
  return fallbackProduct(line, warnings, env.FALLBACK_PRODUCT_ID ? "fallback" : "doubt");
}

async function findOrCreateReusableProduct(
  name: string,
  line: PurchaseLineInput,
  productFields: Record<string, { readonly?: boolean }>,
  uomField: string | null,
  warnings: string[],
): Promise<ProductMatch> {
  const existing = await client.call<ProductRow[]>("product.product", "search_read", {
    domain: [["name", "=ilike", name]],
    fields: ["id", "display_name", "name", "default_code", ...(uomField ? [uomField] : [])],
    limit: 2,
  });
  if (existing.length === 1) {
    return productMatchFromRow(existing[0], line);
  }

  const family = reusableProductFamily(name);
  if (family) {
    const familyDomain = family === "CORTE" || family === "LASER"
      ? ["|", ["name", "ilike", "CORTE"], ["name", "ilike", "LASER"]]
      : [["name", "ilike", family]];
    const familyCandidates = await client.call<ProductRow[]>("product.product", "search_read", {
      domain: familyDomain,
      fields: ["id", "display_name", "name", "default_code", ...(uomField ? [uomField] : [])],
      limit: 50,
    });
    const scored = familyCandidates
      .map((row) => ({ row, score: scoreProductMatch({ description: name }, row) }))
      .sort((left, right) => right.score - left.score);
    if (scored[0]?.score >= 0.55 && (!scored[1] || scored[0].score - scored[1].score >= 0.12)) {
      warnings.push(`Producto existente reutilizado por similitud: "${scored[0].row.display_name || scored[0].row.name}".`);
      return productMatchFromRow(scored[0].row, line);
    }
  }

  const vals: Record<string, unknown> = { name };
  setIfWritable(productFields, vals, "purchase_ok", true);
  setIfWritable(productFields, vals, "sale_ok", false);
  setIfWritable(productFields, vals, "list_price", 0);
  setIfWritable(productFields, vals, "standard_price", line.unitPrice);
  validateWritable(productFields, vals, "product.product");

  const created = await client.call<number[] | number>("product.product", "create", { vals_list: [vals] });
  const productId = Array.isArray(created) ? created[0] : created;
  warnings.push(`Producto reutilizable creado: "${name}". La referencia del proveedor solo queda en la descripcion de la linea.`);
  return { id: productId, name, source: "match" };
}

async function findOrCreateGenericWorkshopProduct(
  line: PurchaseLineInput,
  productFields: Record<string, { readonly?: boolean }>,
  uomField: string | null,
  warnings: string[],
): Promise<ProductMatch> {
  const genericName = genericWorkshopProductName(line.description);
  if (!genericName) {
    warnings.push(`Material de taller sin medida clara para "${line.description}". Se usara DUDA/fallback.`);
    return fallbackProduct(line, warnings, "doubt");
  }

  const existing = await client.call<ProductRow[]>("product.product", "search_read", {
    domain: [["name", "=", genericName]],
    fields: ["id", "display_name", "name", "default_code", ...(uomField ? [uomField] : [])],
    limit: 1,
  });
  if (existing[0]) {
    return productMatchFromRow(existing[0], line);
  }

  const similar = await client.call<ProductRow[]>("product.product", "search_read", {
    domain: [["name", "ilike", workshopFamily(genericName) || genericName]],
    fields: ["id", "display_name", "name", "default_code", ...(uomField ? [uomField] : [])],
    limit: 50,
  });
  const scoredSimilar = similar
    .map((row) => ({ row, score: scoreProductMatch({ description: genericName }, row) }))
    .sort((left, right) => right.score - left.score);
  if (
    scoredSimilar[0]?.score >= 0.8 &&
    (!scoredSimilar[1] || scoredSimilar[0].score - scoredSimilar[1].score >= 0.12)
  ) {
    warnings.push(`Producto de taller existente reutilizado por familia y medidas: "${scoredSimilar[0].row.display_name || scoredSimilar[0].row.name}".`);
    return productMatchFromRow(scoredSimilar[0].row, line);
  }

  const vals: Record<string, unknown> = { name: genericName };
  setIfWritable(productFields, vals, "purchase_ok", true);
  setIfWritable(productFields, vals, "sale_ok", false);
  setIfWritable(productFields, vals, "list_price", 0);
  setIfWritable(productFields, vals, "standard_price", line.unitPrice);
  validateWritable(productFields, vals, "product.product");

  const created = await client.call<number[] | number>("product.product", "create", { vals_list: [vals] });
  const productId = Array.isArray(created) ? created[0] : created;
  const rows = await client.call<ProductRow[]>("product.product", "search_read", {
    domain: [["id", "=", productId]],
    fields: ["id", "display_name", "name", "default_code", ...(uomField ? [uomField] : [])],
    limit: 1,
  });

  warnings.push(`Producto generico creado/reutilizable: "${genericName}". La descripcion original queda en la linea.`);
  return productMatchFromRow(rows[0] || { id: productId, name: genericName }, line);
}

async function searchProductCandidates(line: PurchaseLineInput, uomField: string | null): Promise<ProductRow[]> {
  const queries = productLookupQueries(line);
  const rows = new Map<number, ProductRow>();

  for (const query of queries) {
    const found = await client.call<ProductRow[]>("product.product", "search_read", {
      domain: [
        "|",
        ["display_name", "ilike", query],
        ["default_code", "ilike", query],
      ],
      fields: ["id", "display_name", "name", "default_code", ...(uomField ? [uomField] : [])],
      limit: 8,
    });
    for (const row of found) {
      rows.set(row.id, row);
    }
  }

  return Array.from(rows.values());
}

function productMatchFromRow(row: ProductRow, line: PurchaseLineInput): ProductMatch {
  return {
    id: row.id,
    name: row.display_name || row.name || line.description,
    uomPoId: many2OneId(row.uom_po_id || row.uom_id),
    source: "match",
  };
}

async function fallbackProduct(line: PurchaseLineInput, warnings: string[], source: "fallback" | "doubt"): Promise<ProductMatch> {
  const env = getPurchaseEnv();
  const productFields = await client.fieldsGet("product.product");
  const uomField = productFields.uom_po_id ? "uom_po_id" : productFields.uom_id ? "uom_id" : null;

  if (env.FALLBACK_PRODUCT_ID) {
    const rows = await client.call<ProductRow[]>("product.product", "search_read", {
      domain: [["id", "=", env.FALLBACK_PRODUCT_ID]],
      fields: ["id", "display_name", "name", "default_code", ...(uomField ? [uomField] : [])],
      limit: 1,
    });
    const row = rows[0];
    return {
      id: env.FALLBACK_PRODUCT_ID,
      name: row?.display_name || row?.name || `Producto fallback ${env.FALLBACK_PRODUCT_ID}`,
      uomPoId: many2OneId(row?.uom_po_id || row?.uom_id),
      source,
    };
  }

  const doubtRows = await client.call<ProductRow[]>("product.product", "search_read", {
    domain: [
      "|",
      ["default_code", "=", "DUDA"],
      ["name", "=", "DUDA"],
    ],
    fields: ["id", "display_name", "name", "default_code", ...(uomField ? [uomField] : [])],
    limit: 1,
  });

  if (doubtRows[0]) {
    return {
      id: doubtRows[0].id,
      name: doubtRows[0].display_name || doubtRows[0].name || "DUDA",
      uomPoId: many2OneId(doubtRows[0].uom_po_id || doubtRows[0].uom_id),
      source,
    };
  }

  warnings.push("No hay FALLBACK_PRODUCT_ID ni producto DUDA en Odoo.");
  throw new Error(`No se encontro producto claro para "${line.description}". Crea un producto DUDA o configura FALLBACK_PRODUCT_ID.`);
}

export async function createPurchaseOrder(preview: PurchasePreview): Promise<CreatedPurchase> {
  if (!preview.vendor) {
    throw new Error("No se puede crear la compra sin proveedor.");
  }

  if (preview.extracted.reference) {
    const existing = await client.call<PurchaseRow[]>("purchase.order", "search_read", {
      domain: [
        ["partner_id", "=", preview.vendor.id],
        ["partner_ref", "=", preview.extracted.reference],
      ],
      fields: ["id", "name"],
      limit: 1,
    });
    if (existing[0]) {
      throw new Error(
        `El documento ${preview.extracted.reference} ya esta importado como ${existing[0].name || existing[0].id}.`,
      );
    }
  }

  const orderFields = await client.fieldsGet("purchase.order");
  const orderVals: Record<string, unknown> = {
    partner_id: preview.vendor.id,
  };

  setIfWritable(orderFields, orderVals, "partner_ref", preview.extracted.reference || undefined);
  setIfWritable(orderFields, orderVals, "date_order", `${preview.extracted.date || new Date().toISOString().slice(0, 10)} 12:00:00`);

  const pickingTypeId = await findPickingTypeId();
  setIfWritable(orderFields, orderVals, "picking_type_id", pickingTypeId);

  const orderCreated = await client.call<number[] | number>("purchase.order", "create", { vals_list: [orderVals] });
  const orderId = Array.isArray(orderCreated) ? orderCreated[0] : orderCreated;

  await createPurchaseLines(orderId, preview);
  await forcePurchaseDraft(orderId);
  await attachImageToPurchase(orderId, preview.imagePath);

  // La compra ya existe: si falla el presupuesto no se pierde, se avisa para completarlo a mano.
  const sale = await addLinesToSaleOrders(preview).catch((error: unknown) => ({
    created: [] as CreatedSaleLine[],
    warnings: [`No se pudieron anadir lineas a los presupuestos: ${error instanceof Error ? error.message : "error desconocido"}`],
  }));

  const order = (
    await client.call<PurchaseRow[]>("purchase.order", "search_read", {
      domain: [["id", "=", orderId]],
      fields: ["id", "name"],
      limit: 1,
    })
  )[0];
  const env = getPurchaseEnv();
  const name = order?.name || `Compra ${orderId}`;

  return {
    id: orderId,
    name,
    url: `${env.ODOO_URL.replace(/\/$/, "")}/web#id=${orderId}&model=purchase.order&view_type=form`,
    preview,
    saleLines: sale.created,
    saleWarnings: sale.warnings,
  };
}

async function addLinesToSaleOrders(preview: PurchasePreview): Promise<{ created: CreatedSaleLine[]; warnings: string[] }> {
  const created: CreatedSaleLine[] = [];
  const warnings: string[] = [];
  if (preview.saleLines.length === 0) {
    return { created, warnings };
  }

  const fields = await client.fieldsGet("sale.order.line");
  const plansByOrder = new Map<number, SaleLinePlan[]>();
  for (const plan of preview.saleLines) {
    plansByOrder.set(plan.order.id, [...(plansByOrder.get(plan.order.id) || []), plan]);
  }

  for (const [orderId, plans] of plansByOrder) {
    const orderName = plans[0].order.name;
    try {
      // Al final del presupuesto, tras las lineas y secciones que ya tenga.
      let sequence = await nextSaleLineSequence(orderId);
      for (const plan of plans) {
        const vals: Record<string, unknown> = {
          order_id: orderId,
          name: plan.description,
          product_uom_qty: plan.quantity,
          price_unit: plan.priceUnit,
        };
        const tax = await findTaxCommand(plan.taxRate, "sale");
        setIfWritable(fields, vals, "sequence", sequence);
        // Coste real de la linea: el margen del presupuesto se calcula contra esto.
        setIfWritable(fields, vals, "purchase_price", plan.costUnit);
        setIfWritable(fields, vals, "tax_id", tax);
        setIfWritable(fields, vals, "tax_ids", tax);
        validateWritable(fields, vals, "sale.order.line");
        const lineCreated = await client.call<number[] | number>("sale.order.line", "create", { vals_list: [vals] });
        created.push({ orderId, orderName, lineId: Array.isArray(lineCreated) ? lineCreated[0] : lineCreated });
        sequence += 1;
      }
    } catch (error) {
      warnings.push(
        `No se pudieron anadir todas las lineas al presupuesto ${orderName}: ${error instanceof Error ? error.message : "error desconocido"}`,
      );
    }
  }

  return { created, warnings };
}

async function nextSaleLineSequence(orderId: number): Promise<number> {
  const rows = await client.call<SequenceRow[]>("sale.order.line", "search_read", {
    domain: [["order_id", "=", orderId]],
    fields: ["sequence"],
    order: "sequence desc",
    limit: 1,
  });
  return rows[0] ? (rows[0].sequence ?? 10) + 1 : 10;
}

export async function createPurchaseFromImage(imagePath: string): Promise<CreatedPurchase> {
  const preview = await getPurchasePreview(imagePath);
  if (preview.warnings.some((warning) => warning.toLowerCase().includes("falta proveedor"))) {
    throw new Error(`Compra no creada: ${preview.warnings.join(" ")}`);
  }

  return createPurchaseOrder(preview);
}

export async function attachImageToPurchase(orderId: number, imagePath: string): Promise<number> {
  const fields = await client.fieldsGet("ir.attachment");
  const vals: Record<string, unknown> = {
    name: `Imagen compra - ${basename(imagePath)}`,
    res_model: "purchase.order",
    res_id: orderId,
    datas: readFileSync(imagePath).toString("base64"),
  };
  validateWritable(fields, vals, "ir.attachment");
  const created = await client.call<number[] | number>("ir.attachment", "create", { vals_list: [vals] });
  return Array.isArray(created) ? created[0] : created;
}

async function createPurchaseLines(orderId: number, preview: PurchasePreview) {
  const fields = await client.fieldsGet("purchase.order.line");
  const datePlanned = `${preview.extracted.date || new Date().toISOString().slice(0, 10)} 12:00:00`;

  for (const line of preview.lines) {
    const vals: Record<string, unknown> = {
      order_id: orderId,
      product_id: line.product.id,
      name: line.description,
      product_qty: line.quantity,
      price_unit: line.unitPrice,
    };
    setIfWritable(fields, vals, "date_planned", datePlanned);
    setIfWritable(fields, vals, "product_uom", line.product.uomPoId);
    setIfWritable(fields, vals, "taxes_id", await findTaxCommand(line.taxRate));
    setIfWritable(fields, vals, "analytic_distribution", line.analytic ? { [String(line.analytic.id)]: 100 } : undefined);
    validateWritable(fields, vals, "purchase.order.line");
    await client.call<number[] | number>("purchase.order.line", "create", { vals_list: [vals] });
  }
}

async function forcePurchaseDraft(orderId: number): Promise<void> {
  await client.call<boolean>("purchase.order", "write", {
    ids: [orderId],
    vals: { state: "draft" },
  });
}

async function findTaxCommand(taxRate?: number, type: "purchase" | "sale" = "purchase"): Promise<unknown | undefined> {
  if (typeof taxRate !== "number" || taxRate <= 0) {
    return undefined;
  }

  const rows = await client.call<TaxRow[]>("account.tax", "search_read", {
    domain: [
      ["amount", "=", taxRate],
      ["type_tax_use", "=", type],
    ],
    fields: ["id", "name", "amount"],
    limit: 1,
  }).catch(() => []);

  return rows[0] ? [[6, 0, [rows[0].id]]] : undefined;
}

async function findPickingTypeId(): Promise<number | undefined> {
  const env = getPurchaseEnv();
  if (!env.DEFAULT_PURCHASE_LOCATION) {
    return undefined;
  }

  const rows = await client.call<PickingTypeRow[]>("stock.picking.type", "search_read", {
    domain: [
      "|",
      ["complete_name", "ilike", env.DEFAULT_PURCHASE_LOCATION],
      ["name", "ilike", env.DEFAULT_PURCHASE_LOCATION],
    ],
    fields: ["id", "name", "complete_name"],
    limit: 1,
  }).catch(() => []);

  return rows[0]?.id;
}

function setIfWritable(fields: Record<string, { readonly?: boolean }>, vals: Record<string, unknown>, field: string, value: unknown) {
  if (value !== undefined && fields[field] && !fields[field].readonly) {
    vals[field] = value;
  }
}

function validateWritable(fields: Record<string, { readonly?: boolean }>, vals: Record<string, unknown>, model: string) {
  const missing = Object.keys(vals).filter((field) => !fields[field]);
  if (missing.length) {
    throw new Error(`${model}: campos no disponibles en Odoo: ${missing.join(", ")}`);
  }

  const readonly = Object.keys(vals).filter((field) => fields[field]?.readonly);
  if (readonly.length) {
    throw new Error(`${model}: campos de solo lectura: ${readonly.join(", ")}`);
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function productLookupQueries(line: { description: string; productReference?: string }): string[] {
  const description = line.description.trim();
  const reference = line.productReference?.trim() || "";
  const dimension = description.match(/\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?(?:\s*x\s*\d+(?:[.,]\d+)?)?/i)?.[0];
  const firstWord = description.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/)?.[0] || "";
  const withoutLength = description.replace(/\bL\s*\d+\b/gi, "").replace(/\b\d{3,}\s*(MM|CM|M)?\b/gi, "").trim();

  return uniqueNonEmpty([
    reference,
    description,
    reusableProductFamily(description),
    dimension && firstWord ? `${firstWord} ${dimension}` : "",
    withoutLength,
    simplifyProductText(description),
  ]).filter((query) => query.length >= 3);
}

export function scoreProductMatch(line: { description: string; productReference?: string }, product: ProductRow): number {
  const target = simplifyProductText(normalizeParameterizedDescription(line.description));
  const candidate = simplifyProductText(`${product.default_code || ""} ${product.display_name || ""} ${product.name || ""}`);

  if (line.productReference && simplifyProductText(product.default_code || "") === simplifyProductText(line.productReference)) {
    return 1;
  }

  const targetTokens = tokenSet(target);
  const candidateTokens = tokenSet(candidate);
  if (targetTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const common = targetTokens.filter((token) => candidateTokens.includes(token));
  const dimensionBoost = sharedDimension(line.description, `${product.display_name || ""} ${product.name || ""}`) ? 0.25 : 0;
  const familyBoost = sharedWorkshopFamily(line.description, `${product.display_name || ""} ${product.name || ""}`) ? 0.15 : 0;
  const reusableFamilyBoost = sharedReusableProductFamily(
    line.description,
    `${product.display_name || ""} ${product.name || ""}`,
  ) ? 0.2 : 0;
  const coverage = common.length / targetTokens.length;
  const precision = common.length / candidateTokens.length;
  const containsBoost = candidate.includes(target) || target.includes(candidate) ? 0.2 : 0;
  return Math.min(
    1,
    coverage * 0.55 + precision * 0.25 + containsBoost + dimensionBoost + familyBoost + reusableFamilyBoost,
  );
}

function simplifyProductText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/(\d)([A-Z])/g, "$1 $2")
    .replace(/([A-Z])(\d)/g, "$1 $2")
    .replace(/(\d)\s*[X*]\s*(\d)/g, "$1 X $2")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(UN|UD|UNDS|UND|MM|CM|M|A|C|AC|REF|REFERENCIA|DIAM)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): string[] {
  return Array.from(new Set(value.split(" ").filter((token) => token.length >= 2)));
}

function looksSpecificEnoughToCreate(description: string): boolean {
  const tokens = tokenSet(simplifyProductText(description));
  return tokens.length >= 2 && description.trim().length >= 6 && !isParameterizedWorkshopMaterial(description);
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim() || "").filter(Boolean)));
}

function normalizeParameterizedDescription(description: string): string {
  const dimension = description.match(/\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?(?:\s*x\s*\d+(?:[.,]\d+)?)?/i)?.[0] || "";
  const family = description.match(/\b(TUBO|PERFIL|CHAPA|PLETINA|ANGULAR|REDONDO|CUADRADO|BARRA|VIGA|IPN|IPE|HEA|HEB|UPN)\b/i)?.[0] || "";
  if (family && dimension) {
    return `${family} ${dimension}`;
  }

  return description.replace(/\bL\s*\d+\b/gi, "").replace(/\b\d{4,}\b/g, "");
}

export function genericWorkshopProductName(description: string): string {
  const family = workshopFamily(description);
  const dimension = normalizeDimension(description);
  const scheduledTube = genericScheduledTubeName(description);
  if (scheduledTube) {
    return scheduledTube;
  }
  if (!family || !dimension) {
    return "";
  }

  if (family === "TUBO" && /\bREDONDO\b/i.test(description)) {
    return `TUBO DIAMETRO ${formatDimension(dimension)}`;
  }

  return `${family} ${formatDimension(dimension)}`;
}

export function cleanReusableProductName(description: string): string {
  return description
    .replace(/^\s*(?=[A-Z0-9-]*\d)[A-Z0-9-]{5,}\s+/, "")
    .replace(/\bVENTIDAOR\b/gi, "VENTILADOR")
    .replace(/\s+/g, " ")
    .trim();
}

export function genericLaserProductName(description: string, vendorName = ""): string {
  const normalized = simplifyProductText(description);
  if (/\b(DESARROLLO|DESARROLLADO)\b/.test(normalized) && !/\bCORTE\b/.test(normalized)) {
    return "DESARROLLO";
  }
  if (/\b(CORTE|LASER)\b/.test(normalized)) {
    return "CORTE LASER";
  }
  if (/LASER/.test(simplifyProductText(vendorName))) {
    return "CORTE LASER";
  }
  return "";
}

function normalizeName(value?: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function normalizeVat(value?: string): string {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sharedDimension(left: string, right: string): boolean {
  const leftDimension = normalizeDimension(left);
  return Boolean(leftDimension && leftDimension === normalizeDimension(right));
}

function normalizeDimension(value: string): string {
  return (
    value
      .match(/\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?(?:\s*x\s*\d+(?:[.,]\d+)?)?/i)?.[0]
      ?.replace(/\s+/g, "")
      .replace(/,/g, ".")
      .toUpperCase() || ""
  );
}

function formatDimension(value: string): string {
  return value.replace(/X/g, " X ").replace(/\./g, ",").replace(/\s+/g, " ").trim();
}

function sharedWorkshopFamily(left: string, right: string): boolean {
  const leftFamily = workshopFamily(left);
  return Boolean(leftFamily && leftFamily === workshopFamily(right));
}

export function reusableProductFamily(value: string): string {
  const normalized = simplifyProductText(value);
  return normalized.match(/\b(TAPON|TUBO|LASER|CORTE|DESARROLLO)\b/)?.[0] || "";
}

function sharedReusableProductFamily(left: string, right: string): boolean {
  const leftFamily = reusableProductFamily(left);
  const rightFamily = reusableProductFamily(right);
  if (!leftFamily || !rightFamily) return false;
  const laserFamilies = new Set(["LASER", "CORTE"]);
  return leftFamily === rightFamily || (laserFamilies.has(leftFamily) && laserFamilies.has(rightFamily));
}

function workshopFamily(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .match(/\b(TUBO|PERFIL|CHAPA|PLETINA|ANGULAR|REDONDO|CUADRADO|BARRA|VIGA|IPN|IPE|HEA|HEB|UPN)\b/)?.[0] || "";
}

function isParameterizedWorkshopMaterial(description: string): boolean {
  return Boolean(
    (workshopFamily(description) && normalizeDimension(description)) || genericScheduledTubeName(description),
  );
}

function genericScheduledTubeName(description: string): string {
  const normalized = simplifyProductText(description);
  if (!/\bTUBO\b/.test(normalized) || !/\bSCH\s*\d+\b/.test(normalized)) {
    return "";
  }

  const material = normalized.match(/\bINOX(?:IDABLE)?(?:\s+\d{3}[A-Z]?)?\b/)?.[0] || "";
  const schedule = normalized.match(/\bSCH\s*\d+\b/)?.[0].replace(/\s+/g, "") || "";
  const diameter = normalized.match(/\b\d+(?:[.,]\d+)?\s*(?:PULGADAS|PULGADA|\")?\s+SCH\b/)?.[0]
    ?.replace(/\s+SCH$/i, "")
    .trim() || "";
  return ["TUBO", material, diameter, schedule].filter(Boolean).join(" ");
}
