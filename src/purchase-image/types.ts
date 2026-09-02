import { z } from "zod";

export const purchaseLineSchema = z.object({
  productReference: z.string().trim().optional().default(""),
  description: z.string().trim().min(1),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(100).optional(),
  jobRef: z.string().trim().optional().default(""),
});

export const extractedPurchaseSchema = z.object({
  vendorName: z.string().trim().optional().default(""),
  vendorVat: z.string().trim().optional().default(""),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .default(""),
  reference: z.string().trim().optional().default(""),
  lines: z.array(purchaseLineSchema).min(1),
  total: z.number().min(0).optional().default(0),
  documentJobRef: z.string().trim().optional().default(""),
});

export type PurchaseLineInput = z.infer<typeof purchaseLineSchema>;
export type ExtractedPurchaseData = z.infer<typeof extractedPurchaseSchema>;

export type VendorMatch = {
  id: number;
  name: string;
  source: "vat" | "name" | "default";
};

export type ProductMatch = {
  id: number;
  name: string;
  uomPoId?: number;
  source: "match" | "fallback" | "doubt";
};

export type AnalyticMatch = {
  id: number;
  name: string;
  source: "code" | "name";
};

export type PurchasePreviewLine = PurchaseLineInput & {
  product: ProductMatch;
  subtotal: number;
  analytic?: AnalyticMatch;
};

export type PurchasePreview = {
  needs_confirmation: true;
  imagePath: string;
  extracted: ExtractedPurchaseData;
  vendor?: VendorMatch;
  lines: PurchasePreviewLine[];
  warnings: string[];
  totalExtracted: number;
  totalLines: number;
  documentAnalytic?: AnalyticMatch;
};

export type CreatedPurchase = {
  id: number;
  name: string;
  url: string;
  preview: PurchasePreview;
};
