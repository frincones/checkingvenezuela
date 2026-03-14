"use client";

import { useState } from "react";
import Image from "next/image";

export function ImageUrlList({ images = [], onChange, label }) {
  const [inputValue, setInputValue] = useState("");

  function handleAdd() {
    const val = inputValue.trim();
    if (!val) return;
    onChange([...images, val]);
    setInputValue("");
  }

  function handleRemove(index) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex gap-2">
        <input
          type="url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://ejemplo.com/imagen.jpg"
          className="h-9 flex-1 rounded-md border border-gray-300 px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
      {images.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {images.map((url, i) => (
            <div key={i} className="group relative overflow-hidden rounded-lg border border-gray-200">
              <div className="relative aspect-[3/2]">
                <Image
                  src={url}
                  alt={`Imagen ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="200px"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
              <div className="truncate px-2 py-1 text-[10px] text-gray-500">{url.split("/").pop()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
