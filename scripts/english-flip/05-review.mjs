/**
 * Visor de la traducción propuesta, para la revisión humana previa al --apply.
 *
 * Muestra antes/después campo a campo y marca automáticamente lo que más
 * riesgo tiene de haberse degradado:
 *   - números, precios y duraciones que NO coinciden entre origen y traducción
 *     (un itinerario que pierde un "3D/2N" es un error comercial, no una errata)
 *   - nombres propios venezolanos traducidos de más
 *   - texto que quedó en español
 *
 * Uso:
 *   node scripts/english-flip/05-review.mjs                  → resumen + alertas
 *   node scripts/english-flip/05-review.mjs --table=service_inventory
 *   node scripts/english-flip/05-review.mjs --full           → todo el detalle
 *   node scripts/english-flip/05-review.mjs --alerts         → solo las alertas
 */
import fs from "fs";

const FILE = "backups/translations-dryrun.json";
const TABLE = (process.argv.find((a) => a.startsWith("--table=")) || "").split("=")[1];
const FULL = process.argv.includes("--full");
const ONLY_ALERTS = process.argv.includes("--alerts");

if (!fs.existsSync(FILE)) {
  console.error(`No existe ${FILE}. Corre antes 03-translate-db.mjs`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

// Topónimos y términos que deben sobrevivir tal cual (o con su forma inglesa fija)
const KEEP = [
  "Los Roques", "Canaima", "Mérida", "Morrocoy", "Margarita", "Catatumbo",
  "Roraima", "Auyán", "Kavak", "Pemón", "Gran Roque", "Mukumbarí", "Choroní",
  "Mochima", "Tucacas", "Colonia Tovar", "La Tortuga", "Sierra Nevada",
];

const flat = (v) => (typeof v === "string" ? v : JSON.stringify(v ?? ""));
const nums = (s) => (flat(s).match(/\d+(?:[.,]\d+)?/g) || []).sort().join(",");
const isES = (s) => /[áéíóúñ¿¡]|\b(el|la|los|las|del|para|con|una|incluye|noche|día|salida)\b/i.test(flat(s));

let rows = 0, alerts = 0;
const summary = {};

for (const [table, items] of Object.entries(data.tables || {})) {
  if (TABLE && table !== TABLE) continue;
  summary[table] = { rows: items.length, alerts: 0 };
  if (!items.length) continue;

  const header = `\n${"═".repeat(76)}\n  ${table.toUpperCase()}  (${items.length} filas)\n${"═".repeat(76)}`;
  let printedHeader = false;

  for (const it of items) {
    rows++;
    const rowAlerts = [];

    for (const [field, before] of Object.entries(it.before)) {
      const after = it.after[field];

      if (nums(before) !== nums(after)) {
        rowAlerts.push(`NÚMEROS cambiaron en "${field}": ${nums(before) || "(ninguno)"} → ${nums(after) || "(ninguno)"}`);
      }
      for (const term of KEEP) {
        if (flat(before).includes(term) && !flat(after).includes(term)) {
          rowAlerts.push(`TOPÓNIMO perdido en "${field}": "${term}"`);
        }
      }
      if (isES(after)) rowAlerts.push(`SIGUE EN ESPAÑOL en "${field}"`);
    }

    if (rowAlerts.length) { alerts += rowAlerts.length; summary[table].alerts += rowAlerts.length; }
    if (ONLY_ALERTS && !rowAlerts.length) continue;

    if (!printedHeader) { console.log(header); printedHeader = true; }
    const label = flat(it.before.name || it.before.title || it.id).slice(0, 60);
    console.log(`\n── ${label}`);
    for (const a of rowAlerts) console.log(`   ⚠  ${a}`);

    if (FULL || rowAlerts.length) {
      for (const [field, before] of Object.entries(it.before)) {
        const b = flat(before), a = flat(it.after[field]);
        const cut = FULL ? 600 : 200;
        console.log(`   ${field}:`);
        console.log(`     ES  ${b.slice(0, cut)}${b.length > cut ? " …" : ""}`);
        console.log(`     EN  ${a.slice(0, cut)}${a.length > cut ? " …" : ""}`);
      }
    }
  }
}

console.log(`\n${"═".repeat(76)}`);
console.log("tabla                      filas   alertas");
for (const [t, s] of Object.entries(summary)) {
  console.log(`${t.padEnd(26)} ${String(s.rows).padStart(5)}   ${String(s.alerts).padStart(7)}`);
}
console.log(`${"─".repeat(44)}\nTOTAL: ${rows} filas · ${alerts} alertas`);
if (alerts === 0) {
  console.log("\nSin alertas automáticas. Revisa igualmente a ojo service_inventory y destinations.metadata con --full.");
} else {
  console.log("\nRevisa las alertas antes de aplicar: node scripts/english-flip/05-review.mjs --alerts");
}
