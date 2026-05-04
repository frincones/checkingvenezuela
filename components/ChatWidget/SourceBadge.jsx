"use client";

import { FileText, BookOpen, Globe, Database } from "lucide-react";

const SOURCE_ICON = {
  docx: BookOpen,
  pdf: BookOpen,
  txt: FileText,
  md: FileText,
  web: Globe,
  db_destinations: Database,
  db_packages: Database,
  db_services: Database,
  manual: FileText,
};

/**
 * Renderiza una "pill" con el origen de la información citada por searchKb.
 * Limpia el title (remueve prefijos redundantes como "Paquetes:") y muestra
 * un ícono según el tipo de fuente.
 */
export function SourceBadge({ source }) {
  if (!source) return null;
  const Icon = SOURCE_ICON[source.sourceType] || FileText;
  // Limpiar prefijos redundantes que el chunker arrastra del título
  let label = (source.title || "Fuente").trim();
  label = label
    .replace(/^(Paquetes?|package|Hotel|Servicio|Destino|Document|Doc):\s*/i, "")
    .replace(/\s*\(SKU [^)]+\)/, "");
  if (label.length > 45) label = label.slice(0, 45) + "…";

  const score = source.score != null ? Math.round(source.score * 100) : null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
      title={
        score != null
          ? `Fuente: ${source.title} (relevancia ${score}%)`
          : `Fuente: ${source.title}`
      }
    >
      <Icon className="h-3 w-3" />
      <span className="truncate">{label}</span>
    </span>
  );
}
