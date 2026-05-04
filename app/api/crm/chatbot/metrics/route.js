/**
 * GET /api/crm/chatbot/metrics
 * Devuelve agregaciones del chatbot para el dashboard:
 *  - conversaciones por día (último mes)
 *  - mensajes promedio por conversación
 *  - tasa de captura de lead
 *  - consumo de tokens por proveedor
 *  - intents más comunes
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

const JINA_FREE_TOKENS_PER_MONTH = 1_000_000;
const GROQ_FREE_REQ_PER_DAY = 14_400;

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: "No autorizado", status: 401 };
  return { user };
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const adminClient = createAdminClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. Conversaciones totales y leads
    const { data: convStats } = await adminClient
      .from("chat_conversations")
      .select("id, lead_id, consent_accepted, started_at, message_count, total_tokens, language")
      .gte("started_at", thirtyDaysAgo);

    const totalConversations = convStats?.length || 0;
    const conversationsWithLead = convStats?.filter((c) => c.lead_id).length || 0;
    const consentAcceptedCount = convStats?.filter((c) => c.consent_accepted).length || 0;
    const totalMessages = convStats?.reduce((s, c) => s + (c.message_count || 0), 0) || 0;
    const avgMessagesPerConv = totalConversations
      ? Math.round((totalMessages / totalConversations) * 10) / 10
      : 0;

    // Conversaciones por día (últimos 30 días)
    const dayBuckets = {};
    for (const c of convStats || []) {
      const day = c.started_at.slice(0, 10);
      if (!dayBuckets[day]) dayBuckets[day] = { date: day, conversations: 0, leads: 0 };
      dayBuckets[day].conversations++;
      if (c.lead_id) dayBuckets[day].leads++;
    }
    const conversationsByDay = Object.values(dayBuckets).sort((a, b) =>
      a.date < b.date ? -1 : 1
    );

    // Por idioma
    const byLanguage = { es: 0, en: 0 };
    for (const c of convStats || []) {
      if (c.language === "en") byLanguage.en++;
      else byLanguage.es++;
    }

    // 2. Uso por proveedor (último mes)
    const { data: usage } = await adminClient
      .from("kb_usage_log")
      .select("provider, operation, tokens, requests, created_at")
      .gte("created_at", monthStart);

    const usageByProvider = {};
    let groqRequestsToday = 0;
    let jinaTokensThisMonth = 0;
    for (const u of usage || []) {
      const key = u.provider;
      if (!usageByProvider[key])
        usageByProvider[key] = { provider: key, tokens: 0, requests: 0, byOperation: {} };
      usageByProvider[key].tokens += u.tokens || 0;
      usageByProvider[key].requests += u.requests || 0;
      const op = u.operation;
      if (!usageByProvider[key].byOperation[op]) {
        usageByProvider[key].byOperation[op] = { tokens: 0, requests: 0 };
      }
      usageByProvider[key].byOperation[op].tokens += u.tokens || 0;
      usageByProvider[key].byOperation[op].requests += u.requests || 0;

      if (u.provider === "jina") jinaTokensThisMonth += u.tokens || 0;
      if (u.provider === "groq" && u.created_at >= todayStart) {
        groqRequestsToday += u.requests || 0;
      }
    }

    // 3. Intents más comunes
    const { data: intentRows } = await adminClient
      .from("chat_messages")
      .select("intent")
      .eq("role", "user")
      .gte("created_at", thirtyDaysAgo)
      .not("intent", "is", null);

    const intentCounts = {};
    for (const r of intentRows || []) {
      intentCounts[r.intent] = (intentCounts[r.intent] || 0) + 1;
    }
    const topIntents = Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([intent, count]) => ({ intent, count }));

    // 4. Cuotas
    const quotas = {
      jina: {
        used: jinaTokensThisMonth,
        limit: JINA_FREE_TOKENS_PER_MONTH,
        percentUsed: Math.round((jinaTokensThisMonth / JINA_FREE_TOKENS_PER_MONTH) * 100),
      },
      groq: {
        usedToday: groqRequestsToday,
        limitDaily: GROQ_FREE_REQ_PER_DAY,
        percentUsed: Math.round((groqRequestsToday / GROQ_FREE_REQ_PER_DAY) * 100),
      },
    };

    return NextResponse.json({
      summary: {
        totalConversations,
        conversationsWithLead,
        consentAcceptedCount,
        leadConversionRate: totalConversations
          ? Math.round((conversationsWithLead / totalConversations) * 100)
          : 0,
        consentRate: totalConversations
          ? Math.round((consentAcceptedCount / totalConversations) * 100)
          : 0,
        totalMessages,
        avgMessagesPerConv,
      },
      conversationsByDay,
      byLanguage,
      usageByProvider: Object.values(usageByProvider),
      topIntents,
      quotas,
    });
  } catch (err) {
    console.error("[crm/chatbot/metrics]", err);
    if (err.code === "42P01" || err.code === "PGRST205") {
      return NextResponse.json({ error: "Migración 009 no aplicada" }, { status: 503 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
