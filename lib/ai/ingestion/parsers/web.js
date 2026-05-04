/**
 * Parser web simple con cheerio.
 * Hace fetch HTML y extrae el texto principal eliminando script/style/nav/footer.
 */

import * as cheerio from "cheerio";

/**
 * @param {string} url
 * @returns {Promise<{text: string, title: string, html: string}>}
 */
export async function parseWeb(url) {
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error("parseWeb: URL http(s) válida requerida");
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; VenezuelaVoyagesBot/1.0; +https://venezuelavoyages.com)",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`parseWeb: HTTP ${res.status} fetching ${url}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Eliminar elementos irrelevantes
  $("script, style, nav, footer, header, noscript, iframe, [aria-hidden='true']").remove();

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || url;

  // Texto principal: prefiere <article> o <main>; si no, body
  let text = "";
  const article = $("article").first();
  const main = $("main").first();
  if (article.length) text = article.text();
  else if (main.length) text = main.text();
  else text = $("body").text();

  return {
    text: cleanText(text),
    title,
    html: html.slice(0, 100000), // cap para almacenamiento
  };
}

function cleanText(t) {
  if (!t) return "";
  return t
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .trim();
}
