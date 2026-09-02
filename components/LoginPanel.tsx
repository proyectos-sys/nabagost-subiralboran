"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { FormEvent, useState } from "react";

type Props = {
  onLogin: () => void;
};

export function LoginPanel({ onLogin }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ pin: pin.trim() }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "No se ha podido acceder.");
      setLoading(false);
      return;
    }

    setLoading(false);
    onLogin();
  }

  function updatePin(value: string) {
    setPin(value.replace(/\D/g, "").slice(0, 12));
  }

  function addDigit(digit: string) {
    updatePin(`${pin}${digit}`);
  }

  function deleteDigit() {
    setPin((current) => current.slice(0, -1));
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-metal-900 px-6 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg bg-white p-8 shadow-tablet"
        aria-label="Acceso por PIN"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Image
            src="/navagost-logo.png"
            alt="Navagost Metal Solutions"
            width={420}
            height={240}
            className="h-36 w-full rounded-lg object-contain"
            priority
          />
          <div>
            <h1 className="text-3xl font-black">Navagost</h1>
            <p className="text-lg text-metal-500">Partes de horas</p>
          </div>
        </div>

        <label className="mb-3 block text-xl font-bold" htmlFor="pin">
          PIN de acceso
        </label>
        <input
          id="pin"
          value={pin}
          readOnly
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="current-password"
          className="mb-4 h-16 w-full rounded-lg border-2 border-metal-100 px-5 text-center text-4xl font-black tracking-[0.25em] outline-none focus:border-safety-500"
          type="password"
        />

        <div className="mb-4 grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => addDigit(digit)}
              className="h-16 rounded-lg bg-metal-900 text-3xl font-black text-white active:bg-safety-700"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={deleteDigit}
            className="h-16 rounded-lg border-2 border-metal-100 bg-white text-xl font-black active:bg-metal-100"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={() => addDigit("0")}
            className="h-16 rounded-lg bg-metal-900 text-3xl font-black text-white active:bg-safety-700"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin("")}
            className="h-16 rounded-lg border-2 border-metal-100 bg-white text-xl font-black active:bg-metal-100"
          >
            Limpiar
          </button>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg bg-red-50 p-4 text-lg font-semibold text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading || pin.length === 0}
          className="flex h-16 w-full items-center justify-center gap-3 rounded-lg bg-safety-500 text-2xl font-black text-metal-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={28} aria-hidden="true" /> : null}
          ENTRAR
        </button>
      </form>
    </main>
  );
}
