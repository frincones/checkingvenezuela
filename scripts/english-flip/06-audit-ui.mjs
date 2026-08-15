/**
 * Auditoría de español en la UI pública — versión seria.
 *
 * El auditor anterior (heurística sobre "cadenas que parecen españolas") tenía
 * tres puntos ciegos estructurales que dejaron texto en producción:
 *
 *   1. Texto JSX precedido de emoji o símbolo: "✅ Qué Incluye" no empieza por
 *      letra, así que ningún patrón `>[A-Z]` lo veía.
 *   2. Identificadores de locale: toLocaleDateString("es-VE") produce
 *      "12 de agosto de 2026" sin que exista ninguna cadena española en el código.
 *   3. Valores de BD renderizados como etiqueta: {post.category} imprime
 *      "destinos" crudo. La clave NO debe traducirse, pero la etiqueta sí.
 *
 * Esta versión los cubre explícitamente.
 *
 * Uso: node scripts/english-flip/06-audit-ui.mjs [--json]
 */
import fs from "fs";
import path from "path";

// Superficie que el visitante realmente ve. lib/ queda fuera salvo helpers de
// UI: sus mensajes son de servidor/log y no llegan a la pantalla pública.
const UI_ONLY = /^(app[\/]\(pages\)|app[\/](page|layout)\.js|components|data|hooks)/;
const SKIP_DIR = new Set(["node_modules", ".next", ".git", "dashboard"]);
// Superficie pública: se excluye el dashboard (interno, se queda en español)
const isAdmin = (f) =>
  /[\\/]dashboard[\\/]/.test(f) ||
  /[\\/]components[\\/]dashboard[\\/]/.test(f) ||
  /[\\/]components[\\/]cms[\\/]/.test(f) ||
  /app[\\/]api[\\/](crm|cms|email|inventory|providers|webhook)[\\/]/.test(f);

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(p); }
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) files.push(p);
  }
})(".") ;

const ACC = /[áéíóúÁÉÍÓÚñÑ¿¡]/;
// Solo palabras INEQUÍVOCAMENTE españolas. Se excluyen las que existen igual
// en inglés ("error", "total", "no", "final"...) porque inundaban de ruido.
const WORDS =
  "incluye|excluye|precio|precios|persona|personas|noche|noches|dias?|salida|llegada|" +
  "buscar|reservar|cotizar|comprar|enviar|guardar|cancelar|volver|siguiente|anterior|" +
  "cargando|exito|gracias|hola|bienvenido|proximamente|destinos|paquetes|" +
  "vuelos|hoteles|servicios|inicio|apellido|correo|telefono|mensaje|" +
  "todos|todas|ninguno|leer|compartir|copiar|nuestros?|nuestras?|" +
  "descubre|conoce|disfruta|explora|elige|completa|escribenos|contactanos|" +
  "por persona|todo incluido|mas informacion|ver mas|ver todos|leer mas";
const RE_WORDS = new RegExp(`\\b(${WORDS})\\b`, "i");

const looksSpanish = (s) => {
  const t = String(s).trim();
  if (t.length < 3) return false;
  if (/^[\w.\-/#@:{}$[\]]+$/.test(t)) return false;       // identificadores, rutas
  if (ACC.test(t)) return true;
  const flat = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return RE_WORDS.test(flat);
};

const findings = [];
const add = (file, line, kind, text) =>
  findings.push({ file: file.replace(/^\.\\?/, "").split(path.sep).join("/"), line, kind, text: String(text).slice(0, 110) });

for (const file of files) {
  const rel = file.replace(/^\.\?/, "");
  if (isAdmin(file) || !UI_ONLY.test(rel)) continue;
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");

  lines.forEach((raw, i) => {
    const n = i + 1;
    const t = raw.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return; // comentarios: no se ven

    // (2) locale español embebido
    const loc = raw.match(/["'](es(-[A-Z]{2})?)["']/);
    if (loc && /toLocaleDateString|toLocaleString|toLocaleTimeString|Intl\.|NumberFormat|DateTimeFormat/.test(raw))
      add(file, n, "LOCALE", raw.trim());

    // (1) texto JSX, admitiendo emoji/símbolo delante — este era el punto ciego
    const jsx = raw.match(/>\s*([^<>{}\n]{3,})\s*(<|$)/);
    if (jsx && looksSpanish(jsx[1])) add(file, n, "JSX", jsx[1].trim());

    // línea suelta de texto JSX (el contenido va en su propia línea).
    // Se exige que NO parezca código: sin punto y coma, sin llaves, sin puntos.
    if (
      !/[<>={}();]/.test(raw) && !/\.\w/.test(raw) &&
      looksSpanish(t) && t.length < 120
    )
      add(file, n, "JSX", t);

    // literales en atributos y props visibles
    for (const m of raw.matchAll(
      /\b(title|label|placeholder|alt|aria-label|subTitle|quoteLabel|onlineLabel|triggerLabel|description|message|whatsappMessage|quoteMessage)\s*=\s*["'`]([^"'`]{3,})["'`]/g,
    ))
      if (looksSpanish(m[2])) add(file, n, "PROP", `${m[1]}="${m[2]}"`);

    // literales sueltos con acento en cualquier string
    for (const m of raw.matchAll(/["'`]([^"'`\n]{4,})["'`]/g))
      if (ACC.test(m[1]) && !/^https?:|^\/|^[a-z-]+$/.test(m[1])) add(file, n, "STRING", m[1]);
  });
}

// (3) valores de BD que se renderizan crudos como etiqueta
const RAW_DB = [
  ["app/(pages)/blog/page.js", "{post.category}", "imprime el valor crudo de blog_posts.category (\"destinos\", \"tips\", \"noticias\")"],
  ["app/(pages)/blog/[slug]/page.js", "{post.category}", "idem"],
];
for (const [f, needle, why] of RAW_DB) {
  if (fs.existsSync(f) && fs.readFileSync(f, "utf8").includes(needle))
    add(f, 0, "DB-LABEL", `${needle} — ${why}`);
}

// dedup y salida
const seen = new Set();
const out = findings.filter((f) => {
  const k = `${f.file}:${f.line}:${f.text}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(out, null, 2));
} else {
  const byFile = {};
  for (const f of out) (byFile[f.file] = byFile[f.file] || []).push(f);
  const sorted = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
  for (const [file, items] of sorted) {
    console.log(`\n${file}  (${items.length})`);
    for (const it of items) console.log(`   ${String(it.line).padStart(4)}  ${it.kind.padEnd(9)} ${it.text}`);
  }
  const byKind = out.reduce((a, f) => ({ ...a, [f.kind]: (a[f.kind] || 0) + 1 }), {});
  console.log(`\n${"─".repeat(60)}\nTOTAL: ${out.length} hallazgos en ${sorted.length} archivos`);
  console.log(`por tipo: ${JSON.stringify(byKind)}`);
}
