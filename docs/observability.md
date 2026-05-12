# Vale chatbot — Observability

## Telemetry today (already wired)

Every `streamText` call in `lib/ai/agent.js` emits OpenTelemetry spans via
`experimental_telemetry`. Each span carries:

- `functionId: "vale-chat"`
- `conversationId`, `language`, `tier`, `intent`, `inCapture`
- `modelId`, `provider`
- AI SDK 6 default attrs: `ai.prompt.tokens`, `ai.response.tokens`,
  `ai.response.text`, `ai.toolCall.name`, `ai.toolCall.args`,
  `ai.toolCall.result`, latency, finish reason

In addition, milestone events (`tool_called`, `lead_created`, etc.) are
written to `kb_usage_log` table for Supabase-side analytics.

## Activating Langfuse (when ready)

1. Sign up free at https://cloud.langfuse.com (50k events/month free).
2. Add to `.env`:
   ```
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_BASE_URL=https://cloud.langfuse.com
   ```
3. `npm install langfuse-vercel`
4. Create `instrumentation.ts` at the repo root:
   ```ts
   import { registerOTel } from "@vercel/otel";
   import { LangfuseExporter } from "langfuse-vercel";

   export function register() {
     registerOTel({
       serviceName: "venezuela-voyages-chatbot",
       traceExporter: new LangfuseExporter(),
     });
   }
   ```
5. Add `experimental.instrumentationHook = true` to `next.config.js` (Next 14
   requires the opt-in; Next 15+ can drop this).

That's it — the existing `experimental_telemetry` blocks start ingesting
into Langfuse with zero code changes inside `agent.js`.

## Self-hosted alternative

Langfuse can be self-hosted on Supabase (Postgres + ClickHouse via Fly.io
free tier). See https://langfuse.com/self-hosting. Total cost: $0/month
within free tiers.

## Non-Langfuse alternatives

- **Helicone**: drop-in proxy. Replace OpenRouter base URL with their proxy
  URL + auth header. Free 100k req/mo. No code changes inside agent.js.
- **Vercel OTel + custom backend**: any OTLP-compatible backend works
  (Honeycomb, Grafana Cloud free tier, Axiom, etc.).

## What to watch

Once telemetry is live, build dashboards on:

- P50 / P95 latency by model (catch a slow model before users complain)
- 429 rate by provider (early warning of free-tier exhaustion)
- Tool call success rate (catch broken tools)
- Lead conversion funnel: `tool=searchPackages` → `tool=captureContactInfo`
  → `tool=createLead`
- Intent → tool routing accuracy (compares classifier intent vs. tool the
  LLM actually called — if mismatch >20%, the classifier is hurting more
  than helping → ship commit 7 to delete it)
