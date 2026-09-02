"use client";

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AttendancePanel } from "@/components/AttendancePanel";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginPanel } from "@/components/LoginPanel";
import { MainMenu } from "@/components/MainMenu";
import { TimesheetDialog } from "@/components/TimesheetDialog";
import type { Employee, Task } from "@/components/types";

type Module = "menu" | "attendance" | "timesheets";

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeModule, setActiveModule] = useState<Module>("menu");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkSession = useCallback(async () => {
    const response = await fetch("/api/auth/session", { credentials: "same-origin" });
    const data = (await response.json().catch(() => ({ authenticated: false }))) as { authenticated: boolean };
    setAuthenticated(data.authenticated);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [tasksResponse, employeesResponse] = await Promise.all([
      fetch("/api/tasks", { credentials: "same-origin" }),
      fetch("/api/employees", { credentials: "same-origin" }),
    ]);

    if (tasksResponse.status === 401 || employeesResponse.status === 401) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }

    if (!tasksResponse.ok || !employeesResponse.ok) {
      const data = (await (tasksResponse.ok ? employeesResponse : tasksResponse).json().catch(() => ({}))) as {
        error?: string;
      };
      setError(data.error || "No se han podido cargar los datos.");
      setLoading(false);
      return;
    }

    const tasksData = (await tasksResponse.json()) as { tasks: Task[] };
    const employeesData = (await employeesResponse.json()) as { employees: Employee[] };
    setTasks(tasksData.tasks);
    setEmployees(employeesData.employees);
    setAuthenticated(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setAuthenticated(false);
    setActiveModule("menu");
    setTasks([]);
    setEmployees([]);
  }

  async function openTimesheets() {
    setActiveModule("timesheets");
    await loadData();
  }

  if (authenticated === false) {
    return <LoginPanel onLogin={() => setAuthenticated(true)} />;
  }

  if (authenticated === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-metal-50 p-6">
        <p className="rounded-lg bg-white p-8 text-2xl font-black shadow-tablet">Cargando...</p>
      </main>
    );
  }

  if (activeModule === "menu") {
    return <MainMenu onOpenAttendance={() => setActiveModule("attendance")} onOpenTimesheets={openTimesheets} onLogout={logout} />;
  }

  if (activeModule === "attendance") {
    return <AttendancePanel onBack={() => setActiveModule("menu")} onLogout={logout} />;
  }

  return (
    <>
      <KanbanBoard
        tasks={tasks}
        loading={loading || authenticated === null}
        error={error}
        onRefresh={loadData}
        onLogout={logout}
        onBack={() => setActiveModule("menu")}
        onSelectTask={setSelectedTask}
      />
      {selectedTask ? (
        <TimesheetDialog
          task={selectedTask}
          employees={employees}
          onClose={() => setSelectedTask(null)}
          onSaved={() => {
            setSelectedTask(null);
            void loadData();
          }}
        />
      ) : null}
      {error ? <ErrorDialog message={error} onClose={() => setError("")} onRetry={loadData} /> : null}
    </>
  );
}

type ErrorDialogProps = {
  message: string;
  onClose: () => void;
  onRetry: () => void;
};

function ErrorDialog({ message, onClose, onRetry }: ErrorDialogProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-tablet">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <AlertTriangle size={32} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl font-black">Error de conexion</h2>
              <p className="text-lg font-semibold text-metal-500">No se han podido cargar los datos.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-metal-100"
            title="Cerrar"
          >
            <X size={28} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-lg font-bold text-red-800">{message}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="h-16 rounded-lg border border-metal-100 text-xl font-black">
            Cerrar
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="flex h-16 items-center justify-center gap-3 rounded-lg bg-safety-500 text-xl font-black text-metal-900"
          >
            <RefreshCw size={26} aria-hidden="true" />
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
