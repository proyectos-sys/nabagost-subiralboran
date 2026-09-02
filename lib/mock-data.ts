import type { Employee, Task } from "./schemas";

export const mockEmployees: Employee[] = [
  { id: 11, name: "Ana Lopez", active: true },
  { id: 12, name: "Carlos Martin", active: true },
  { id: 13, name: "Marta Ruiz", active: true },
];

export const mockTasks: Task[] = [
  {
    id: 36,
    name: "Puerta corredera nave norte",
    projectId: 5,
    projectName: "Taller y Faenas Navagost",
    stage: { id: 1, name: "Pendiente" },
    customerName: "Construcciones Litoral",
    hoursRegistered: 3.5,
  },
  {
    id: 41,
    name: "Barandilla galvanizada escalera",
    projectId: 5,
    projectName: "Taller y Faenas Navagost",
    stage: { id: 2, name: "En taller" },
    customerName: "Hotel Bahia",
    hoursRegistered: 8,
  },
  {
    id: 42,
    name: "Reparacion cancela acceso",
    projectId: 5,
    projectName: "Taller y Faenas Navagost",
    stage: { id: 2, name: "En taller" },
    customerName: "Comunidad Sol",
    hoursRegistered: 1.25,
  },
  {
    id: 51,
    name: "Montaje estructura pergola",
    projectId: 5,
    projectName: "Taller y Faenas Navagost",
    stage: { id: 3, name: "En faena" },
    customerName: "Particular",
    hoursRegistered: 12,
  },
  {
    id: 59,
    name: "Repaso soldaduras y pintura",
    projectId: 5,
    projectName: "Taller y Faenas Navagost",
    stage: { id: 4, name: "Revision" },
    hoursRegistered: 0.5,
  },
];
