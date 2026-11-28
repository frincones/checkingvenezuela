import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isPgFallbackEnabled } from "@/lib/db/pg/client";
import { createPgShimClient } from "@/lib/db/pg/restShim";
// TEMPORAL — puerta de contingencia mientras Supabase Auth esta restringido.
// Caduca el 2026-12-04. Ver REVERTIR.md.
import { isTempGateEnabled, getTempGateSession } from "@/lib/auth/tempGate";

export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );

  // PUERTA TEMPORAL — CADUCA EL 2026-12-04
  // ======================================
  // Las 56 rutas de la API comprueban la sesion llamando directamente a
  // `supabase.auth.getUser()`, no a `auth()` de lib/auth.js. Con Supabase Auth
  // en 402 (restriccion por cuota de egress desde el 2026-11-27) esa llamada
  // falla siempre y todas devuelven 401, de modo que el CRM carga las paginas
  // pero no puede leer ni escribir nada.
  //
  // En vez de tocar 56 archivos, se envuelve `auth.getUser` aqui: si Supabase
  // no reconoce al usuario pero el visitante trae la cookie firmada del guardia
  // temporal, se devuelve el usuario del CRM con la forma que Supabase daria.
  //
  // El orden importa: primero se intenta Supabase de verdad. Esta rama solo
  // actua cuando no hay sesion, asi que en cuanto la restriccion se levante el
  // comportamiento vuelve a ser el normal sin cambiar nada.
  //
  // Se retira quitando TEMP_GATE_ENABLED (ver REVERTIR.md).
  if (isTempGateEnabled()) {
    const originalGetUser = client.auth.getUser.bind(client.auth);

    client.auth.getUser = async (...args) => {
      const result = await originalGetUser(...args).catch(() => ({
        data: { user: null },
        error: { message: "Supabase Auth no disponible" },
      }));

      if (result?.data?.user) return result;

      const session = await getTempGateSession();
      if (!session) return result;

      return {
        data: {
          user: {
            id: session.user.id,
            email: session.user.email,
            // `user_metadata` es de donde el codigo saca el nombre a mostrar.
            user_metadata: { first_name: session.user.name, last_name: "" },
            app_metadata: { provider: "temp_gate" },
            aud: "authenticated",
            role: "authenticated",
            email_confirmed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
        error: null,
      };
    };
  }

  return client;
}

// Admin client with service role (bypasses RLS)
//
// RUTA DE EMERGENCIA — TEMPORAL (hasta 2026-12-04)
// ================================================
// El 2026-11-27 Supabase restringio el proyecto por exceder la cuota de egress
// (6,65 GB de 5,5 GB). La restriccion devuelve HTTP 402 en TODOS sus servicios
// HTTP, PostgREST incluido, de modo que este cliente deja de funcionar y la
// aplicacion se queda sin datos.
//
// La base de datos SI acepta conexiones por el pooler. Cuando
// PG_FALLBACK_ENABLED=true, esta funcion devuelve un adaptador que habla SQL
// directo con la misma interfaz (`.from().select().eq()...`), de modo que las
// ~1.400 llamadas repartidas por 96 archivos siguen funcionando sin tocarlas.
//
// Sin esa variable de entorno, el comportamiento es identico al de siempre.
//
// LIMITE: el adaptador NO cubre Storage, Auth ni .rpc(). Quien los use seguira
// fallando mientras la restriccion este activa; no hay equivalente en SQL.
//
// Para retirar esta ruta: quitar PG_FALLBACK_ENABLED (ver REVERTIR.md).
export function createAdminClient() {
  if (isPgFallbackEnabled()) {
    return createPgShimClient();
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
