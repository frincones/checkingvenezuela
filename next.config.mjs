import { join, resolve } from "path";
/**
 * Content-Security-Policy del sitio publico.
 *
 * Google Analytics 4 y Microsoft Clarity estaban montados en app/layout.js pero
 * el navegador los bloqueaba en TODAS las paginas, porque sus dominios no
 * estaban en esta cabecera. GA4 no midio nada mientras eso duro. Hubo cuatro
 * intentos previos de arreglarlo moviendo el script de sitio y cambiando de
 * libreria (#87, #88, #89, d6b0211); ninguno toco la CSP, que era la causa.
 *
 * Para que un tag de analitica funcione hacen falta TRES directivas, no una:
 *   script-src   de donde se descarga el codigo
 *   connect-src  a donde manda los eventos (fetch / sendBeacon)
 *   img-src      beacons de respaldo por pixel, que ambos usan como fallback
 * Permitir solo script-src carga la libreria y luego bloquea cada evento en
 * silencio, que se parece mucho a "esta puesto pero no reporta".
 *
 * Dominios y por que cada uno:
 *   googletagmanager.com          script de gtag.js
 *   google-analytics.com          endpoint clasico de recogida
 *   *.google-analytics.com        region1..regionN, GA4 enruta por region
 *   analytics.google.com          recogida directa de GA4
 *   *.analytics.google.com        propagacion a Google Signals
 *   www.google.com                sincronizacion de conversiones de Google Signals
 *   clarity.ms / *.clarity.ms     script de Clarity y su ingesta
 *   c.bing.com                    Clarity sincroniza ahi, es de Microsoft
 */
const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://va.vercel-scripts.com https://*.vercel-scripts.com https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://*.clarity.ms;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://images.unsplash.com/ https://images.pexels.com/ https://platform-lookaside.fbsbx.com/ https://api.dicebear.com/ https://*.supabase.co/ https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://c.bing.com https://*.clarity.ms;
    font-src 'self' data:;
    object-src 'self';
    frame-src 'self' https://www.openstreetmap.org/ https://js.stripe.com https://www.google.com/;
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    connect-src 'self' https://va.vercel-scripts.com https://*.vercel-scripts.com https://*.supabase.co https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://www.google.com https://www.clarity.ms https://*.clarity.ms https://c.bing.com;
    upgrade-insecure-requests;
