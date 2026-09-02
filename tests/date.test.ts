import { describe, expect, it } from "vitest";
import { formatDuration, minutesToDecimalHours } from "../lib/date";

describe("utilidades de duracion", () => {
  it("convierte minutos a horas decimales", () => {
    expect(minutesToDecimalHours(90)).toBe(1.5);
    expect(minutesToDecimalHours(15)).toBe(0.25);
  });

  it("formatea duraciones para la interfaz", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(135)).toBe("2 h 15 min");
  });
});
