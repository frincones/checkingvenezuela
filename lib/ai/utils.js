/**
 * Utilidades compartidas de la capa AI.
 */

/**
 * Detección simple de idioma es/en por palabras stopword frecuentes.
 * No requiere librería externa. Retorna 'es' por default.
 */
export function detectLanguage(text) {
  if (!text || typeof text !== "string") return "es";
  const t = text.toLowerCase();

  const esWords = [
    "el", "la", "los", "las", "un", "una", "y", "o", "que", "de", "del",
    "para", "por", "con", "es", "está", "son", "tengo", "tienes", "tiene",
    "quiero", "quisiera", "necesito", "hola", "buenos", "buenas", "gracias",
    "viaje", "vuelo", "hotel", "playa", "días", "fechas", "precio", "cuánto",
    "cuándo", "dónde", "cómo", "qué",
  ];
  const enWords = [
    "the", "a", "an", "and", "or", "of", "for", "to", "with", "is", "are",
    "i", "you", "we", "want", "need", "looking", "hello", "hi", "thanks",
    "trip", "flight", "hotel", "beach", "days", "dates", "price", "how",
    "when", "where", "what",
  ];

  const tokens = t.split(/\s+/).filter(Boolean);
  let esScore = 0;
  let enScore = 0;
  for (const tok of tokens) {
    const clean = tok.replace(/[^a-záéíóúñ]/gi, "");
    if (esWords.includes(clean)) esScore++;
    if (enWords.includes(clean)) enScore++;
  }
  // Tildes/ñ son señal fuerte de español
  if (/[áéíóúñ¿¡]/i.test(t)) esScore += 2;

  if (enScore > esScore) return "en";
  return "es";
}

/**
 * Genera un session_id UUID v4 (sin librería) para cookies del chat.
 */
export function generateSessionId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hash anónimo de IP para auditoría (no PII).
 */
export async function hashIp(ip) {
  if (!ip) return null;
  const crypto = await import("crypto");
  const salt = process.env.API_SECRET_TOKEN || "default-salt";
  return crypto
    .createHash("sha256")
    .update(`${ip}|${salt}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Trunca texto preservando palabras enteras.
 */
export function truncate(str, max = 200) {
  if (!str || str.length <= max) return str;
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 0 ? lastSpace : max) + "...";
}

/**
 * Estimación rápida de tokens (~4 chars/token para mezcla es/en).
 * Suficiente para tracking de cuota — no para billing exacto.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
