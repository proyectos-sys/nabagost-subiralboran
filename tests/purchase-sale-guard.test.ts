import { beforeEach, describe, expect, it, vi } from "vitest";

const callMock = vi.hoisted(() => vi.fn());

vi.mock("../src/purchase-image/odoo-json2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/purchase-image/odoo-json2")>()),
  OdooJson2Client: class {
    call = callMock;
  },
}));

import { findManualLabourLines, findSaleOrder } from "../src/purchase-image/purchase-service";

describe("lineas de mano de obra que indican un presupuesto rellenado a mano", () => {
  it("detecta soldadura y horas de oficial, peon y pintura", () => {
    const lines = [
      { name: "Soldadura/Montaje", product_id: [3, "Soldadura/Montaje"] as [number, string] },
      { name: "Horas Oficial ANGEL", product_id: [1, "Horas Oficial"] as [number, string] },
      { name: "HORAS PINTAR", product_id: [9, "HORAS PINTAR"] as [number, string] },
      { name: "Horas Peón", product_id: false as const },
    ];

    expect(findManualLabourLines(lines)).toEqual(["Soldadura/Montaje", "Horas Oficial", "HORAS PINTAR", "Horas Peón"]);
  });

  it("no se confunde con material, desplazamientos ni con lineas que anadio la propia IA", () => {
    expect(
      findManualLabourLines([
        { name: "TUBO 80 X 80 X 2 GALVA", product_id: [50, "TUBO 80 X 80 X 2 GALVA"] },
        { name: "Varilla de soldadura", product_id: [51, "Varilla de soldadura"] },
        { name: "DESPLAZAMIENTO", product_id: [52, "DESPLAZAMIENTO"] },
        { name: "[IA] Soldadura de pieza (albarán A-1 · HIMECAS)", product_id: false },
      ]),
    ).toEqual([]);
  });

  it("reconoce el producto aunque Odoo lo muestre con su codigo interno", () => {
    expect(findManualLabourLines([{ name: "Horas Oficial", product_id: [1, "[HO-01] Horas Oficial"] }])).toEqual(["Horas Oficial"]);
  });
});

describe("findSaleOrder no duplica presupuestos ya rellenados a mano", () => {
  const sale = { id: 7, name: "S00055", state: "sale", partner_id: [4, "Cliente Demo"] };

  function odooWith(lines: unknown[] | Error) {
    callMock.mockImplementation(async (model: string) => {
      if (model === "sale.order") return [sale];
      if (lines instanceof Error) throw lines;
      return lines;
    });
  }

  beforeEach(() => {
    callMock.mockReset();
  });

  it("devuelve el presupuesto si solo tiene material", async () => {
    odooWith([{ name: "TUBO", product_id: [50, "TUBO"] }]);
    const warnings: string[] = [];

    expect(await findSaleOrder("S55", undefined, warnings)).toMatchObject({ id: 7, name: "S00055" });
    expect(warnings).toEqual([]);
  });

  it("no anade linea si el presupuesto ya tiene horas oficial o soldadura, y lo avisa", async () => {
    odooWith([
      { name: "TUBO", product_id: [50, "TUBO"] },
      { name: "Soldadura/Montaje", product_id: [3, "Soldadura/Montaje"] },
    ]);
    const warnings: string[] = [];

    expect(await findSaleOrder("S55", undefined, warnings)).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("S00055");
    expect(warnings[0]).toContain('"Soldadura/Montaje"');
    expect(warnings[0]).toContain("no duplicar");
  });

  it("si no puede leer las lineas no arriesga a duplicar y no rompe la compra", async () => {
    odooWith(new Error("Odoo respondio 500"));
    const warnings: string[] = [];

    expect(await findSaleOrder("S55", undefined, warnings)).toBeUndefined();
    expect(warnings[0]).toContain("No se pudieron comprobar las lineas del presupuesto S00055");
  });

  it("solo pide las lineas reales del presupuesto elegido, sin secciones ni notas", async () => {
    odooWith([]);
    await findSaleOrder("S55", undefined, []);

    expect(callMock).toHaveBeenCalledWith(
      "sale.order.line",
      "search_read",
      expect.objectContaining({ domain: [["order_id", "=", 7], ["display_type", "=", false]] }),
    );
  });
});
