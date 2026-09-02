"use client";

import { Clock, ClipboardList, LogOut } from "lucide-react";
import Image from "next/image";

type Props = {
  onOpenAttendance: () => void;
  onOpenTimesheets: () => void;
  onLogout: () => void;
};

export function MainMenu({ onOpenAttendance, onOpenTimesheets, onLogout }: Props) {
  return (
    <main className="min-h-dvh bg-metal-50 px-5 py-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4 rounded-lg bg-white p-5 shadow-tablet">
          <div className="flex items-center gap-4">
            <Image
              src="/navagost-logo.png"
              alt="Navagost Metal Solutions"
              width={128}
              height={80}
              className="h-20 w-28 rounded-md object-cover object-center"
              priority
            />
            <div>
              <p className="text-lg font-bold text-safety-700">Navagost</p>
              <h1 className="text-3xl font-black">Menu principal</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-14 items-center justify-center gap-2 rounded-lg border border-metal-100 bg-white px-5 text-lg font-black"
          >
            <LogOut size={24} aria-hidden="true" />
            Salir
          </button>
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={onOpenAttendance}
            className="flex min-h-64 flex-col items-center justify-center gap-5 rounded-lg bg-metal-900 p-8 text-white shadow-tablet active:scale-[0.99]"
          >
            <Clock size={70} aria-hidden="true" />
            <span className="text-4xl font-black">FICHAJE</span>
          </button>
          <button
            type="button"
            onClick={onOpenTimesheets}
            className="flex min-h-64 flex-col items-center justify-center gap-5 rounded-lg bg-safety-500 p-8 text-metal-900 shadow-tablet active:scale-[0.99]"
          >
            <ClipboardList size={70} aria-hidden="true" />
            <span className="text-4xl font-black">PARTES DE TRABAJO</span>
          </button>
        </section>
      </div>
    </main>
  );
}
