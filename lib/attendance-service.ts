import {
  dateBoundsForOdoo,
  diffMinutes,
  formatOdooDateTime,
  formatDuration,
  formatTimeInZone,
  nowForOdoo,
  todayInTimeZone,
} from "./date";
import { getEnv } from "./env";
import { mockEmployees } from "./mock-data";
import { odooClient } from "./odoo-client";
import type { Employee } from "./schemas";

type OdooFieldMap = Record<string, unknown>;
type Many2One = false | [number, string];

type OdooAttendance = {
  id: number;
  employee_id?: Many2One;
  check_in?: string;
  check_out?: false | string;
};

type AttendanceInterval = {
  id: number;
  checkIn: string;
  checkOut: string | null;
  startLabel: string;
  endLabel: string;
  durationMinutes: number;
};

type AttendanceStatus = {
  employee: Employee;
  state: "inside" | "outside";
  openAttendanceId: number | null;
  intervals: AttendanceInterval[];
  totalMinutes: number;
  totalLabel: string;
  date: string;
};

const mockAttendances: OdooAttendance[] = [];

function hasField(fields: OdooFieldMap, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(fields, field);
}

async function getAttendanceFields() {
  const fields = await odooClient.call<OdooFieldMap>("hr.attendance", "fields_get", {
    attributes: ["string", "type", "relation", "required", "readonly"],
  });
  const missing = ["employee_id", "check_in", "check_out"].filter((field) => !hasField(fields, field));

  if (missing.length > 0) {
    throw new Error(`Odoo no expone en hr.attendance los campos necesarios: ${missing.join(", ")}.`);
  }

  return fields;
}

export async function listAttendanceEmployees(): Promise<Employee[]> {
  const env = getEnv();

  if (env.MOCK_ODOO) {
    return mockEmployees;
  }

  const fields = await odooClient.call<OdooFieldMap>("hr.employee", "fields_get", {
    attributes: ["string", "type", "relation", "required", "readonly"],
  });

  if (!hasField(fields, "name") || !hasField(fields, "active")) {
    throw new Error("Odoo no expone los campos name/active en hr.employee.");
  }

  const employees = await odooClient.call<Array<{ id: number; name?: string; active?: boolean }>>(
    "hr.employee",
    "search_read",
    {
      domain: [["active", "=", true]],
      fields: ["id", "name", "active"],
      order: "name",
      limit: 200,
    },
  );

  return employees.map((employee) => ({
    id: employee.id,
    name: employee.name || `Empleado ${employee.id}`,
    active: employee.active ?? true,
  }));
}

export async function getAttendanceStatus(employeeId: number): Promise<AttendanceStatus> {
  const env = getEnv();
  const employees = await listAttendanceEmployees();
  const employee = employees.find((candidate) => candidate.id === employeeId);

  if (!employee || !employee.active) {
    throw new Error("El empleado seleccionado no esta activo.");
  }

  const date = todayInTimeZone(env.APP_TIMEZONE);

  if (env.MOCK_ODOO) {
    return buildStatus(employee, mockAttendances.filter((attendance) => many2OneId(attendance.employee_id) === employeeId), date);
  }

  await getAttendanceFields();
  const latest = await odooClient.call<OdooAttendance[]>("hr.attendance", "search_read", {
    domain: [["employee_id", "=", employeeId]],
    fields: ["id", "employee_id", "check_in", "check_out"],
    order: "check_in desc",
    limit: 1,
  });
  const { start, end } = dateBoundsForOdoo(date);
  const todayAttendances = await odooClient.call<OdooAttendance[]>("hr.attendance", "search_read", {
    domain: [
      ["employee_id", "=", employeeId],
      ["check_in", ">=", start],
      ["check_in", "<=", end],
    ],
    fields: ["id", "employee_id", "check_in", "check_out"],
    order: "check_in asc",
    limit: 50,
  });

  return buildStatus(employee, mergeLatest(todayAttendances, latest[0]), date);
}

export async function checkIn(employeeId: number, occurredAt?: string) {
  const env = getEnv();
  const status = await getAttendanceStatus(employeeId);

  if (status.state === "inside") {
    throw new Error("Este empleado ya esta dentro. No se puede fichar otra entrada sin salida.");
  }

  const now = occurredAt ? formatOdooDateTime(new Date(occurredAt)) : nowForOdoo();

  if (env.MOCK_ODOO) {
    const id = Math.floor(Math.random() * 100000);
    mockAttendances.push({ id, employee_id: [employeeId, status.employee.name], check_in: now, check_out: false });
    return getAttendanceStatus(employeeId);
  }

  await getAttendanceFields();
  await odooClient.call<number[] | number>("hr.attendance", "create", {
    vals_list: [{ employee_id: employeeId, check_in: now }],
  });

  return getAttendanceStatus(employeeId);
}

export async function checkOut(employeeId: number, occurredAt?: string) {
  const env = getEnv();
  const status = await getAttendanceStatus(employeeId);

  if (status.state === "outside" || !status.openAttendanceId) {
    throw new Error("Este empleado esta fuera. No se puede fichar salida sin una entrada abierta.");
  }

  const now = occurredAt ? formatOdooDateTime(new Date(occurredAt)) : nowForOdoo();

  if (env.MOCK_ODOO) {
    const attendance = mockAttendances.find((candidate) => candidate.id === status.openAttendanceId);
    if (attendance) {
      attendance.check_out = now;
    }
    return getAttendanceStatus(employeeId);
  }

  await getAttendanceFields();
  await odooClient.call<boolean>("hr.attendance", "write", {
    ids: [status.openAttendanceId],
    vals: { check_out: now },
  });

  return getAttendanceStatus(employeeId);
}

function buildStatus(employee: Employee, attendances: OdooAttendance[], date: string): AttendanceStatus {
  const env = getEnv();
  const sorted = attendances
    .filter((attendance) => attendance.check_in)
    .sort((left, right) => String(left.check_in).localeCompare(String(right.check_in)));
  const latest = sorted[sorted.length - 1];
  const open = latest && !latest.check_out ? latest : null;
  const now = nowForOdoo();
  const intervals = sorted.map((attendance) => {
    const checkIn = String(attendance.check_in);
    const checkOut = attendance.check_out ? String(attendance.check_out) : null;
    const endForDuration = checkOut || now;
    const durationMinutes = diffMinutes(checkIn, endForDuration);

    return {
      id: attendance.id,
      checkIn,
      checkOut,
      startLabel: formatTimeInZone(checkIn, env.APP_TIMEZONE),
      endLabel: checkOut ? formatTimeInZone(checkOut, env.APP_TIMEZONE) : "Dentro",
      durationMinutes,
    };
  });
  const totalMinutes = intervals.reduce((sum, interval) => sum + interval.durationMinutes, 0);

  return {
    employee,
    state: open ? "inside" : "outside",
    openAttendanceId: open ? open.id : null,
    intervals,
    totalMinutes,
    totalLabel: formatDuration(totalMinutes),
    date,
  };
}

function mergeLatest(todayAttendances: OdooAttendance[], latest?: OdooAttendance): OdooAttendance[] {
  if (!latest || todayAttendances.some((attendance) => attendance.id === latest.id)) {
    return todayAttendances;
  }

  return latest.check_out ? todayAttendances : [...todayAttendances, latest];
}

function many2OneId(value: Many2One | undefined): number | null {
  return Array.isArray(value) ? value[0] : null;
}
