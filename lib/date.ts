export function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("No se pudo calcular la fecha del servidor.");
  }

  return `${year}-${month}-${day}`;
}

export function nowForOdoo(): string {
  return formatOdooDateTime(new Date());
}

export function todayBoundsForOdoo(timeZone: string): { start: string; end: string } {
  const today = todayInTimeZone(timeZone);
  return dateBoundsForOdoo(today);
}

export function dateBoundsForOdoo(date: string): { start: string; end: string } {
  return {
    start: `${date} 00:00:00`,
    end: `${date} 23:59:59`,
  };
}

export function formatOdooDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function parseOdooDateTime(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

export function formatTimeInZone(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(parseOdooDateTime(value));
}

export function diffMinutes(start: string, end: string): number {
  return Math.max(0, Math.round((parseOdooDateTime(end).getTime() - parseOdooDateTime(start).getTime()) / 60000));
}

export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}
