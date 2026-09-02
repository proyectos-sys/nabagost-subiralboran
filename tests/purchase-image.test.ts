import { describe, expect, it } from "vitest";
import { extractedPurchaseSchema } from "../src/purchase-image/types";
import { withoutSecrets } from "../src/purchase-image/env";
import { cleanReusableProductName, genericWorkshopProductName, productLookupQueries, reusableProductFamily, scoreProductMatch } from "../src/purchase-image/purchase-service";

describe("purchase image schemas", () => {
  it("valida la extraccion minima de una imagen de compra", () => {
    const data = extractedPurchaseSchema.parse({
      vendorName: "Proveedor Demo",
      vendorVat: "B00000000",
      date: "2026-06-20",
      reference: "FAC-1",
      lines: [{ description: "Chapa acero", quantity: 2, unitPrice: 10.5, taxRate: 21 }],
      total: 25.41,
    });

    expect(data.lines[0].quantity).toBe(2);
    expect(data.lines[0].productReference).toBe("");
    expect(data.total).toBe(25.41);
    expect(data.lines[0].jobRef).toBe("");
    expect(data.documentJobRef).toBe("");
  });

  it("acepta faena anotada a mano por linea y a nivel de documento", () => {
    const data = extractedPurchaseSchema.parse({
      vendorName: "Proveedor Demo",
      lines: [
        { description: "Chapa acero", quantity: 1, unitPrice: 10, jobRef: "S55" },
        { description: "Tubo redondo", quantity: 1, unitPrice: 5 },
      ],
      documentJobRef: "S66",
    });

    expect(data.lines[0].jobRef).toBe("S55");
    expect(data.lines[1].jobRef).toBe("");
    expect(data.documentJobRef).toBe("S66");
  });

  it("oculta secretos en mensajes de error", () => {
    expect(withoutSecrets("Authorization: bearer abc123")).not.toContain("abc123");
    expect(withoutSecrets("OpenAI sk-test123")).not.toContain("sk-test123");
  });

  it("genera busquedas simplificadas para productos de taller", () => {
    const queries = productLookupQueries({
      productReference: "0726TUB0001",
      description: "TUBO 40x20x2 L1125 A.C.",
    });

    expect(queries).toContain("0726TUB0001");
    expect(queries).toContain("TUBO 40x20x2");
  });

  it("puntua mejor productos existentes similares que textos sin relacion", () => {
    const line = { productReference: "", description: "TUBO 40x20x2 L1125 A.C." };
    const good = scoreProductMatch(line, { id: 1, display_name: "TUBO 40 X 20 X 2 ACERO" });
    const bad = scoreProductMatch(line, { id: 2, display_name: "BROCA HSS 2,5 MM" });

    expect(good).toBeGreaterThan(bad);
    expect(good).toBeGreaterThan(0.55);
  });

  it("ignora largos o codigos de albaran al casar tubos por medidas", () => {
    const line = { productReference: "0726TUB0001", description: "TUBO 40x20x2 L1125 A.C." };
    const genericTube = scoreProductMatch(line, { id: 1, display_name: "TUBO 40 X 20 X 2" });
    const otherTube = scoreProductMatch(line, { id: 2, display_name: "TUBO 30 X 30 X 2" });

    expect(genericTube).toBeGreaterThan(0.75);
    expect(genericTube).toBeGreaterThan(otherTube);
  });

  it("convierte tubos de albaran en productos genericos reutilizables", () => {
    expect(genericWorkshopProductName("TUBO 40x20x2 L2080 A.C.")).toBe("TUBO 40 X 20 X 2");
    expect(genericWorkshopProductName("TUBO CUADRADO 40x40x1,5")).toBe("TUBO 40 X 40 X 1,5");
    expect(genericWorkshopProductName("TUBO RECTANGULAR 80x40x1,5")).toBe("TUBO 80 X 40 X 1,5");
    expect(genericWorkshopProductName("TUBO REDONDO 16x1,5")).toBe("TUBO DIAMETRO 16 X 1,5");
  });

  it("no elimina palabras descriptivas largas al crear productos reutilizables", () => {
    expect(cleanReusableProductName("PISTOLA GRAVEDAD JUNIOR G 1.8")).toBe("PISTOLA GRAVEDAD JUNIOR G 1.8");
    expect(cleanReusableProductName("SAG20141902 PISTOLA GRAVEDAD JUNIOR G 1.8")).toBe("PISTOLA GRAVEDAD JUNIOR G 1.8");
    expect(cleanReusableProductName("N01AW91004 ESMALTE S/R SINT. INDUSTRIAL BLANCO 4L")).toBe("ESMALTE S/R SINT. INDUSTRIAL BLANCO 4L");
  });

  it("busca primero familias reutilizables para tapones, tubos y laser", () => {
    expect(reusableProductFamily("TAPON PLASTICO 60 X 20 MM")).toBe("TAPON");
    expect(reusableProductFamily("TUBO RECTANGULAR 40 X 20 X 2")).toBe("TUBO");
    expect(reusableProductFamily("CORTE LASER DE PIEZA")).toBe("CORTE");

    const queries = productLookupQueries({ description: "TAPON PLASTICO 60 X 20 MM" });
    expect(queries).toContain("TAPON");
  });

  it("considera equivalentes las familias corte y laser", () => {
    const existingLaser = scoreProductMatch(
      { description: "CORTE LASER" },
      { id: 1, display_name: "LASER" },
    );
    expect(existingLaser).toBeGreaterThan(0.55);
  });

  it("considera equivalentes formatos de capacidad juntos o separados", () => {
    const disolvente = scoreProductMatch(
      { description: "DISOLVENTE MULTIUSOS UNIVERSAL 25L" },
      { id: 1, display_name: "DISOLVENTE UNIVERSAL 25 L" },
    );
    const esmalte = scoreProductMatch(
      { description: "BASE TR ESMALTE S/R BRILLO 750ML NEGRO" },
      { id: 2, display_name: "BASE TR ESMALTE S/R BRILLO 750 NEGRO" },
    );
    expect(disolvente).toBeGreaterThan(0.55);
    expect(esmalte).toBeGreaterThan(0.55);
  });
});
