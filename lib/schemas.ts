import { z } from "zod";

export const loginSchema = z.object({
  pin: z.string().trim().min(1, "Introduce el PIN."),
});

export const timesheetSchema = z.object({
  employeeId: z.number().int().positive(),
  taskId: z.number().int().positive(),
  durationMinutes: z.number().int().min(1).max(24 * 60),
  description: z.string().trim().min(1, "Indica la descripcion del trabajo.").max(500),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD.")
    .optional(),
  idempotencyKey: z.string().uuid(),
});

export const attendanceEmployeeSchema = z.object({
  employeeId: z.number().int().positive(),
});

export const attendanceActionSchema = attendanceEmployeeSchema.extend({
  idempotencyKey: z.string().uuid(),
  occurredAt: z.string().datetime().optional(),
});

export type Stage = {
  id: number;
  name: string;
};

export type Task = {
  id: number;
  name: string;
  projectId: number;
  projectName: string;
  stage: Stage;
  customerName?: string;
  hoursRegistered?: number;
};

export type Employee = {
  id: number;
  name: string;
  active: boolean;
};

export type TimesheetInput = z.infer<typeof timesheetSchema>;
