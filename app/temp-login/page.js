"use client";

/**
 * ACCESO TEMPORAL AL CRM — CADUCA EL 2026-12-04
 *
 * Pantalla de entrada provisional. Existe porque Supabase Auth devuelve 402
 * desde el 2026-11-27 (restriccion por cuota de egress) y el inicio de sesion
 * normal no funciona.
 *
 * Se retira borrando esta carpeta y quitando TEMP_GATE_ENABLED (ver REVERTIR.md).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TempLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/temp-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "No se pudo validar el acceso.");
        setLoading(false);
        return;
      }

      // replace y no push: evita que el boton "atras" vuelva a esta pantalla.
      router.replace("/dashboard");
    } catch {
      setError("Error de red. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Acceso temporal</strong>
          <p className="mt-1">
            El inicio de sesión habitual no está disponible porque el proveedor
            de base de datos aplicó una restricción de cuota. Esta entrada
            provisional caduca el 4 de diciembre de 2026.
          </p>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          Venezuela Voyages — CRM
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Introduce la contraseña de acceso temporal.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
