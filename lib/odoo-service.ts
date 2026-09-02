import { getEnv } from "./env";
import { minutesToDecimalHours, todayInTimeZone } from "./date";
import { mockEmployees, mockTasks } from "./mock-data";
import { odooClient, type OdooModel } from "./odoo-client";
import type { Employee, Task, TimesheetInput } from "./schemas";

type OdooFieldMap = Record<string, unknown>;
type Many2One = false | [number, string];
type FieldDescriptor = {
  string?: string;
  type?: string;
  relation?: string;
  required?: boolean;
  readonly?: boolean;
};

type OdooProject = {
  id: number;
  name: string;
};

type OdooTask = {
  id: number;
  name?: string;
  active?: boolean;
  project_id?: Many2One;
  stage_id?: Many2One;
  partner_id?: Many2One;
  effective_hours?: number;
  total_hours_spent?: number;
  unit_amount?: number;
};

type OdooEmployee = {
  id: number;
  name?: string;
  active?: boolean;
};

function hasField(fields: OdooFieldMap, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(fields, name);
}

function getField(fields: OdooFieldMap, name: string): FieldDescriptor | null {
  if (!hasField(fields, name)) {
    return null;
  }

  return fields[name] as FieldDescriptor;
}

async function getFields(model: OdooModel): Promise<OdooFieldMap> {
  return odooClient.call<OdooFieldMap>(model, "fields_get", {
    attributes: ["string", "type", "relation", "required", "readonly"],
  });
}

function assertFields(model: OdooModel, fields: OdooFieldMap, requiredFields: string[]) {
  const missing = requiredFields.filter((field) => !hasField(fields, field));
  if (missing.length > 0) {
    throw new Error(`Odoo no expone en ${model} los campos necesarios: ${missing.join(", ")}.`);
  }
}

function many2OneId(value: Many2One | undefined): number | null {
  return Array.isArray(value) ? value[0] : null;
}

function many2OneName(value: Many2One | undefined): string | undefined {
  return Array.isArray(value) ? value[1] : undefined;
}

async function getProjectByName(projectName: string): Promise<OdooProject> {
  const projects = await odooClient.call<OdooProject[]>("project.project", "search_read", {
    domain: [["name", "=", projectName]],
    fields: ["id", "name"],
    limit: 1,
  });

  const project = projects[0];
  if (!project) {
    throw new Error(`No se ha encontrado el proyecto "${projectName}" en Odoo.`);
  }

  return project;
}

export async function listTasks(): Promise<Task[]> {
  const env = getEnv();
  if (env.MOCK_ODOO) {
    return mockTasks;
  }

  const [project, fields] = await Promise.all([
    getProjectByName(env.ODOO_PROJECT_NAME),
    getFields("project.task"),
  ]);

  assertFields("project.task", fields, ["name", "active", "project_id", "stage_id"]);

  const optionalFields = ["partner_id", "effective_hours", "total_hours_spent", "unit_amount"].filter(
    (field) => hasField(fields, field),
  );
  const requestedFields = ["id", "name", "project_id", "stage_id", ...optionalFields];
  const domain: unknown[] = [["project_id", "=", project.id]];

  domain.push(["active", "=", true]);
  requestedFields.push("active");

  const tasks = await odooClient.call<OdooTask[]>("project.task", "search_read", {
    domain,
    fields: requestedFields,
    order: "stage_id, sequence, name",
    limit: 200,
  });

  return tasks.map((task) => {
    const hours = task.effective_hours ?? task.total_hours_spent ?? task.unit_amount ?? undefined;

    return {
      id: task.id,
      name: task.name || `Tarea ${task.id}`,
      projectId: project.id,
      projectName: project.name,
      stage: {
        id: many2OneId(task.stage_id) ?? 0,
        name: many2OneName(task.stage_id) || "Sin etapa",
      },
      customerName: many2OneName(task.partner_id),
      hoursRegistered: typeof hours === "number" ? hours : undefined,
    };
  });
}

export async function listEmployees(): Promise<Employee[]> {
  const env = getEnv();
  if (env.MOCK_ODOO) {
    return mockEmployees;
  }

  const fields = await getFields("hr.employee");
  assertFields("hr.employee", fields, ["name", "active"]);

  const requestedFields = ["id", "name"];
  const domain: unknown[] = [["active", "=", true]];
  requestedFields.push("active");

  const employees = await odooClient.call<OdooEmployee[]>("hr.employee", "search_read", {
    domain,
    fields: requestedFields,
    order: "name",
    limit: 200,
  });

  return employees.map((employee) => ({
    id: employee.id,
    name: employee.name || `Empleado ${employee.id}`,
    active: employee.active ?? true,
  }));
}

