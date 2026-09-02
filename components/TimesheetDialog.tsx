"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Clock, Eraser, Loader2, X } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { formatDuration } from "@/lib/date";
import type { Employee, Task } from "./types";

type Props = {
  task: Task;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
};

const quickDurations = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 h", value: 60 },
  { label: "2 h", value: 120 },
  { label: "4 h", value: 240 },
  { label: "8 h", value: 480 },
];

const activityOptions = [
  "Corte",
  "Manipulacion",
  "Soldadura",
  "Radial / lijado",
  "Taladro",
  "Plegado",
  "Pintura",
  "Montaje",
  "Medicion",
  "Carga / descarga",
  "Repaso",
  "Desplazamiento",
];

export function TimesheetDialog({ task, employees, onClose, onSaved }: Props) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? 0);
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [automaticDate, setAutomaticDate] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayInputValue());
  const [description, setDescription] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [keypadTarget, setKeypadTarget] = useState<"hours" | "minutes" | null>(null);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const durationMinutes = useMemo(() => hours * 60 + minutes, [hours, minutes]);
  const employee = employees.find((candidate) => candidate.id === employeeId);
  const todayLabel = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeZone: "Europe/Madrid",
  }).format(new Date());
  const selectedDateLabel = formatDateLabel(selectedDate);

  function setQuickDuration(value: number) {
    setHours(Math.floor(value / 60));
    setMinutes(value % 60);
  }

  function updateHours(value: number) {
    setHours(Math.min(24, Math.max(0, value)));
  }

  function updateMinutes(value: number) {
    setMinutes(Math.min(59, Math.max(0, value)));
  }

  function toggleActivity(activity: string) {
    setSelectedActivities((current) => {
      const exists = current.includes(activity);
      const next = exists ? current.filter((item) => item !== activity) : [...current, activity];
      setDescription(formatActivities(next));
      return next;
    });
  }

  function clearActivities() {
    setSelectedActivities([]);
    setDescription("");
  }

  function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!employee) {
      setError("Selecciona un empleado activo.");
      return;
    }

    if (durationMinutes < 1 || durationMinutes > 24 * 60) {
      setError("La duracion debe estar entre 1 minuto y 24 horas.");
      return;
    }

    if (description.trim().length === 0) {
      setError("La descripcion del trabajo es obligatoria. Marca una actividad o escribe una descripcion.");
      return;
    }

    if (!automaticDate && selectedDate.trim().length === 0) {
      setError("Selecciona la fecha del parte.");
      return;
    }

    setConfirming(true);
  }

  async function saveTimesheet() {
    if (saving) {
      return;
    }

    setSaving(true);
    setError("");

    const response = await fetch("/api/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        employeeId,
        taskId: task.id,
        durationMinutes,
        description: description.trim(),
        date: automaticDate ? undefined : selectedDate,
        idempotencyKey: idempotencyKeyRef.current,
      }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "No se ha podido registrar el parte.");
      setSaving(false);
      setConfirming(false);
      idempotencyKeyRef.current = crypto.randomUUID();
      return;
    }

    setSuccess("Horas registradas correctamente.");
    setSaving(false);
    setTimeout(() => {
      onSaved();
    }, 1000);
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="max-h-[96dvh] w-full max-w-3xl overflow-y-auto rounded-t-lg bg-white shadow-tablet sm:rounded-lg">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-metal-100 bg-white p-5">
          <div>
            <p className="text-lg font-bold text-safety-700">Registrar horas</p>
            <h2 className="text-3xl font-black leading-tight">{task.name}</h2>
            <p className="mt-1 text-lg text-metal-500">{task.customerName || "Sin cliente indicado"}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-metal-100"
            title="Cerrar"
          >
            <X size={28} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={requestConfirmation} className="space-y-6 p-5">
          {success ? (
            <div className="flex items-center gap-3 rounded-lg bg-green-50 p-5 text-xl font-black text-green-700">
              <CheckCircle2 size={30} aria-hidden="true" />
              {success}
            </div>
          ) : null}

          {error ? <p className="rounded-lg bg-red-50 p-4 text-lg font-bold text-red-700">{error}</p> : null}

          <section>
            <label className="mb-2 block text-xl font-black" htmlFor="employee">
              Empleado
            </label>
            <select
              id="employee"
              value={employeeId}
              onChange={(event) => setEmployeeId(Number(event.target.value))}
              className="h-16 w-full rounded-lg border-2 border-metal-100 bg-white px-4 text-xl font-bold outline-none focus:border-safety-500"
            >
              {employees.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-lg bg-metal-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3 text-xl font-black">
                  <Clock size={26} aria-hidden="true" />
                  Fecha del parte
                </div>
                <p className="mt-2 text-lg capitalize text-metal-500">
                  {automaticDate ? `Automatica: ${todayLabel}` : `Imputada: ${selectedDateLabel}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutomaticDate((current) => !current)}
                className="h-12 rounded-lg border border-metal-100 bg-white px-4 text-base font-black active:bg-metal-100"
              >
                {automaticDate ? "Imputar otra fecha" : "Volver a automatica"}
              </button>
            </div>
            {!automaticDate ? (
              <div className="mt-4 space-y-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="h-16 w-full rounded-lg border-2 border-metal-100 bg-white px-4 text-2xl font-black outline-none focus:border-safety-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayInputValue())}
                    className="h-14 rounded-lg border border-metal-100 bg-white text-lg font-black"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(offsetDateInputValue(-1))}
                    className="h-14 rounded-lg border border-metal-100 bg-white text-lg font-black"
                  >
                    Ayer
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xl font-black">Duracion</p>
              <p className="rounded-lg bg-metal-900 px-4 py-2 text-xl font-black text-white">
                {formatDuration(durationMinutes)}
              </p>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {quickDurations.map((duration) => (
                <button
                  key={duration.value}
                  type="button"
                  onClick={() => setQuickDuration(duration.value)}
                  className="h-14 rounded-lg bg-safety-500 text-lg font-black text-metal-900"
                >
                  {duration.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DurationPicker
                label="Horas"
                value={hours}
                max={24}
                onChange={updateHours}
                onOpenKeypad={() => setKeypadTarget("hours")}
              />
              <DurationPicker
                label="Minutos"
                value={minutes}
                max={59}
                onChange={updateMinutes}
                onOpenKeypad={() => setKeypadTarget("minutes")}
              />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-xl font-black" htmlFor="description">
                Descripcion del trabajo
              </label>
              <button
                type="button"
                onClick={clearActivities}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-metal-100 bg-white active:bg-metal-100"
                title="Limpiar descripcion"
                aria-label="Limpiar descripcion"
              >
                <Eraser size={26} aria-hidden="true" />
              </button>
            </div>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              required
              maxLength={500}
              placeholder="Marca actividades o escribe una descripcion"
              className="w-full rounded-lg border-2 border-metal-100 p-4 text-xl outline-none focus:border-safety-500"
            />
            <p className="mt-2 text-base font-semibold text-metal-500">
              Obligatorio. Puedes marcar varias actividades y ajustar el texto si hace falta.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {activityOptions.map((activity) => {
                const selected = selectedActivities.includes(activity);

                return (
                  <button
                    key={activity}
                    type="button"
                    onClick={() => toggleActivity(activity)}
                    className={`min-h-14 rounded-lg border-2 px-3 text-lg font-black active:scale-[0.98] ${
                      selected
                        ? "border-safety-500 bg-safety-500 text-metal-900"
                        : "border-metal-100 bg-white text-metal-900"
                    }`}
                  >
                    {activity}
                  </button>
                );
              })}
            </div>
          </section>

          {confirming ? (
            <section className="rounded-lg border-2 border-green-200 bg-green-50 p-5">
              <h3 className="text-2xl font-black text-green-800">Confirmar registro</h3>
              <p className="mt-3 text-lg">
                <strong>Empleado:</strong> {employee?.name}
              </p>
              <p className="text-lg">
                <strong>Tarea:</strong> {task.name}
              </p>
              <p className="text-lg">
                <strong>Fecha:</strong> {automaticDate ? todayLabel : selectedDateLabel}
              </p>
              <p className="text-lg">
                <strong>Duracion:</strong> {formatDuration(durationMinutes)}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="h-16 rounded-lg border border-metal-100 bg-white text-xl font-black"
                  disabled={saving}
                >
                  Revisar
                </button>
                <button
                  type="button"
                  onClick={saveTimesheet}
                  disabled={saving}
                  className="flex h-16 items-center justify-center gap-3 rounded-lg bg-green-600 text-xl font-black text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="animate-spin" size={28} aria-hidden="true" /> : null}
                  Confirmar
                </button>
              </div>
            </section>
          ) : (
            <button
              type="submit"
              className="h-20 w-full rounded-lg bg-metal-900 text-2xl font-black text-white"
              disabled={success.length > 0}
            >
              REGISTRAR HORAS
            </button>
          )}
        </form>
      </div>
      {keypadTarget ? (
        <NumericKeypad
          title={keypadTarget === "hours" ? "Introducir horas" : "Introducir minutos"}
          currentValue={keypadTarget === "hours" ? hours : minutes}
          max={keypadTarget === "hours" ? 24 : 59}
          onCancel={() => setKeypadTarget(null)}
          onApply={(value) => {
            if (keypadTarget === "hours") {
              updateHours(value);
            } else {
              updateMinutes(value);
            }
            setKeypadTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}

function formatActivities(activities: string[]): string {
  if (activities.length === 0) {
    return "";
  }

  if (activities.length === 1) {
    return activities[0];
  }

  if (activities.length === 2) {
    return `${activities[0]} y ${activities[1].toLowerCase()}`;
  }

  const last = activities[activities.length - 1].toLowerCase();
  const rest = activities.slice(0, -1).join(", ");

  return `${rest} y ${last}`;
}

function todayInputValue(): string {
  return formatInputDate(new Date());
}

function offsetDateInputValue(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatInputDate(date);
}

function formatInputDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string): string {
  if (!value) {
    return "Sin fecha";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeZone: "Europe/Madrid",
  }).format(date);
}

type DurationPickerProps = {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  onOpenKeypad: () => void;
};

function DurationPicker({ label, value, max, onChange, onOpenKeypad }: DurationPickerProps) {
  return (
    <div>
      <span className="mb-2 block text-lg font-bold">{label}</span>
      <div className="grid grid-cols-[64px_1fr_64px] gap-2">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="flex h-20 items-center justify-center rounded-lg border-2 border-metal-100 bg-white"
          title={`Bajar ${label.toLowerCase()}`}
        >
          <ChevronDown size={34} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenKeypad}
          className="h-20 rounded-lg border-2 border-metal-100 bg-white px-4 text-4xl font-black outline-none active:border-safety-500 active:bg-safety-500"
          aria-label={`Abrir teclado para ${label.toLowerCase()}`}
        >
          {value}
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-20 items-center justify-center rounded-lg border-2 border-metal-100 bg-white"
          title={`Subir ${label.toLowerCase()}`}
        >
          <ChevronUp size={34} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

type NumericKeypadProps = {
  title: string;
  currentValue: number;
  max: number;
  onCancel: () => void;
  onApply: (value: number) => void;
};

function NumericKeypad({ title, currentValue, max, onCancel, onApply }: NumericKeypadProps) {
  const [draft, setDraft] = useState("");
  const displayValue = draft || String(currentValue);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  function addDigit(digit: string) {
    const next = `${draft}${digit}`.replace(/^0+(?=\d)/, "").slice(0, 2);
    setDraft(next);
  }

  function apply() {
    const parsed = Number(draft || currentValue);
    onApply(Math.min(max, Math.max(0, Number.isFinite(parsed) ? parsed : 0)));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-tablet">
        <h3 className="text-2xl font-black">{title}</h3>
        <p className="mt-1 text-base font-semibold text-metal-500">Maximo {max}</p>
        <div className="my-4 rounded-lg bg-metal-50 p-4 text-center text-5xl font-black">{displayValue}</div>
        <div className="grid grid-cols-3 gap-3">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => addDigit(key)}
              className="h-16 rounded-lg bg-metal-900 text-2xl font-black text-white"
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDraft("")}
            className="col-span-2 h-16 rounded-lg border border-metal-100 bg-white text-xl font-black"
          >
            Borrar
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="h-14 rounded-lg border border-metal-100 text-xl font-black">
            Cancelar
          </button>
          <button type="button" onClick={apply} className="h-14 rounded-lg bg-safety-500 text-xl font-black text-metal-900">
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
