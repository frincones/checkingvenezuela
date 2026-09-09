"use client";
import { useEffect } from "react";
import { writeStorage } from "@/lib/utils/safeStorage";

/**
 * Escribe pares clave/valor en localStorage al montar.
 *
 * Usa writeStorage en vez de localStorage.setItem directo: con el
 * almacenamiento de sitio bloqueado el objeto puede ser null o lanzar
 * SecurityError, y al ejecutarse dentro de un efecto de React la excepcion
 * sube al error boundary de la raiz y tumba la pagina entera.
 */
export function SetLocalStorage({ obj }) {
  useEffect(() => {
    Object.entries(obj).forEach(([key, value]) => {
      writeStorage(key, value);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...Object.values(obj)]);
  return null;
}
