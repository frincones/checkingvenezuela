/**
 * Comprueba la autenticacion de correo del dominio: SPF, DKIM y DMARC.
 *
 * Se escribio a raiz de los rebotes del 2026-09-04 contra GeoEx y Jacada. Al
 * revisar el DNS aparecio que faltaba el registro DMARC, y sin el los tenants
 * corporativos de Microsoft 365 y Google Workspace penalizan el correo en frio.
 *
 * Uso: node scripts/email/check-dns.mjs [dominio]
 */
import { Resolver } from "dns/promises";

const DOMAIN = process.argv[2] || "venezuelavoyages.com";
const resolver = new Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

async function txt(name) {
  try {
    return (await resolver.resolveTxt(name)).map((r) => r.join(""));
  } catch {
    return [];
  }
}

const checks = [];

// SPF: Resend firma el return-path con el subdominio send.<dominio>, asi que el
// SPF que importa vive ahi, no en el apex.
for (const host of [DOMAIN, `send.${DOMAIN}`]) {
  const spf = (await txt(host)).filter((v) => v.startsWith("v=spf1"));
  checks.push({
    nombre: `SPF ${host}`,
    ok: spf.length > 0,
    valor: spf[0] || "(ninguno)",
    critico: host !== DOMAIN, // en el apex es opcional con esta configuracion
  });
}

// DKIM
const dkim = await txt(`resend._domainkey.${DOMAIN}`);
checks.push({
  nombre: `DKIM resend._domainkey.${DOMAIN}`,
  ok: dkim.length > 0,
  valor: dkim[0] ? `${dkim[0].slice(0, 40)}... (${dkim[0].length} chars)` : "(ninguno)",
  critico: true,
});

// DMARC
const dmarc = (await txt(`_dmarc.${DOMAIN}`)).filter((v) => v.startsWith("v=DMARC1"));
checks.push({
  nombre: `DMARC _dmarc.${DOMAIN}`,
  ok: dmarc.length > 0,
  valor: dmarc[0] || "(ninguno)",
  critico: true,
});

// MX
let mx = [];
try {
  mx = (await resolver.resolveMx(DOMAIN)).map((m) => `${m.priority} ${m.exchange}`);
} catch {}
checks.push({ nombre: `MX ${DOMAIN}`, ok: mx.length > 0, valor: mx.join(", ") || "(ninguno)", critico: false });

console.log(`\nAutenticacion de correo de ${DOMAIN}\n${"-".repeat(60)}`);
let fallos = 0;
for (const c of checks) {
  const marca = c.ok ? "OK  " : c.critico ? "FALTA" : "-   ";
  if (!c.ok && c.critico) fallos++;
  console.log(`${marca} ${c.nombre}`);
  console.log(`     ${c.valor}\n`);
}

if (fallos > 0) {
  console.log(`${fallos} registro(s) critico(s) ausente(s).`);
  if (!dmarc.length) {
    console.log(`\nPara publicar el DMARC en modo observacion (no rechaza nada):`);
    console.log(`  Tipo:   TXT`);
    console.log(`  Nombre: _dmarc`);
    console.log(`  Valor:  v=DMARC1; p=none;`);
  }
  process.exit(1);
}
console.log("Todo correcto.");
