"use client";

import { useState, useRef } from "react";
import Image from "next/image";

export function ImageUrlList({ images = [], onChange, label, folder = "inventory" }) {
  const [inputValue, setInputValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  async function uploadFile(file) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) return null;
    if (file.size > 5 * 1024 * 1024) return null;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const res = await fetch("/api/cms/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) return null;
    return data.url;
  }

  async function handleFiles(files) {
    if (!files?.length) return;
    setUploading(true);
    const newUrls = [];
    for (const file of Array.from(files).slice(0, 10)) {
      const url = await uploadFile(file);
      if (url) newUrls.push(url);
    }
    if (newUrls.length > 0) {
      onChange([...images, ...newUrls]);
    }
    setUploading(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleFileInput(e) {
    handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}

      {/* Drop zone */}
      <div
        className={`mb-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-primary/50"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <svg className="h-5 w-5 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-500">Subiendo imagenes...</span>
          </div>
        ) : (
          <div className="py-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M6.75 19.25h10.5A2.25 2.25 0 0019.5 17V7a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 7v10a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-sm text-gray-500">
              Arrastra imagenes aqui o <span className="text-primary font-medium">haz clic para seleccionar</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG, WebP, GIF (max. 5MB)</p>
          </div>
        )}
      </div>

      {/* URL input fallback */}
      <div className="flex gap-2">
        <input
          type="url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="O pega una URL de imagen..."
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

      {/* Image grid */}
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
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
