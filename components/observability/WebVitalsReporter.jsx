"use client";

/**
 * Envía las Core Web Vitals del visitante a /api/observability/ingest.
 *
 * Mide el rendimiento REAL de usuarios reales, que es distinto de una prueba de
 * laboratorio: incluye su dispositivo, su red y su distancia al servidor. Es lo
 * que permitió detectar antes que Yeni cargaba el sitio en ~10 s desde Europa.
 *
 * DECISIONES QUE IMPORTAN
 * -----------------------
 *   · `navigator.sendBeacon`: la petición sobrevive al cierre de la pestaña y
 *     no compite con la carga de la página. Un `fetch` normal se cancelaría al
 *     navegar, justo cuando se emite el valor final de CLS.
 *
 *   · Agrupa y envía por lotes: `useReportWebVitals` dispara una llamada por
 *     métrica, lo que serían hasta 5 peticiones por visita. Agrupándolas es una.
 *
 *   · No añade JavaScript de terceros: usa el hook que Next.js ya trae, así que
 *     el coste en el bundle es mínimo.
 *
 *   · Si algo falla, falla en silencio. La telemetría nunca debe degradar la
 *     experiencia de quien visita el sitio.
 */

import { useReportWebVitals } from "next/web-vitals";
import { useEffect, useRef } from "react";

const ENDPOINT = "/api/observability/ingest";

// Las métricas llegan en momentos distintos (TTFB al inicio, CLS al final), así
// que se acumulan y se vacían de golpe.
const FLUSH_DELAY_MS = 2500;

export function WebVitalsReporter() {
  const queue = useRef([]);
  const timer = useRef(null);
  const sent = useRef(false);

  const flush = () => {
    if (!queue.current.length || sent.current) return;
    const events = queue.current.splice(0, 20);

    const payload = JSON.stringify({ events });
    try {
      // sendBeacon es el único transporte que el navegador garantiza al
      // descargar la página. El fetch con keepalive es el respaldo para los
      // navegadores que no lo soportan.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(ENDPOINT, {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Un bloqueador puede impedirlo. No es un problema que deba verse.
    }
  };

  useReportWebVitals((metric) => {
    queue.current.push({
      kind: "web_vital",
      metric_name: metric.name,
      value: metric.value,
      rating: metric.rating,
      route: window.location.pathname,
    });

    // Se reinicia el temporizador en cada métrica para enviar una sola vez
    // cuando dejen de llegar.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, FLUSH_DELAY_MS);
  });

  useEffect(() => {
    // `visibilitychange` con estado 'hidden' es la señal fiable de salida de
    // página; `beforeunload` no se dispara en móviles.
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, []);

  return null;
}
