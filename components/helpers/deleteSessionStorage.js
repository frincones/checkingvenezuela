"use client";
import { useEffect } from "react";
import { removeStorage } from "@/lib/utils/safeStorage";

/** Borra claves de sessionStorage al montar, sin romper si esta bloqueado. */
export function DeleteSessionStorage({ keyArr }) {
  useEffect(() => {
    keyArr.forEach((key) => {
      removeStorage(key, { session: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyArr.join()]);
  return null;
}
