"use client";
import { useEffect } from "react";
import { writeStorage } from "@/lib/utils/safeStorage";

/** Igual que SetLocalStorage pero contra sessionStorage. */
export function SetSessionStorage({ obj }) {
  useEffect(() => {
    Object.entries(obj).forEach(([key, value]) => {
      writeStorage(key, value, { session: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...Object.values(obj)]);
  return null;
}
