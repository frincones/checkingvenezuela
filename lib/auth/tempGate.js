/**
 * ACCESO TEMPORAL AL CRM — CADUCA EL 2026-12-04
 * =============================================
 *
 * QUE ES
 * ------
 * Una puerta de entrada provisional al CRM mientras Supabase Auth no responde.
 *
 * POR QUE EXISTE
 * --------------
 * El 2026-11-27 Supabase restringio el proyecto por exceder la cuota de egress
 * (6,65 GB de 5,5 GB). La restriccion devuelve HTTP 402 en todos sus servicios
 * HTTP, Auth incluido. Sin Auth no hay inicio de sesion, y sin sesion el CRM
 * entero queda inaccesible: ni buzon, ni leads, ni cotizaciones.
 *
 * La base de datos si acepta conexiones por el pooler, asi que los DATOS estan
 * disponibles; lo que falta es poder identificar a quien entra. Este modulo
 * cubre ese hueco con una contrasena compartida y una cookie firmada que se
 * verifica en local, sin llamar a Supabase.
 *
 * ESTO DEBILITA LA AUTENTICACION. Se acepta como medida de contingencia porque
 * la alternativa es una semana sin CRM, y se acota asi:
 *
 *   1. CADUCIDAD EN EL CODIGO. Pasada GATE_EXPIRES_AT la puerta se cierra por
 *      si sola, aunque nadie se acuerde de retirarla. Un bypass sin fecha es
 *      como nace una brecha permanente.
 *   2. Contrasena solo por variable de entorno. Nunca en el repositorio.
 *   3. Cookie firmada con HMAC-SHA256 y comparacion en tiempo constante. No se
 *      puede falsificar sin el secreto.
 *   4. httpOnly + secure + sameSite=strict: no accesible desde JavaScript, no
 *      viaja por HTTP plano, no se envia en peticiones de otros sitios.
 *   5. Solo habilita el CRM. No toca rutas publicas ni amplia permisos.
 *   6. Cada entrada se registra.
 *
 * COMO SE RETIRA
 * --------------
 * Quitar TEMP_GATE_ENABLED del entorno. Ver REVERTIR.md.
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/** Fecha de caducidad. Coincide con la recarga de cuota de Supabase. */
export const GATE_EXPIRES_AT = "2026-12-05T00:00:00Z";

/** Nombre de la cookie. El prefijo deja claro que es temporal. */
const COOKIE_NAME = "vv_temp_gate";

/** Validez de cada sesion: 12 h. Obliga a reautenticar al dia siguiente. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Identidad que se asume al entrar por esta puerta.
 *
 * Es el usuario real del CRM (auth.users). No se inventa un usuario nuevo: asi
 * todo lo que se cree durante la contingencia queda atribuido a quien
 * corresponde y no hay que reconciliar nada despues.
 */
const GATE_IDENTITY = {
  id: "0aafcd13-49d9-44fe-a4c1-14141ccc7db8",
  email: "asesor@checkinvenezuela.com",
  name: "Asesor (acceso temporal)",
};

/** @returns {boolean} true si la puerta esta activa Y no ha caducado. */
export function isTempGateEnabled() {
  if (process.env.TEMP_GATE_ENABLED !== "true") return false;
  if (!process.env.TEMP_GATE_PASSWORD) return false;
  if (!process.env.TEMP_GATE_SECRET) return false;

  // La caducidad se comprueba aqui, no solo al iniciar sesion: una cookie
  // emitida antes de la fecha deja de valer igualmente.
  if (Date.now() >= Date.parse(GATE_EXPIRES_AT)) {
    console.warn(
      `[temp-gate] La puerta temporal caduco el ${GATE_EXPIRES_AT}. ` +
        `Quitar TEMP_GATE_ENABLED y borrar lib/auth/tempGate.js (ver REVERTIR.md).`,
    );
    return false;
  }

  return true;
}

/** Firma un contenido con el secreto del entorno. */
function sign(payload) {
  return createHmac("sha256", process.env.TEMP_GATE_SECRET)
    .update(payload)
    .digest("hex");
}

/** Comparacion en tiempo constante: no filtra informacion por el tiempo. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Comprueba la contrasena de acceso.
 * @param {string} candidate
 * @returns {boolean}
 */
export function verifyPassword(candidate) {
  if (!isTempGateEnabled()) return false;
  return safeEqual(candidate ?? "", process.env.TEMP_GATE_PASSWORD);
}

/**
 * Construye el valor de la cookie: "<expira>.<nonce>.<firma>".
 *
 * El nonce hace que dos sesiones emitidas en el mismo milisegundo no produzcan
 * el mismo valor, de modo que una cookie capturada no se puede reutilizar como
 * plantilla.
 */
export function buildSessionCookie() {
  const expires = Date.now() + SESSION_TTL_MS;
  const nonce = randomBytes(12).toString("hex");
  const body = `${expires}.${nonce}`;
  return `${body}.${sign(body)}`;
}

/**
 * Valida el valor de una cookie.
 * @returns {boolean} true solo si la firma es correcta y no ha expirado.
 */
export function verifySessionCookie(value) {
  if (!isTempGateEnabled() || !value) return false;

  const parts = String(value).split(".");
  if (parts.length !== 3) return false;

  const [expires, nonce, signature] = parts;
  if (!safeEqual(signature, sign(`${expires}.${nonce}`))) return false;

  const exp = Number(expires);
  if (!Number.isFinite(exp) || Date.now() >= exp) return false;

  return true;
}

/** Opciones de la cookie. */
export function cookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    // En desarrollo local no hay HTTPS, asi que secure solo en produccion.
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export { COOKIE_NAME };

/**
 * Devuelve una sesion equivalente a la de Supabase si la cookie es valida.
 *
 * La forma del objeto es la misma que devuelve auth() en lib/auth-supabase.js,
 * para que el resto de la aplicacion no distinga entre una sesion real y una de
 * contingencia. `viaTempGate` permite reconocerla en los registros.
 *
 * @returns {Promise<object|null>}
 */
export async function getTempGateSession() {
  if (!isTempGateEnabled()) return null;

  try {
    const store = await cookies();
    const raw = store.get(COOKIE_NAME)?.value;
    if (!verifySessionCookie(raw)) return null;

    return {
      user: { ...GATE_IDENTITY, image: null, emailVerified: null },
      expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      viaTempGate: true,
    };
  } catch {
    // En un Server Component sin contexto de peticion, cookies() lanza. No es
    // un fallo de autenticacion: simplemente no hay sesion que leer.
    return null;
  }
}
