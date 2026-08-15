/**
 * Traducción in situ del contenido de la BD (español → inglés).
 *
 * Usa Gemini 2.5 Flash por la key gratuita que ya está en .env
 * (GOOGLE_GENERATIVE_AI_API_KEY). Sin coste.
 *
 * REGLAS DURAS (codificadas, no confiadas al operador):
 *   - NUNCA se traducen claves técnicas: slug, sku, category, id, enums,
 *     href, icon. Traducir blog_posts.category vaciaría el blog sin dar error.
 *   - service_inventory.name SOLO se traduce si existe la columna `slug`
 *     con backfill hecho. Si no, el nombre define la URL y traducirlo la
 *     rompería en silencio. El script lo detecta y se salta esos campos.
 *   - Los JSONB se validan estructuralmente después de traducir (mismas
 *     claves, mismas longitudes de array). Si no cuadra, la fila se descarta.
 *
 * Uso:
 *   node scripts/english-flip/03-translate-db.mjs            → dry-run a JSON
 *   node scripts/english-flip/03-translate-db.mjs --apply    → escribe en la BD
 *   node scripts/english-flip/03-translate-db.mjs --only=destinations
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

const APPLY = process.argv.includes("--apply");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1];

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// ─── Cadena de proveedores gratuitos, en orden de calidad ───
// Mismo patrón que lib/ai/providers.js. Verificado 2026-08-14: la key de
// Gemini está sin créditos y gpt-oss-120b ya no es free en OpenRouter, así
// que la cadena efectiva arranca en Nemotron. Se deja Gemini primero para
// cuando se recargue la cuota.
const CHAIN = [];
if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  const g = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
  CHAIN.push({ label: "gemini-2.5-flash", model: g("gemini-2.5-flash") });
}
if (process.env.OPENROUTER_API_KEY) {
  const or = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  CHAIN.push({ label: "or/nemotron-120b", model: or("nvidia/nemotron-3-super-120b-a12b:free") });
}
if (process.env.GROQ_API_KEY) {
  const gq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  CHAIN.push({ label: "groq/llama-3.3-70b", model: gq("llama-3.3-70b-versatile") });
  CHAIN.push({ label: "groq/llama-3.1-8b", model: gq("llama-3.1-8b-instant") });
}
if (CHAIN.length === 0) {
  console.error("No hay ninguna API key de LLM en .env");
  process.exit(1);
}
const dead = new Set();
const usage = {};

const SYSTEM = `You translate Venezuelan travel-agency content from Spanish to English.

RULES:
- Premium travel-agency voice for an international audience. Natural English, not literal.
- Keep Venezuelan proper nouns as the traveller would search them:
  Salto Ángel → Angel Falls · Los Roques → Los Roques · Canaima → Canaima
  Mérida → Mérida · tepuy → tepui · curiara → curiara (dugout canoe)
  chigüire → capybara · Mukumbarí → Mukumbarí · Gran Roque → Gran Roque
  Auyantepuy → Auyán-tepui · posada → posada (inn)
- NEVER change numbers, prices, dates, durations, codes, times or URLs.
- Preserve markdown/HTML markup exactly, including tags and attributes.
- If a value is already English, return it unchanged.
- Output ONLY the JSON described. No prose, no code fences.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateJSON(payload, hint) {
  const prompt =
    `Translate the VALUES of this JSON object to English. Keep every KEY exactly as-is, ` +
    `keep the exact same structure, array lengths and non-text values.\n` +
    (hint ? `Context: ${hint}\n` : "") +
    `Return ONLY the resulting JSON.\n\n` +
    JSON.stringify(payload, null, 1);

  let lastErr;
  for (const p of CHAIN) {
    if (dead.has(p.label)) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { text } = await generateText({
          model: p.model,
          system: SYSTEM,
          prompt,
          temperature: 0.3,
          maxRetries: 0,
        });
        usage[p.label] = (usage[p.label] || 0) + 1;
        const cleaned = text
          .trim()
          .replace(/^```(?:json)?/i, "")
          .replace(/```$/, "")
          .trim();
        // Algunos modelos añaden prosa antes/después: recortamos al primer { y último }
        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        return JSON.parse(first >= 0 ? cleaned.slice(first, last + 1) : cleaned);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || "");
        // Cuota agotada / modelo no disponible → descartar el proveedor entero
        if (/credits are depleted|unavailable for free|invalid api key|401|403/i.test(msg)) {
          dead.add(p.label);
          break;
        }
        // Rate limit → esperar y reintentar en el mismo proveedor
        if (/429|rate.?limit/i.test(msg)) {
          await sleep(4000 * (attempt + 1));
          continue;
        }
        // Error de parseo u otro → un reintento y pasamos al siguiente
        if (attempt === 0) continue;
        break;
      }
    }
  }
  throw lastErr || new Error("todos los proveedores fallaron");
}

/** Comprueba que la traducción conserva la forma del original. */
function sameShape(a, b) {
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => sameShape(x, b[i]));
  if (a && typeof a === "object") {
    if (!b || typeof b !== "object" || Array.isArray(b)) return false;
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i]) && ka.every((k) => sameShape(a[k], b[k]));
  }
  if (typeof a === "number" || typeof a === "boolean" || a === null) return a === b || typeof a === typeof b;
  return typeof b === "string";
}