`;
/** @type {import('next').NextConfig} */

const helperDirName = join(process.cwd(), "lib/email/", "helpersHbs");

const nextConfig = {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.hbs$/,
      use: [
        {
          loader: "handlebars-loader",
          options: {
            strict: true,
            noEscape: true,
            helperDirs: [resolve(helperDirName)],
          },
        },
      ],
    });

    return config;
  },
  images: {
    // Desactiva el Image Optimization API de Vercel (que devuelve 402 al exceder
    // la cuota del plan). Las imágenes se sirven directo desde sus CDNs de origen
    // (Supabase Storage, Unsplash, etc.), que ya entregan contenido optimizado.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "golob-travel-agency.vercel.app",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "www.airplane-pictures.net",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "stbbckupkuxasfthlsys.supabase.co",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
      },
    ],
  },
  /**
   * Redirecciones 301 del flip a inglés.
   *
   * Al traducir el catálogo, el contenido español que ya tenía gemelo en inglés
   * se archivó (is_active / is_published / status='draft'). Sus URLs pasaron a
   * devolver 404, perdiendo el posicionamiento acumulado. Estas reglas lo
   * transfieren a la versión inglesa.
   *
   * `permanent: true` emite 301 (no 302): es lo que hace que Google traspase la
   * autoridad en vez de tratarlo como algo temporal.
   *
   * Next evalúa headers → redirects → middleware, así que una petición
   * redirigida no llega a updateSession. No hay interacción con el header
   * X-Pathname de abajo, que solo aplica a lo que sí se sirve.
   *
   * Nota: el dominio apex redirige a www antes que esto, así que probando
   * `venezuelavoyages.com/...` se ve un 307 previo. Es del dominio, no de aquí.
   *
   * Verificado contra producción el 2026-08-15: los 17 orígenes daban 404 y los
   * 17 destinos devuelven 200.
   */
  async redirects() {
    const pairs = [
      // ── Destinos ──
      ["/destinos/canaima", "/destinos/en-canaima-national-park"],
      ["/destinos/los-roques", "/destinos/los-roques-archipelago"],
      ["/destinos/roraima", "/destinos/mount-roraima"],
      ["/destinos/isla-la-tortuga", "/destinos/la-tortuga-island"],
      ["/destinos/catatumbo", "/destinos/catatumbo-lightning-venezuela"],

      // ── Paquetes por destino ──
      //
      // Esta familia se pasó por alto en la primera tanda. La ruta
      // /packages/destino/[slug] resuelve contra destinations.is_active, así que
      // al archivar los slugs españoles en el flip pasó a devolver 404 igual que
      // /destinos/. Yandex reportó dos; probando en producción, las cinco daban
      // 404, así que se cierra la familia entera y no solo lo reportado.
      //
      // El destino es el LISTADO inglés, no la ficha de destino: mantener el
      // tipo de contenido (listado → listado) conserva la intención de búsqueda.
      // Un salto listado → ficha Google puede leerlo como redirección
      // irrelevante y no traspasar autoridad. Los cinco destinos tienen al menos
      // un paquete publicado, así que ninguno cae en la pantalla "Coming soon".
      //
      // Ojo: si algún día se reactiva un destino con slug español desde el CMS,
      // estas reglas lo taparían. Los gemelos ingleses son los vigentes.
      ["/packages/destino/canaima", "/packages/destino/en-canaima-national-park"],
      ["/packages/destino/los-roques", "/packages/destino/los-roques-archipelago"],
      ["/packages/destino/roraima", "/packages/destino/mount-roraima"],
      ["/packages/destino/isla-la-tortuga", "/packages/destino/la-tortuga-island"],
      [
        "/packages/destino/catatumbo",
        "/packages/destino/catatumbo-lightning-venezuela",
      ],

      // ── Paquetes ──
      [
        "/packages/trekking-al-tepuy-roraima-el-mundo-perdido-10-d-9-n",
        "/packages/mount-roraima-tepuy-trekking-the-lost-world-10-days-9-nights",
      ],
      [
        "/packages/canaima-catatumbo-expedicion-fenomenos-naturales",
        "/packages/canaima-catatumbo-natural-phenomena-expedition",
      ],
      [
        "/packages/glamping-premium-en-isla-de-la-tortuga",
        "/packages/premium-geodesic-glamping-la-tortuga-island",
      ],
      // Los tres siguientes NO estaban en la lista de SEO y también daban 404.
      // El primero es el más grave: hay dos posts publicados que lo enlazan.
      ["/packages/los-roques-2d-1n", "/packages/los-roques-express-getaway-2d-1n"],
      [
        "/packages/canaima-salto-angel-campamento-categoria-standard",
        "/packages/canaima-national-park-standard-comfort-package",
      ],
      [
        "/packages/parque-nacional-canaima-y-salto-angel-categoria-superior",
        "/packages/canaima-national-park-angel-falls-premium-category",
      ],
      // La lista de SEO mandaba este paquete a un DESTINO. Se apunta al paquete
      // equivalente en inglés: mantener el tipo de contenido conserva la
      // intención de búsqueda; un salto paquete→destino Google puede leerlo
      // como redirección irrelevante y no traspasar autoridad.
      [
        "/packages/canaima-y-salto-angel-4d-3n",
        "/packages/canaima-national-park-standard-comfort-package",
      ],

      // Huérfano detectado en el barrido de contenido archivado: no estaba en
      // ninguna lista de SEO y daba 404. Su hermano publicado cubre el mismo
      // destino y producto.
      [
        "/packages/relampago-del-catatumbo-ruta-del-cacao",
        "/packages/relampago-del-catatumbo",
      ],

      // ── Blog ──
      [
        "/blog/los-roques-sin-palmeras",
        "/blog/los-roques-the-secret-behind-the-paradise-without-palm-trees",
      ],
      ["/blog/blog-enigmas-misterios-los-roques-2026", "/blog/secrets-of-los-roques"],
      ["/blog/viajes-seguros-venezuela", "/blog/safe-travel-venezuela"],
      // Estos dos tampoco estaban en la lista y daban 404.
      [
        "/blog/salto-angel-guia-maestra-para-tocar-el-cielo-en-el-corazon-de-venezuela",
        "/blog/angel-falls-luxury-eco-expedition",
      ],
      [
        "/blog/los-roques-la-tortuga-2026-guia-vip",
        "/blog/los-roques-archipelago-la-tortuga-island-2026-vip-guide",
      ],
    ];

    // `statusCode: 301` en vez de `permanent: true`.
    //
    // `permanent: true` emite 308, no 301 — es el comportamiento por defecto de
    // Next.js. Google trata 308 y 301 igual a efectos de traspasar
    // posicionamiento, así que funcionalmente daría igual, pero:
    //   · 308 conserva el método HTTP (un POST sigue siendo POST). Aquí solo
    //     hay páginas servidas por GET, así que no aporta nada.
    //   · herramientas de auditoría SEO y crawlers antiguos siguen esperando
    //     301, y verificar con redirect-checker devolvería "308" en vez del
    //     "301 Moved Permanently" que pide la especificación de SEO.
    // Sin ventaja en dejar el 308, se emite el 301 literal.
    return pairs.map(([source, destination]) => ({
      source,
      destination,
      statusCode: 301,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\n/g, ""),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Pathname",
            value: "/:path*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
