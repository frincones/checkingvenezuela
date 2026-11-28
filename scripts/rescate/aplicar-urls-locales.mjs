/**
 * Apunta las URLs de imagen de Supabase Storage a las copias locales de
 * public/cms-rescate/.
 *
 * POR QUE EXISTE
 * ==============
 * Supabase restringio el proyecto por egress el 2026-11-27 (402 en todos sus
 * servicios HTTP, Storage incluido) hasta el 2026-12-04. Las imagenes de la web
 * se salvaban porque la cache del optimizador de Vercel conservaba copias, pero
 * los `og:image` —la foto que se ve al compartir un enlace en WhatsApp o
 * Facebook— apuntan DIRECTO a Supabase, sin pasar por el optimizador. Resultado:
 * 68 de 79 paginas se compartian sin imagen.
 *
 * Las 221 imagenes recuperables se rescataron de esa cache antes de que se
 * purgase y viven en public/cms-rescate/. Este script hace que la base apunte
 * a ellas.
 *
 * QUE NO TOCA
 * ===========
 * `quotations.items` y `chat_messages.tool_calls` quedan fuera a proposito: son
 * registros historicos de operaciones ya realizadas. Reescribirlos falsearia
 * datos de negocio y no arregla ninguna pagina publica.
 *
 * REVERSIBLE
 * ==========
 * Antes de escribir guarda los valores originales en
 * scripts/rescate/respaldo-urls.json. Para deshacerlo:
 *   node scripts/rescate/aplicar-urls-locales.mjs --revertir
 *
 * USO
 *   node scripts/rescate/aplicar-urls-locales.mjs --simulacro   (no escribe)
 *   node scripts/rescate/aplicar-urls-locales.mjs
 *   node scripts/rescate/aplicar-urls-locales.mjs --revertir
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import pg from "pg";

// El respaldo vive junto al script, dentro del repositorio, a proposito: es lo
// unico que permite deshacer el cambio, y .rescate-imagenes/ esta excluido de
// git. Si solo estuviera alli, borrar esa carpeta dejaria la base sin vuelta
// atras.
const RESPALDO = "scripts/rescate/respaldo-urls.json";
const simulacro = process.argv.includes("--simulacro");
const revertir = process.argv.includes("--revertir");

const env = {};
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const ref =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ||
  "stbbckupkuxasfthlsys";

const c = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@${env.SUPABASE_DB_HOST}:${env.SUPABASE_DB_PORT}/postgres`,
  ssl: { rejectUnauthorized: false },
});

const OBJETIVO = [
  ["destinations", "image_url", "text"],
  ["destinations", "gallery", "jsonb"],
  ["destinations", "metadata", "jsonb"],
  ["blog_posts", "cover_image", "text"],
  ["service_inventory", "images", "jsonb"],
];

await c.connect();

// ---------------------------------------------------------------- REVERTIR --
if (revertir) {
  if (!existsSync(RESPALDO)) {
    console.error(`[rescate] No existe ${RESPALDO}. Sin respaldo no se revierte nada.`);
    process.exit(1);
  }
  const resp = JSON.parse(readFileSync(RESPALDO, "utf8"));
  console.log(`[rescate] Restaurando ${resp.filas.length} filas...`);
  let n = 0;
  for (const f of resp.filas) {
    const val = f.tipo === "text" ? f.antes : JSON.stringify(f.antes);
    await c.query(`UPDATE "${f.tabla}" SET "${f.columna}" = $1::${f.tipo} WHERE id = $2`, [
      val,
      f.id,
    ]);
    n++;
  }
  console.log(`[rescate] Restauradas ${n} filas. Las URLs vuelven a apuntar a Supabase.`);
  await c.end();
  process.exit(0);
}

// ----------------------------------------------------------------- APLICAR --
const man = JSON.parse(readFileSync("./scripts/rescate/manifiesto.json", "utf8"));
const mapa = new Map();
for (const m of man) {
  if (existsSync(`./public/cms-rescate/${m.fichero}`)) {
    mapa.set(m.original, `/cms-rescate/${m.fichero}`);
  }
}
console.log(`[rescate] ${mapa.size} imagenes locales disponibles`);
console.log(simulacro ? "[rescate] SIMULACRO: no se escribe nada\n" : "[rescate] Aplicando...\n");

const respaldo = { creado: new Date().toISOString(), filas: [] };
let sustituidas = 0,
  filasTocadas = 0;

/** Sustituye en texto plano o dentro de un JSON, sin romper la estructura. */
function sustituir(valor, tipo) {
  let txt = tipo === "text" ? valor : JSON.stringify(valor);
  if (!txt || !txt.includes("cms-images")) return null;
  let n = 0;
  for (const [orig, local] of mapa) {
    if (txt.includes(orig)) {
      txt = txt.split(orig).join(local);
      n++;
    }
  }
  if (!n) return null;
  return { nuevo: tipo === "text" ? txt : JSON.parse(txt), n };
}

for (const [tabla, col, tipo] of OBJETIVO) {
  const q = await c.query(`select id, "${col}" v from "${tabla}"`);
  let filas = 0,
    urls = 0;
  for (const r of q.rows) {
    const res = sustituir(r.v, tipo);
    if (!res) continue;
    filas++;
    urls += res.n;
    respaldo.filas.push({ tabla, columna: col, tipo, id: r.id, antes: r.v });
    if (!simulacro) {
      const val = tipo === "text" ? res.nuevo : JSON.stringify(res.nuevo);
      await c.query(`UPDATE "${tabla}" SET "${col}" = $1::${tipo} WHERE id = $2`, [val, r.id]);
    }
  }
  sustituidas += urls;
  filasTocadas += filas;
  console.log(`  ${tabla}.${col}: ${filas} filas, ${urls} URLs`);
}

if (!simulacro) {
  writeFileSync(RESPALDO, JSON.stringify(respaldo, null, 2));
  console.log(`\n[rescate] Respaldo de los valores originales en ${RESPALDO}`);
}
console.log(`\n[rescate] ${sustituidas} URLs en ${filasTocadas} filas${simulacro ? " (simulacro)" : " actualizadas"}`);
await c.end();