// ─── ¿existe la columna slug con backfill? ───
let slugReady = false;
{
  const { data, error } = await sb.from("service_inventory").select("id,slug").limit(200);
  if (!error) {
    const missing = (data || []).filter((r) => !r.slug).length;
    slugReady = missing === 0;
    if (!slugReady) console.log(`⚠️  ${missing} paquetes sin slug → no se traducirá service_inventory.name`);
  } else {
    console.log("⚠️  La columna service_inventory.slug no existe → no se traducirá service_inventory.name");
  }
}

// ─── Definición de qué se traduce ───
const TABLES = [
  {
    name: "destination_categories",
    filter: (q) => q,
    fields: ["name", "subtitle", "description"],
    json: [],
  },
  {
    name: "catalog_services",
    filter: (q) => q,
    fields: ["name", "description"],
    json: [],
  },
  {
    name: "tourism_providers",
    filter: (q) => q,
    fields: ["description"],
    json: [],
  },
  {
    name: "hotels",
    filter: (q) => q,
    fields: ["description"],
    json: [],
  },
  {
    name: "website_reviews",
    filter: (q) => q,
    fields: ["title", "comment"],
    json: [],
  },
  {
    name: "destinations",
    filter: (q) => q.eq("is_active", true),
    fields: ["name", "short_description", "description", "meta_title", "meta_description"],
    json: ["tags", "highlights", "metadata"],
    extra: { language: "en" }, // corrige la etiqueta del admin
  },
  {
    name: "blog_posts",
    filter: (q) => q.eq("status", "published"),
    fields: ["title", "excerpt", "content", "meta_title", "meta_description"],
    json: ["tags"],
    // ⚠️ `category` NO se traduce: viaja en /blog?category=… y se compara crudo
  },
  {
    name: "service_inventory",
    filter: (q) => q.eq("is_published", true),
    fields: slugReady
      ? ["name", "description", "meta_title", "meta_description"]
      : ["description", "meta_title", "meta_description"],
    json: ["details", "pricing_details"],
  },
];