export async function createTimesheet(input: TimesheetInput) {
  const env = getEnv();
  const [tasks, employees] = await Promise.all([listTasks(), listEmployees()]);
  const task = tasks.find((candidate) => candidate.id === input.taskId);
  const employee = employees.find((candidate) => candidate.id === input.employeeId);

  if (!employee || !employee.active) {
    throw new Error("El empleado seleccionado no esta activo.");
  }

  if (!task || task.projectName !== env.ODOO_PROJECT_NAME) {
    throw new Error("La tarea seleccionada no pertenece al proyecto configurado.");
  }

  if (input.durationMinutes < 1 || input.durationMinutes > 24 * 60) {
    throw new Error("La duracion debe estar entre 1 minuto y 24 horas.");
  }

  const date = input.date || todayInTimeZone(env.APP_TIMEZONE);
  const unitAmount = minutesToDecimalHours(input.durationMinutes);
  const description = input.description.trim();

  if (env.MOCK_ODOO) {
    return {
      id: Math.floor(Math.random() * 100000),
      date,
      unitAmount,
      task,
      employee,
    };
  }

  const fields = await getFields("account.analytic.line");
  const vals: Record<string, unknown> = {
    name: description,
    employee_id: employee.id,
    project_id: task.projectId,
    task_id: task.id,
    date,
    unit_amount: unitAmount,
  };

  validateTimesheetFields(fields, vals);

  const created = await odooClient.call<number[] | number>("account.analytic.line", "create", {
    vals_list: [vals],
  });

  return {
    id: Array.isArray(created) ? created[0] : created,
    date,
    unitAmount,
    task,
    employee,
  };
}

function validateTimesheetFields(fields: OdooFieldMap, vals: Record<string, unknown>) {
  const missing = Object.keys(vals).filter((key) => !hasField(fields, key));

  if (missing.length > 0) {
    throw new Error(
      `Odoo no expone los campos necesarios para crear partes: ${missing.join(
        ", ",
      )}. Revisa que la app de Partes de horas este instalada y que la clave API tenga permisos.`,
    );
  }

  const readonly = Object.keys(vals).filter((key) => getField(fields, key)?.readonly);
  if (readonly.length > 0) {
    throw new Error(`Odoo marca estos campos de parte como solo lectura: ${readonly.join(", ")}.`);
  }
}

export async function getOdooDiagnostics() {
  const env = getEnv();
  const requiredByModel: Record<"project.task" | "hr.employee" | "account.analytic.line", string[]> = {
    "project.task": ["name", "active", "project_id", "stage_id"],
    "hr.employee": ["name", "active"],
    "account.analytic.line": ["name", "employee_id", "project_id", "task_id", "date", "unit_amount"],
  };
  const optionalByModel: Record<"project.task" | "hr.employee" | "account.analytic.line", string[]> = {
    "project.task": ["partner_id", "effective_hours", "total_hours_spent", "unit_amount"],
    "hr.employee": [],
    "account.analytic.line": [],
  };

  if (env.MOCK_ODOO) {
    return {
      mode: "mock",
      models: {
        "project.task": summarizeFields(
          requiredByModel["project.task"],
          optionalByModel["project.task"],
          mockFieldMap(["name", "active", "project_id", "stage_id", "partner_id", "effective_hours"]),
        ),
        "hr.employee": summarizeFields(
          requiredByModel["hr.employee"],
          optionalByModel["hr.employee"],
          mockFieldMap(["name", "active"]),
        ),
        "account.analytic.line": summarizeFields(
          requiredByModel["account.analytic.line"],
          optionalByModel["account.analytic.line"],
          mockFieldMap(["name", "employee_id", "project_id", "task_id", "date", "unit_amount"]),
        ),
      },
    };
  }

  const entries = await Promise.all(
    (Object.keys(requiredByModel) as Array<keyof typeof requiredByModel>).map(async (model) => {
      const fields = await getFields(model);

      return [
        model,
        summarizeFields(requiredByModel[model], optionalByModel[model], fields),
      ] as const;
    }),
  );

  return {
    mode: "odoo",
    models: Object.fromEntries(entries),
  };
}

function summarizeFields(required: string[], optional: string[], fields: OdooFieldMap) {
  return {
    required: required.map((field) => ({
      field,
      available: hasField(fields, field),
      writable: hasField(fields, field) && !getField(fields, field)?.readonly,
      type: getField(fields, field)?.type,
      relation: getField(fields, field)?.relation,
    })),
    optional: optional.map((field) => ({
      field,
      available: hasField(fields, field),
      type: getField(fields, field)?.type,
      relation: getField(fields, field)?.relation,
    })),
    missingRequired: required.filter((field) => !hasField(fields, field)),
  };
}

function mockFieldMap(fields: string[]): OdooFieldMap {
  return Object.fromEntries(fields.map((field) => [field, { readonly: false }]));
}
