/**
 * Parser PDF usando pdf-parse.
 * Solo PDFs con texto (no escaneados — esos requerirían OCR).
 */

import pdfParse from "pdf-parse";

/**
 * @param {Buffer} buffer
 * @returns {Promise<{text: string, pages: number, info: object}>}
 */
export async function parsePdf(buffer) {
  if (!buffer) throw new Error("parsePdf: buffer requerido");

  const result = await pdfParse(buffer);
  return {
    text: cleanText(result.text),
    pages: result.numpages,
    info: result.info || {},
  };
}

function cleanText(t) {
  if (!t) return "";
  return t
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
