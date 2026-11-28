/**
 * ACCESO TEMPORAL AL CRM — CADUCA EL 2026-12-04
 *
 * Valida la contrasena de contingencia y emite la cookie firmada.
 * Existe porque Supabase Auth devuelve 402 desde el 2026-11-27 (restriccion
 * por cuota de egress) y sin el no hay forma de entrar al CRM.
 *
 * Se retira quitando TEMP_GATE_ENABLED (ver REVERTIR.md).
 */

import { NextResponse } from "next/server";
import {
  isTempGateEnabled,
  verifyPassword,
  buildSessionCookie,
  cookieOptions,
  COOKIE_NAME,
  GATE_EXPIRES_AT,
} from "@/lib/auth/tempGate";

/** Memoria de intentos por IP. Se reinicia con la lambda, y es suficiente: */
/** frena un ataque sostenido sin necesitar almacenamiento compartido. */
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);

  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }

  rec.count++;
  return rec.count > MAX_ATTEMPTS;
}

export async function POST(request) {
  if (!isTempGateEnabled()) {
    return NextResponse.json(
      { error: "El acceso temporal no esta disponible." },
      { status: 404 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconocida";

  if (rateLimited(ip)) {
    console.warn(`[temp-gate] demasiados intentos desde ${ip}`);
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 },
    );
  }

  let password = "";
  try {
    const body = await request.json();
    password = body?.password || "";
  } catch {
    return NextResponse.json({ error: "Peticion invalida." }, { status: 400 });
  }

  if (!verifyPassword(password)) {
    // Se registra el intento fallido: durante la contingencia conviene saber si
    // alguien esta probando la puerta.
    console.warn(`[temp-gate] contrasena incorrecta desde ${ip}`);
    return NextResponse.json({ error: "Contrasena incorrecta." }, { status: 401 });
  }

  console.log(
    `[temp-gate] ACCESO CONCEDIDO desde ${ip} | caduca ${GATE_EXPIRES_AT}`,
  );

  const res = NextResponse.json({ ok: true });
  const opts = cookieOptions();
  res.cookies.set(COOKIE_NAME, buildSessionCookie(), opts);
  return res;
}

/** Cierre de sesion: borra la cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  return res;
}
