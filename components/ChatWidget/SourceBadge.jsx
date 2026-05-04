"use client";

import { FileText } from "lucide-react";

export function SourceBadge({ source }) {
  if (!source) return null;
  const label = source.title || source.source || "Fuente";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
      title={`${label} (relevancia ${source.score ?? "?"})`}
    >
      <FileText className="h-3 w-3" />
      {label}
    </span>
  );
}
