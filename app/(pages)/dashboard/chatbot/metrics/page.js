"use client";

import { useEffect, useState } from "react";

function StatCard({ label, value, sub, color = "primary" }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold text-${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function Bar({ value, max, label, color = "bg-primary" }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500">
          {value.toLocaleString()} / {max.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ChatbotMetricsPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function fetchMetrics() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/chatbot/metrics");
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setError(null);
        setMetrics(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="ml-64 p-8 text-gray-500">Cargando métricas...</div>;
  }
  if (error) {
    return (
      <div className="ml-64 p-8">
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>
      </div>
    );
  }
  if (!metrics) return null;

  const { summary, conversationsByDay, byLanguage, usageByProvider, topIntents, quotas } = metrics;
  const maxConvDay = conversationsByDay.reduce((m, d) => Math.max(m, d.conversations), 0) || 1;

  return (
    <div className="ml-64 min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Métricas del Chatbot</h1>
          <p className="text-sm text-gray-600">Últimos 30 días</p>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Conversaciones" value={summary.totalConversations} />
          <StatCard
            label="Leads generados"
            value={summary.conversationsWithLead}
            sub={`${summary.leadConversionRate}% conversión`}
            color="green-700"
          />
          <StatCard
            label="Consent aceptado"
            value={summary.consentAcceptedCount}
            sub={`${summary.consentRate}% tasa`}
          />
          <StatCard
            label="Mensajes prom. por conv."
            value={summary.avgMessagesPerConv}
            sub={`${summary.totalMessages.toLocaleString()} totales`}
          />
        </div>

        {/* Cuotas */}
        <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Cuotas free tier</h2>
          <div className="space-y-3">
            <Bar
              label="Jina embeddings (este mes)"
              value={quotas.jina.used}
              max={quotas.jina.limit}
              color={quotas.jina.percentUsed > 80 ? "bg-red-500" : "bg-primary"}
            />
            <Bar
              label="Groq requests (hoy)"
              value={quotas.groq.usedToday}
              max={quotas.groq.limitDaily}
              color={quotas.groq.percentUsed > 80 ? "bg-red-500" : "bg-primary"}
            />
          </div>
        </div>

        {/* Por idioma + Top intents */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Conversaciones por idioma</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>🇻🇪 Español</span>
                <span className="font-mono">{byLanguage.es}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>🇬🇧 English</span>
                <span className="font-mono">{byLanguage.en}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Top intents</h2>
            {topIntents.length === 0 ? (
              <div className="text-sm text-gray-500">Sin datos aún.</div>
            ) : (
              <ul className="space-y-1 text-sm">
                {topIntents.map((it) => (
                  <li key={it.intent} className="flex items-center justify-between">
                    <span className="capitalize">{it.intent}</span>
                    <span className="font-mono text-gray-600">{it.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Conversaciones por día (sparkline simple) */}
        <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Conversaciones diarias (últimos 30 días)</h2>
          <div className="flex h-32 items-end gap-1">
            {conversationsByDay.map((d) => (
              <div
                key={d.date}
                className="group relative flex-1"
                title={`${d.date}: ${d.conversations} conv, ${d.leads} leads`}
              >
                <div
                  className="w-full rounded-t bg-primary/70 transition-all group-hover:bg-primary"
                  style={{ height: `${(d.conversations / maxConvDay) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-gray-500">
            <span>{conversationsByDay[0]?.date || ""}</span>
            <span>{conversationsByDay[conversationsByDay.length - 1]?.date || ""}</span>
          </div>
        </div>

        {/* Uso por proveedor */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Consumo por proveedor (último mes)</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Proveedor</th>
                <th className="px-3 py-2 text-right">Requests</th>
                <th className="px-3 py-2 text-right">Tokens</th>
                <th className="px-3 py-2 text-left">Operaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {usageByProvider.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                    Sin datos.
                  </td>
                </tr>
              ) : (
                usageByProvider.map((p) => (
                  <tr key={p.provider}>
                    <td className="px-3 py-2 font-medium">{p.provider}</td>
                    <td className="px-3 py-2 text-right">{p.requests.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{p.tokens.toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {Object.keys(p.byOperation).join(", ")}
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
