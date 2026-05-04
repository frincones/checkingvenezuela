"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const ROLE_STYLES = {
  user: "bg-blue-50 border-blue-200",
  assistant: "bg-white border-gray-200",
  system: "bg-yellow-50 border-yellow-200 text-yellow-900",
  tool: "bg-purple-50 border-purple-200 text-purple-900",
};

export default function ConversationDetailPage() {
  const params = useParams();
  const id = params.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/chatbot/conversations/${id}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        setNotes(json.conversation?.metadata?.advisor_notes || "");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await fetch(`/api/crm/chatbot/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advisor_notes: notes }),
      });
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) {
    return <div className="ml-64 p-8 text-gray-500">Cargando...</div>;
  }
  if (error) {
    return (
      <div className="ml-64 p-8">
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  const conv = data.conversation;
  const messages = data.messages;

  return (
    <div className="ml-64 min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <Link
            href="/dashboard/chatbot/conversations"
            className="text-sm text-primary hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-4 shadow-sm md:col-span-2">
            <h1 className="text-lg font-bold">Conversación {conv.session_id?.slice(0, 12)}…</h1>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Iniciada:</span>{" "}
                {new Date(conv.started_at).toLocaleString()}
              </div>
              <div>
                <span className="text-gray-500">Última actividad:</span>{" "}
                {new Date(conv.last_message_at).toLocaleString()}
              </div>
              <div>
                <span className="text-gray-500">Idioma:</span> {conv.language}
              </div>
              <div>
                <span className="text-gray-500">Estado:</span> {conv.status}
              </div>
              <div>
                <span className="text-gray-500">Mensajes:</span> {conv.message_count}
              </div>
              <div>
                <span className="text-gray-500">Tokens totales:</span> {conv.total_tokens}
              </div>
              <div>
                <span className="text-gray-500">Consentimiento:</span>{" "}
                {conv.consent_accepted ? (
                  <span className="text-green-700">
                    ✓ Aceptado{" "}
                    {conv.consent_accepted_at && (
                      <>({new Date(conv.consent_accepted_at).toLocaleDateString()})</>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-500">No aceptado</span>
                )}
              </div>
              <div>
                <span className="text-gray-500">Lead:</span>{" "}
                {conv.lead_id ? (
                  <Link
                    href={`/dashboard/leads/${conv.lead_id}`}
                    className="text-primary hover:underline"
                  >
                    {conv.lead?.contact_name || "Ver lead"}
                  </Link>
                ) : (
                  <span className="text-gray-500">No generado</span>
                )}
              </div>
            </div>

            {conv.contact_captured && Object.keys(conv.contact_captured).length > 0 && (
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
                <div className="mb-1 font-medium text-gray-700">Datos capturados</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                  {conv.contact_captured.name && (
                    <div>👤 {conv.contact_captured.name}</div>
                  )}
                  {conv.contact_captured.email && (
                    <div>📧 {conv.contact_captured.email}</div>
                  )}
                  {conv.contact_captured.phone && (
                    <div>📱 {conv.contact_captured.phone}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Notas del asesor</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
              placeholder="Notas internas (no visibles al cliente)..."
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {savingNotes ? "Guardando..." : "Guardar notas"}
            </button>
          </div>
        </div>

        {/* Thread */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
            Conversación completa ({messages.length} mensajes)
          </div>
          <div className="max-h-[700px] space-y-2 overflow-y-auto p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border p-3 ${ROLE_STYLES[m.role] || "bg-gray-50 border-gray-200"}`}
              >
                <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                  <div>
                    <span className="font-semibold uppercase">{m.role}</span>
                    {m.intent && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5">{m.intent}</span>
                    )}
                    {m.provider && (
                      <span className="ml-2 text-gray-500">
                        {m.provider} / {m.model}
                      </span>
                    )}
                  </div>
                  <div>{new Date(m.created_at).toLocaleTimeString()}</div>
                </div>
                <div className="whitespace-pre-wrap text-sm text-gray-900">{m.content}</div>

                {Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-purple-700">
                      Tool calls ({m.tool_calls.length})
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-[10px] text-green-300">
                      {JSON.stringify(m.tool_calls, null, 2)}
                    </pre>
                  </details>
                )}

                {Array.isArray(m.sources) && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.sources.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700"
                      >
                        📄 {s.title || s.source} ({s.score})
                      </span>
                    ))}
                  </div>
                )}

                {(m.tokens_in || m.tokens_out || m.latency_ms) && (
                  <div className="mt-1 text-[10px] text-gray-500">
                    {m.tokens_in != null && <>in: {m.tokens_in} </>}
                    {m.tokens_out != null && <>out: {m.tokens_out} </>}
                    {m.latency_ms != null && <>· {m.latency_ms}ms</>}
                  </div>
                )}
              </div>
            ))}
            {messages.length === 0 && (
              <div className="py-8 text-center text-gray-500">Sin mensajes aún.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
