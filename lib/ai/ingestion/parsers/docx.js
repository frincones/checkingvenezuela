/**
 * Parser DOCX usando mammoth.
 * Extrae texto plano (markdown opcional) preservando títulos.
 */

import mammoth from "mammoth";

/**
 * @param {Buffer} buffer
 * @returns {Promise<{text: string, html: string, messages: any[]}>}
 */
export async function parseDocx(buffer) {
  if (!buffer) throw new Error("parseDocx: buffer requerido");

  // Extracción básica de texto (mantiene estructura de párrafos)
  const textResult = await mammoth.extractRawText({ buffer });
  const htmlResult = await mammoth.convertToHtml({ buffer });

  return {
    text: cleanText(textResult.value),
    html: htmlResult.value,
    messages: [...textResult.messages, ...htmlResult.messages],
  };
}

function cleanText(t) {
  if (!t) return "";
  return t
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // colapsa líneas vacías excesivas
    .replace(/[ \t]+/g, " ")
    .trim();
}
