"use client";

import { ArrowLeft, LogOut, RefreshCw, Search } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { Task } from "./types";

type Props = {
  tasks: Task[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onLogout: () => void;
  onBack: () => void;
  onSelectTask: (task: Task) => void;
};

export function KanbanBoard({ tasks, loading, error, onRefresh, onLogout, onBack, onSelectTask }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const text = `${task.name} ${task.customerName || ""} ${task.stage.name}`.toLowerCase();
        return text.includes(normalizedQuery);
      }),
    [normalizedQuery, tasks],
  );
  const stages = useMemo(() => {
    const map = new Map<number, { id: number; name: string; tasks: Task[] }>();
    for (const task of filteredTasks) {
      const current = map.get(task.stage.id) || { id: task.stage.id, name: task.stage.name, tasks: [] };
      current.tasks.push(task);
      map.set(task.stage.id, current);
    }
    return Array.from(map.values());
  }, [filteredTasks]);

  return (
    <main className="min-h-dvh bg-metal-50">
      <header className="sticky top-0 z-10 border-b border-metal-100 bg-white px-5 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-4">
              <Image
                src="/navagost-logo.png"
                alt="Navagost Metal Solutions"
                width={128}
                height={80}
                className="h-16 w-24 rounded-md object-cover object-center"
              />
              <div>
                <p className="text-lg font-bold text-safety-700">Taller y Faenas Navagost</p>
                <h1 className="text-3xl font-black leading-tight">Registro de horas</h1>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block min-w-0 sm:w-96">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-metal-500" />
              <span className="sr-only">Buscar tarea</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar tarea, cliente o etapa"
                className="h-14 w-full rounded-lg border border-metal-100 bg-metal-50 pl-12 pr-4 text-lg outline-none focus:border-safety-500"
              />
            </label>
            <button
              onClick={onBack}
              className="flex h-14 items-center justify-center gap-2 rounded-lg border border-metal-100 bg-white px-5 text-lg font-bold"
              title="Volver al menu"
            >
              <ArrowLeft size={24} aria-hidden="true" />
              Menu
            </button>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex h-14 items-center justify-center gap-2 rounded-lg bg-metal-900 px-5 text-lg font-black text-white disabled:opacity-60"
              title="Actualizar tareas"
            >
              <RefreshCw size={24} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              Actualizar
            </button>
            <button
              onClick={onLogout}
              className="flex h-14 items-center justify-center gap-2 rounded-lg border border-metal-100 bg-white px-5 text-lg font-bold"
              title="Salir"
            >
              <LogOut size={24} aria-hidden="true" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-5">
        {error ? <p className="mb-4 rounded-lg bg-red-50 p-4 text-xl font-bold text-red-700">{error}</p> : null}

        {loading && tasks.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-lg bg-white shadow-tablet" />
            ))}
          </div>
        ) : null}

        {!loading && stages.length === 0 ? (
          <div className="rounded-lg bg-white p-10 text-center shadow-tablet">
            <p className="text-2xl font-black">No hay tareas para mostrar.</p>
            <p className="mt-2 text-lg text-metal-500">Prueba a limpiar el buscador o actualizar.</p>
          </div>
        ) : null}

        {stages.length > 0 ? (
          <div className="touch-scroll flex gap-5 overflow-x-auto pb-5">
            {stages.map((stage) => (
              <section key={stage.id} className="w-[330px] shrink-0">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-black">{stage.name}</h2>
                  <span className="rounded-full bg-white px-3 py-1 text-base font-bold text-metal-500">
                    {stage.tasks.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {stage.tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className="block min-h-44 w-full rounded-lg border border-metal-100 bg-white p-5 text-left shadow-tablet transition active:scale-[0.98]"
                    >
                      <span className="mb-3 inline-block rounded-md bg-safety-500 px-3 py-1 text-sm font-black text-metal-900">
                        {task.stage.name}
                      </span>
                      <h3 className="text-2xl font-black leading-snug">{task.name}</h3>
                      <p className="mt-3 min-h-7 text-lg font-semibold text-metal-500">
                        {task.customerName || "Sin cliente indicado"}
                      </p>
                      <p className="mt-4 text-lg font-black text-metal-900">
                        {typeof task.hoursRegistered === "number"
                          ? `${task.hoursRegistered.toLocaleString("es-ES")} h registradas`
                          : "Horas no disponibles"}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