// Detector de español. Deliberadamente ancho: un falso positivo solo cuesta
// una llamada extra (el prompt dice que devuelva sin cambios lo que ya está
// en inglés), mientras que un falso negativo deja texto español publicado.
const ES_WORDS =
  "el|la|los|las|un|una|unos|unas|de|del|al|para|con|por|que|como|donde|cuando|desde|hasta|sobre|entre|" +
  "es|son|esta|estan|hay|ser|tiene|tienen|puede|pueden|incluye|excluye|ofrece|" +
  "destino|destinos|hotel|hoteles|vuelo|vuelos|paquete|paquetes|viaje|viajes|playa|playas|" +
  "aventura|cultura|montana|naturaleza|experiencia|experiencias|servicio|servicios|" +
  "traslado|traslados|seguro|alquiler|crucero|cruceros|corporativo|todo incluido|" +
  "populares|mejores|mejor|nuestro|nuestra|nuestros|nuestras|dia|dias|noche|noches|" +
  "salida|llegada|precio|precios|persona|personas|reserva|reservas|cotizacion|" +
  "internacionales|nacionales|hospedaje|hospedajes|alojamiento|recomendaciones|" +
  "itinerario|duracion|incluido|incluidos|notas|importante|guia|guias";
const ES_RE = new RegExp(`\\b(${ES_WORDS})\\b`, "i");

function isSpanish(v) {
  if (typeof v !== "string" || !v.trim()) return false;
  if (/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)) return true;
  // Normalizamos sin diacríticos para que "montaña"→"montana" entre en la lista
  const flat = v.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return ES_RE.test(flat);
}

const out = { generatedAt: new Date().toISOString(), tables: {} };
let calls = 0, rows = 0, skipped = 0;

for (const t of TABLES) {
  if (ONLY && ONLY !== t.name) continue;
  const cols = ["id", ...t.fields, ...t.json].join(",");
  const { data, error } = await t.filter(sb.from(t.name).select(cols));
  if (error) { console.log(`  ERROR ${t.name}: ${error.message}`); continue; }

  out.tables[t.name] = [];
  console.log(`\n== ${t.name} (${data.length} filas) ==`);

  for (const row of data) {
    const payload = {};
    for (const f of t.fields) if (isSpanish(row[f])) payload[f] = row[f];
    for (const j of t.json) {
      const v = row[j];
      if (v && JSON.stringify(v).length > 2 && isSpanish(JSON.stringify(v))) payload[j] = v;
    }
    if (Object.keys(payload).length === 0) { skipped++; continue; }

    let translated;
    try {
      translated = await translateJSON(payload, `table ${t.name}`);
      calls++;
    } catch (e) {
      console.log(`   !! fallo LLM en ${row.id}: ${String(e.message).slice(0, 80)}`);
      skipped++;
      continue;
    }

    // Validación estructural de los JSONB
    let shapeOk = true;
    for (const j of t.json) {
      if (payload[j] !== undefined && !sameShape(payload[j], translated[j])) {
        console.log(`   !! estructura alterada en ${t.name}.${j} (${row.id}) → fila descartada`);
        shapeOk = false;
      }
    }
    if (!shapeOk) { skipped++; continue; }

    const patch = { ...translated, ...(t.extra || {}) };
    out.tables[t.name].push({ id: row.id, before: payload, after: patch });
    rows++;
    const label = String(row.name || row.title || row.id).slice(0, 46);
    console.log(`   ✓ ${label.padEnd(48)} [${Object.keys(payload).join(", ")}]`);
  }
}

const dir = "backups";
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `translations-${APPLY ? "applied" : "dryrun"}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2), "utf8");
console.log(`\n${rows} filas traducidas · ${skipped} saltadas · ${calls} llamadas al LLM`);
console.log(`Proveedores usados: ${JSON.stringify(usage)}${dead.size ? ` · descartados: ${[...dead].join(", ")}` : ""}`);
console.log(`Detalle en ${file}`);

if (!APPLY) { console.log("\nDry-run. Revisa el JSON y repite con --apply."); process.exit(0); }

let ok = 0, fail = 0;
for (const [table, items] of Object.entries(out.tables)) {
  for (const it of items) {
    const { error } = await sb.from(table).update(it.after).eq("id", it.id);
    if (error) { console.log(`  ERROR ${table}/${it.id}: ${error.message}`); fail++; }
    else ok++;
  }
}
console.log(`\n${ok} filas escritas · ${fail} errores.`);
