"use client";

import { ArrowLeft, CheckCircle2, Clock, LogOut, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  countPendingAttendance,
  deletePendingAttendance,
  listPendingAttendance,
  savePendingAttendance,
  type PendingAttendanceAction,
} from "./attendance-offline";
import type { Employee } from "./types";

type AttendanceInterval = {
  id: number;
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

type Props = {
  onBack: () => void;
  onLogout: () => void;
};

export function AttendancePanel({ onBack, onLogout }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadEmployees() {
    setLoading(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/attendance/employees", { credentials: "same-origin" });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "No se han podido cargar los empleados.");
      setLoading(false);
      return;
    }

    const data = (await response.json()) as { employees: Employee[] };
    setEmployees(data.employees);
    setLoading(false);
  }

  async function loadStatus(employee: Employee) {
    setSelectedEmployee(employee);
    setStatusLoading(true);
    setError("");
    setNotice("");

    const response = await fetch(`/api/attendance/status?employeeId=${employee.id}`, { credentials: "same-origin" });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "No se ha podido consultar el fichaje.");
      setStatusLoading(false);
      return;
    }

    const data = (await response.json()) as { status: AttendanceStatus };
    setStatus(data.status);
    setStatusLoading(false);
  }

  async function register(action: "check-in" | "check-out") {
    if (!selectedEmployee || actionLoading) {
      return;
    }

    setActionLoading(true);
    setError("");
    setNotice("");
    const pendingAction: PendingAttendanceAction = {
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      action,
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      idempotencyKey: crypto.randomUUID(),
    };

    const result = await sendAttendanceAction(pendingAction);

    if (result.queued) {
      await savePendingAttendance(pendingAction);
      await refreshPendingCount();
      setNotice("Fichaje guardado en esta tablet. Se enviara automaticamente cuando vuelva internet.");
      setStatus((current) => optimisticStatus(current, pendingAction));
      setActionLoading(false);
      return;
    }

    if (result.error) {
      setError(result.error);
      setActionLoading(false);
      return;
    }

    setStatus(result.status || null);
    setActionLoading(false);
  }

  async function refreshPendingCount() {
    setPendingCount(await countPendingAttendance());
  }

  async function syncPending() {
    if (syncing) {
      return;
    }

    setSyncing(true);
    setError("");
    setNotice("");

    const pending = await listPendingAttendance();
    let sent = 0;

    for (const item of pending) {
      const result = await sendAttendanceAction(item);
      if (result.queued) {
        break;
      }

      if (result.error) {
        setError(`No se pudo sincronizar ${item.employeeName}: ${result.error}`);
        break;
      }

      await deletePendingAttendance(item.idempotencyKey);
      sent += 1;
    }

    await refreshPendingCount();
    setSyncing(false);

    if (sent > 0) {
      setNotice(`Fichajes sincronizados con Odoo: ${sent}.`);
      if (selectedEmployee) {
        await loadStatus(selectedEmployee);
      }
    }
  }

  useEffect(() => {
    void loadEmployees();
    void refreshPendingCount();
  }, []);

  useEffect(() => {
    function handleOnline() {
      void syncPending();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  });

  return (
    <main className="min-h-dvh bg-metal-50">
      <header className="sticky top-0 z-10 border-b border-metal-100 bg-white px-5 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-bold text-safety-700">Navagost</p>
            <h1 className="text-3xl font-black leading-tight">Fichaje</h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <button
              type="button"
              onClick={onBack}
              className="flex h-14 items-center justify-center gap-2 rounded-lg border border-metal-100 bg-white px-5 text-lg font-black"
            >
              <ArrowLeft size={24} aria-hidden="true" />
              Menu
            </button>
            <button
              type="button"
              onClick={loadEmployees}
              className="flex h-14 items-center justify-center gap-2 rounded-lg bg-metal-900 px-5 text-lg font-black text-white"
            >
              <RefreshCw size={24} aria-hidden="true" />
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => void syncPending()}
              disabled={syncing || pendingCount === 0}
              className="flex h-14 items-center justify-center gap-2 rounded-lg bg-safety-500 px-5 text-lg font-black text-metal-900 disabled:opacity-50"
            >
              <RefreshCw size={24} className={syncing ? "animate-spin" : ""} aria-hidden="true" />
              Pendientes {pendingCount}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex h-14 items-center justify-center gap-2 rounded-lg border border-metal-100 bg-white px-5 text-lg font-black"
            >
              <LogOut size={24} aria-hidden="true" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[1fr_420px]">
        <div>
          {error ? <p className="mb-4 rounded-lg bg-red-50 p-4 text-xl font-bold text-red-700">{error}</p> : null}
          {notice ? <p className="mb-4 rounded-lg bg-green-50 p-4 text-xl font-bold text-green-700">{notice}</p> : null}
          {pendingCount > 0 ? (
            <p className="mb-4 rounded-lg bg-amber-50 p-4 text-xl font-bold text-amber-800">
              Hay {pendingCount} fichaje{pendingCount === 1 ? "" : "s"} pendiente{pendingCount === 1 ? "" : "s"} de enviar a Odoo.
            </p>
          ) : null}
          {loading ? <p className="rounded-lg bg-white p-6 text-xl font-black shadow-tablet">Cargando empleados...</p> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {employees.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => void loadStatus(employee)}
                className={`min-h-36 rounded-lg border-2 bg-white p-5 text-left shadow-tablet active:scale-[0.99] ${
                  selectedEmployee?.id === employee.id ? "border-safety-500" : "border-transparent"
                }`}
              >
                <p className="text-2xl font-black">{employee.name}</p>
                <p className="mt-2 text-lg font-semibold text-metal-500">Empleado activo</p>
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-lg bg-white p-5 shadow-tablet">
          {!selectedEmployee ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center">
              <Clock size={56} className="text-metal-500" aria-hidden="true" />
              <p className="mt-4 text-2xl font-black">Selecciona un empleado</p>
            </div>
          ) : null}

          {selectedEmployee && statusLoading ? <p className="text-xl font-black">Consultando estado...</p> : null}

          {selectedEmployee && status && !statusLoading ? (
            <div>
              <p className="text-lg font-bold text-metal-500">{selectedEmployee.name}</p>
              <div
                className={`mt-3 flex items-center gap-3 rounded-lg p-4 ${
                  status.state === "inside" ? "bg-green-50 text-green-800" : "bg-metal-50 text-metal-900"
                }`}
              >
                {status.state === "inside" ? <CheckCircle2 size={34} /> : <XCircle size={34} />}
                <p className="text-3xl font-black">{status.state === "inside" ? "TRABAJANDO" : "SIN FICHAR"}</p>
              </div>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void register(status.state === "inside" ? "check-out" : "check-in")}
                className={`mt-5 h-20 w-full rounded-lg text-2xl font-black text-white disabled:opacity-60 ${
                  status.state === "inside" ? "bg-red-600" : "bg-green-600"
                }`}
              >
                {status.state === "inside" ? "FICHAR SALIDA" : "FICHAR ENTRADA"}
              </button>
              <div className="mt-5 rounded-lg bg-metal-50 p-4">
                <p className="text-lg font-black">Hoy: {status.date}</p>
                <p className="mt-1 text-2xl font-black">Total: {status.totalLabel}</p>
              </div>
              <div className="mt-5 space-y-3">
                <p className="text-xl font-black">Intervalos de hoy</p>
                {status.intervals.length === 0 ? (
                  <p className="rounded-lg border border-metal-100 p-4 text-lg font-semibold text-metal-500">
                    Sin fichajes hoy.
                  </p>
                ) : null}
                {status.intervals.map((interval) => (
                  <div key={interval.id} className="rounded-lg border border-metal-100 p-4">
                    <p className="text-xl font-black">
                      {interval.startLabel} - {interval.endLabel}
                    </p>
                    <p className="text-lg font-semibold text-metal-500">{formatMinutes(interval.durationMinutes)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${rest} min`;
  }

  if (rest === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${rest} min`;
}

async function sendAttendanceAction(
  item: PendingAttendanceAction,
): Promise<{ queued: true } | { queued: false; status?: AttendanceStatus; error?: string }> {
  try {
    const response = await fetch(`/api/attendance/${item.action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        employeeId: item.employeeId,
        idempotencyKey: item.idempotencyKey,
        occurredAt: item.occurredAt,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as { status?: AttendanceStatus; error?: string };

    if (!response.ok) {
      const message = data.error || "No se ha podido registrar el fichaje.";
      if (isTemporaryConnectionError(message, response.status)) {
        return { queued: true };
      }

      return { queued: false, error: message };
    }

    return { queued: false, status: data.status };
  } catch {
    return { queued: true };
  }
}

function isTemporaryConnectionError(message: string, status: number): boolean {
  const normalized = message.toLowerCase();
  return (
    status >= 500 ||
    normalized.includes("fetch failed") ||
    normalized.includes("no se puede conectar") ||
    normalized.includes("odoo no responde") ||
    normalized.includes("network") ||
    normalized.includes("timeout")
  );
}

function optimisticStatus(current: AttendanceStatus | null, item: PendingAttendanceAction): AttendanceStatus | null {
  if (!current) {
    return current;
  }

  const temporaryId = -Math.abs(Date.parse(item.occurredAt));
  const label = formatLocalTime(item.occurredAt);

  if (item.action === "check-in") {
    return {
      ...current,
      state: "inside",
      openAttendanceId: temporaryId,
      intervals: [
        ...current.intervals,
        {
          id: temporaryId,
          startLabel: label,
          endLabel: "Pendiente",
          durationMinutes: 0,
        },
      ],
    };
  }

  return {
    ...current,
    state: "outside",
    openAttendanceId: null,
    intervals: current.intervals.map((interval, index) =>
      index === current.intervals.length - 1 && interval.endLabel === "Dentro"
        ? { ...interval, endLabel: "Pendiente" }
        : interval,
    ),
  };
}

function formatLocalTime(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
