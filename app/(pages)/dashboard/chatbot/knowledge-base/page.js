"use client";

import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

const STATUS_BADGE = {
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  archived: "bg-yellow-100 text-yellow-700",
};

const TYPE_LABEL = {
  docx: "Word",
  pdf: "PDF",
  txt: "Texto",
  md: "Markdown",
  web: "Web",
  db_destinations: "Destinos (DB)",
  db_packages: "Paquetes (DB)",
  db_services: "Servicios (DB)",
  manual: "Manual",
};

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetchSources();
  }, []);

  async function fetchSources() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/chatbot/kb");
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setError(null);
        setSources(data.data || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    onDrop: async (files) => {
      if (files.length === 0) return;
      const file = files[0];
      const ext = file.name.split(".").pop().toLowerCase();
      const typeMap = { pdf: "pdf", docx: "docx", txt: "txt", md: "md" };
      const type = typeMap[ext];
      if (!type) {
        setError(`Extensión no soportada: ${ext}`);
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", type);
        fd.append("name", file.name);

        const res = await fetch("/api/crm/chatbot/kb/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.error) setError(data.error);
        else await fetchSources();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
  });

  async function syncDb(type) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/chatbot/kb/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else await fetchSources();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function ingestUrl() {
    if (!url) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/chatbot/kb/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "web", url }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setUrl("");
        await fetchSources();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSource(id) {
    if (!confirm("¿Eliminar esta fuente y todos sus chunks?")) return;
    setBusy(true);
    try {
      await fetch(`/api/crm/chatbot/kb?id=${id}`, { method: "DELETE" });
      await fetchSources();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-64 min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Knowledge Base del Chatbot</h1>
          <p className="text-sm text-gray-600">
            Documentos y datos que el chatbot usa para responder a clientes (RAG).
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Acciones */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {/* Upload */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Subir documento</h2>
            <div
              {...getRootProps()}
              className={`flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-3 text-center text-sm ${
                isDragActive ? "border-primary bg-primary/5" : "border-gray-300"
              }`}
            >
              <input {...getInputProps()} disabled={busy} />
              <span>📄 Arrastra o haz click</span>
              <span className="mt-1 text-xs text-gray-500">.pdf, .docx, .txt, .md (máx 50MB)</span>
            </div>
          </div>

          {/* URL */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Ingesta desde URL</h2>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://venezuelavoyages.com/destinos/los-roques"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button
              onClick={ingestUrl}
              disabled={busy || !url}
              className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Ingestar URL
            </button>
          </div>

          {/* Sync DB */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Sincronizar desde DB</h2>
            <div className="space-y-2">
              <button
                onClick={() => syncDb("db_destinations")}
                disabled={busy}
                className="w-full rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                🌴 Sync destinos
              </button>
              <button
                onClick={() => syncDb("db_packages")}
                disabled={busy}
                className="w-full rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                📦 Sync paquetes
              </button>
              <button
                onClick={() => syncDb("db_services")}
                disabled={busy}
                className="w-full rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                ✈️ Sync servicios catálogo
              </button>
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-2 font-semibold text-gray-700">
            Fuentes registradas
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Docs</th>
                <th className="px-4 py-3 text-right">Chunks</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-left">Idioma</th>
                <th className="px-4 py-3 text-left">Ingestada</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : sources.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No hay fuentes aún. Sube un documento o sincroniza desde DB.
                  </td>
                </tr>
              ) : (
                sources.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-gray-500">{s.description}</div>
                      )}
                      {s.ingestion_error && (
                        <div className="text-xs text-red-600">⚠ {s.ingestion_error}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {TYPE_LABEL[s.type] || s.type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status] || "bg-gray-100"}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{s.document_count}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{s.chunk_count}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{s.total_tokens}</td>
                    <td className="px-4 py-3 text-xs uppercase text-gray-700">{s.language}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.ingested_at ? new Date(s.ingested_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteSource(s.id)}
                        disabled={busy}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
