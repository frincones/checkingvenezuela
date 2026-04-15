"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVoucherAction, updateVoucherAction } from "@/lib/vouchers/actions";
import { emptyVoucherDefaults } from "@/lib/vouchers/schema";

export default function VoucherForm({ defaultValues, voucherId, mode = "create" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const initial = defaultValues || emptyVoucherDefaults();
  const [form, setForm] = useState(initial);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function setService(key, val) {
    setForm((prev) => ({
      ...prev,
      services: { ...prev.services, [key]: val },
    }));
  }

  function setAccommodation(key, val) {
    setForm((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        accommodation: { ...(prev.services?.accommodation || {}), [key]: val },
      },
    }));
  }

  // ── Passengers ──
  function addPassenger() {
    set("passengers", [
      ...form.passengers,
      { full_name: "", id_type: "CI", id_number: "" },
    ]);
  }
  function removePassenger(idx) {
    set("passengers", form.passengers.filter((_, i) => i !== idx));
  }
  function setPassenger(idx, key, val) {
    const updated = [...form.passengers];
    updated[idx] = { ...updated[idx], [key]: val };
    set("passengers", updated);
  }

  // ── Excursions ──
  function addExcursion() {
    setService("excursions", [
      ...(form.services?.excursions || []),
      { title: "", included: true, note: "" },
    ]);
  }
  function removeExcursion(idx) {
    setService(
      "excursions",
      (form.services?.excursions || []).filter((_, i) => i !== idx),
    );
  }
  function setExcursion(idx, key, val) {
    const updated = [...(form.services?.excursions || [])];
    updated[idx] = { ...updated[idx], [key]: val };
    setService("excursions", updated);
  }

  // ── Generic array editors (transfers, others) ──
  function addToArray(key) {
    setService(key, [...(form.services?.[key] || []), ""]);
  }
  function removeFromArray(key, idx) {
    setService(
      key,
      (form.services?.[key] || []).filter((_, i) => i !== idx),
    );
  }
  function setArrayItem(key, idx, val) {
    const updated = [...(form.services?.[key] || [])];
    updated[idx] = val;
    setService(key, updated);
  }

  // ── Submit ──
  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result =
        mode === "edit"
          ? await updateVoucherAction(voucherId, form)
          : await createVoucherAction(form);

      if (!result.success) {
        setError(result.error || "Error desconocido");
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }

      const targetId = voucherId || result.data?.id;
      router.push(targetId ? `/dashboard/vouchers/${targetId}` : "/dashboard/vouchers");
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Identificación ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Identificación</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Título</label>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.title[0]}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Código localizador</label>
            <input
              className={inputCls}
              value={form.locator_code}
              onChange={(e) => set("locator_code", e.target.value)}
              placeholder="Ej. LOC-12345"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Subtítulo</label>
            <input
              className={inputCls}
              value={form.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Fecha de emisión</label>
            <input
              type="date"
              className={inputCls}
              value={form.issue_date}
              onChange={(e) => set("issue_date", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Pasajeros ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pasajeros</h2>
          <button
            type="button"
            onClick={addPassenger}
            className="text-sm text-blue-600 hover:underline"
          >
            + Agregar pasajero
          </button>
        </div>
        {fieldErrors.passengers && (
          <p className="text-xs text-red-600">{fieldErrors.passengers[0]}</p>
        )}
        {form.passengers.map((pax, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-end gap-3 rounded-lg border bg-gray-50 p-3"
          >
            <div className="flex-1 min-w-[200px]">
              <label className={labelCls}>Nombre completo *</label>
              <input
                className={inputCls}
                value={pax.full_name}
                onChange={(e) => setPassenger(idx, "full_name", e.target.value)}
                placeholder="APELLIDO/NOMBRE"
              />
            </div>
            <div className="w-28">
              <label className={labelCls}>Tipo ID</label>
              <select
                className={inputCls}
                value={pax.id_type}
                onChange={(e) => setPassenger(idx, "id_type", e.target.value)}
              >
                <option value="CI">CI</option>
                <option value="PP">Pasaporte</option>
                <option value="DNI">DNI</option>
                <option value="RIF">RIF</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className={labelCls}>Número ID *</label>
              <input
                className={inputCls}
                value={pax.id_number}
                onChange={(e) => setPassenger(idx, "id_number", e.target.value)}
                placeholder="V-12.345.678"
              />
            </div>
            {form.passengers.length > 1 && (
              <button
                type="button"
                onClick={() => removePassenger(idx)}
                className="text-sm text-red-500 hover:underline"
              >
                Eliminar
              </button>
            )}
          </div>
        ))}
      </section>

      {/* ── Alojamiento ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Alojamiento</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre del hotel / campamento</label>
            <input
              className={inputCls}
              value={form.services?.accommodation?.hotel_name || ""}
              onChange={(e) => setAccommodation("hotel_name", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Descripción de habitación</label>
            <textarea
              rows={2}
              className={inputCls}
              value={form.services?.accommodation?.room_description || ""}
              onChange={(e) => setAccommodation("room_description", e.target.value)}
              placeholder="Ej: Habitación matrimonial superior con A/C, baño privado y agua caliente"
            />
          </div>
          <div>
            <label className={labelCls}>Check-in</label>
            <input
              type="date"
              className={inputCls}
              value={form.services?.accommodation?.check_in || ""}
              onChange={(e) => setAccommodation("check_in", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Check-out</label>
            <input
              type="date"
              className={inputCls}
              value={form.services?.accommodation?.check_out || ""}
              onChange={(e) => setAccommodation("check_out", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Días</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.services?.accommodation?.days ?? ""}
              onChange={(e) => setAccommodation("days", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className={labelCls}>Noches</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.services?.accommodation?.nights ?? ""}
              onChange={(e) => setAccommodation("nights", Number(e.target.value) || 0)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Ubicación</label>
            <input
              className={inputCls}
              value={form.services?.accommodation?.location || ""}
              onChange={(e) => setAccommodation("location", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Excursiones ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Excursiones</h2>
          <button
            type="button"
            onClick={addExcursion}
            className="text-sm text-blue-600 hover:underline"
          >
            + Agregar excursión
          </button>
        </div>
        {(form.services?.excursions || []).map((exc, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-end gap-3 rounded-lg border bg-gray-50 p-3"
          >
            <div className="flex-1 min-w-[250px]">
              <label className={labelCls}>Título *</label>
              <input
                className={inputCls}
                value={exc.title}
                onChange={(e) => setExcursion(idx, "title", e.target.value)}
              />
            </div>
            <div className="w-32">
              <label className={labelCls}>Incluido</label>
              <select
                className={inputCls}
                value={exc.included ? "true" : "false"}
                onChange={(e) =>
                  setExcursion(idx, "included", e.target.value === "true")
                }
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className={labelCls}>Nota (opcional)</label>
              <input
                className={inputCls}
                value={exc.note || ""}
                onChange={(e) => setExcursion(idx, "note", e.target.value)}
                placeholder="Sujeto a condiciones climáticas..."
              />
            </div>
            <button
              type="button"
              onClick={() => removeExcursion(idx)}
              className="text-sm text-red-500 hover:underline"
            >
              Eliminar
            </button>
          </div>
        ))}
      </section>

      {/* ── Traslados ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Traslados</h2>
          <button
            type="button"
            onClick={() => addToArray("transfers")}
            className="text-sm text-blue-600 hover:underline"
          >
            + Agregar traslado
          </button>
        </div>
        {(form.services?.transfers || []).map((val, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              className={`${inputCls} flex-1`}
              value={val}
              onChange={(e) => setArrayItem("transfers", idx, e.target.value)}
              placeholder="Ej: Aeropuerto / Hotel / Aeropuerto"
            />
            <button
              type="button"
              onClick={() => removeFromArray("transfers", idx)}
              className="text-sm text-red-500 hover:underline"
            >
              Eliminar
            </button>
          </div>
        ))}
      </section>

      {/* ── Alimentación ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Alimentación</h2>
        <textarea
          rows={3}
          className={inputCls}
          value={form.services?.meals || ""}
          onChange={(e) => setService("meals", e.target.value)}
          placeholder="Desayunos, almuerzos y cenas..."
        />
      </section>

      {/* ── Otros ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Otros servicios</h2>
          <button
            type="button"
            onClick={() => addToArray("others")}
            className="text-sm text-blue-600 hover:underline"
          >
            + Agregar
          </button>
        </div>
        {(form.services?.others || []).map((val, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              className={`${inputCls} flex-1`}
              value={val}
              onChange={(e) => setArrayItem("others", idx, e.target.value)}
              placeholder="Ej: Coctel de bienvenida"
            />
            <button
              type="button"
              onClick={() => removeFromArray("others", idx)}
              className="text-sm text-red-500 hover:underline"
            >
              Eliminar
            </button>
          </div>
        ))}
      </section>

      {/* ── Observaciones ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Observaciones</h2>
        <div>
          <label className={labelCls}>Información importante</label>
          <textarea
            rows={2}
            className={inputCls}
            value={form.observations || ""}
            onChange={(e) => set("observations", e.target.value)}
            placeholder="Presentar este voucher al momento del check-in en el hotel."
          />
        </div>
        <div>
          <label className={labelCls}>Contacto de emergencia</label>
          <input
            className={inputCls}
            value={form.emergency_contact || ""}
            onChange={(e) => set("emergency_contact", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Notas importantes (aparecen en rojo en el PDF)</label>
          <textarea
            rows={2}
            className={inputCls}
            value={form.important_notes || ""}
            onChange={(e) => set("important_notes", e.target.value)}
            placeholder="NO INCLUYE LA ENTRADA AL PARQUE..."
          />
        </div>
        <div>
          <label className={labelCls}>Notas de validez</label>
          <textarea
            rows={2}
            className={inputCls}
            value={form.validity_notes || ""}
            onChange={(e) => set("validity_notes", e.target.value)}
            placeholder="Este voucher es válido únicamente para los servicios especificados..."
          />
        </div>
      </section>

      {/* ── Submit ── */}
      <div className="flex items-center gap-4 border-t pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending
            ? "Guardando..."
            : mode === "edit"
              ? "Guardar cambios"
              : "Crear voucher"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-6 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
