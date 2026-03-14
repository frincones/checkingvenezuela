"use client";

import { useState } from "react";

export function ItineraryBuilder({ itinerary = [], onChange, label }) {
  function addDay() {
    onChange([
      ...itinerary,
      { day: itinerary.length + 1, title: "", activities: [""], meals: "" },
    ]);
  }

  function removeDay(index) {
    const updated = itinerary
      .filter((_, i) => i !== index)
      .map((d, i) => ({ ...d, day: i + 1 }));
    onChange(updated);
  }

  function updateDay(index, field, value) {
    const updated = [...itinerary];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  function addActivity(dayIndex) {
    const updated = [...itinerary];
    updated[dayIndex] = {
      ...updated[dayIndex],
      activities: [...(updated[dayIndex].activities || []), ""],
    };
    onChange(updated);
  }

  function updateActivity(dayIndex, actIndex, value) {
    const updated = [...itinerary];
    const activities = [...(updated[dayIndex].activities || [])];
    activities[actIndex] = value;
    updated[dayIndex] = { ...updated[dayIndex], activities };
    onChange(updated);
  }

  function removeActivity(dayIndex, actIndex) {
    const updated = [...itinerary];
    updated[dayIndex] = {
      ...updated[dayIndex],
      activities: updated[dayIndex].activities.filter((_, i) => i !== actIndex),
    };
    onChange(updated);
  }

  return (
    <div>
      {label && <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>}

      {itinerary.length === 0 && (
        <p className="mb-2 text-sm text-gray-400">No hay itinerario definido</p>
      )}

      <div className="space-y-3">
        {itinerary.map((day, dayIdx) => (
          <div key={dayIdx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {day.day}
              </span>
              <button
                type="button"
                onClick={() => removeDay(dayIdx)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Eliminar dia
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Titulo del dia</label>
                <input
                  type="text"
                  value={day.title || ""}
                  onChange={(e) => updateDay(dayIdx, "title", e.target.value)}
                  placeholder="Ej: Llegada a Los Roques"
                  className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Comidas</label>
                <input
                  type="text"
                  value={day.meals || ""}
                  onChange={(e) => updateDay(dayIdx, "meals", e.target.value)}
                  placeholder="Ej: Desayuno, Almuerzo, Cena"
                  className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs text-gray-500">Actividades</label>
              <div className="space-y-1.5">
                {(day.activities || []).map((act, actIdx) => (
                  <div key={actIdx} className="flex gap-1.5">
                    <input
                      type="text"
                      value={act}
                      onChange={(e) => updateActivity(dayIdx, actIdx, e.target.value)}
                      placeholder={`Actividad ${actIdx + 1}`}
                      className="h-8 flex-1 rounded border border-gray-300 px-2 text-sm focus:border-primary focus:outline-none"
                    />
                    {day.activities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeActivity(dayIdx, actIdx)}
                        className="shrink-0 rounded p-1 text-gray-400 hover:text-red-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addActivity(dayIdx)}
                className="mt-1.5 text-xs font-medium text-primary hover:underline"
              >
                + Agregar actividad
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addDay}
        className="mt-3 flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-primary hover:text-primary"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
        Agregar Dia
      </button>
    </div>
  );
}
