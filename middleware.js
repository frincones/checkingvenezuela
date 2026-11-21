import { updateSession } from "@/lib/db/supabase/middleware";

export async function middleware(request) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas MENOS:
     * - api/         -> ver explicacion abajo
     * - _next/static -> ficheros estaticos
     * - _next/image  -> optimizacion de imagenes
     * - favicon.ico
     * - imagenes de public/ por extension
     *
     * POR QUE SE EXCLUYE /api
     * -----------------------
     * El middleware solo hace dos cosas: `supabase.auth.getUser()` y fijar las
     * cabeceras x-pathname / x-url. En las rutas de API ninguna de las dos
     * aporta nada, y la primera cuesta una llamada de red a Supabase POR CADA
     * invocacion.
     *
     * Verificado antes de hacer el cambio, no supuesto:
     *
     * 1. Ninguna ruta de API lee x-pathname. Los unicos consumidores son
     *    app/layout.js y app/(pages)/layout.js, que son layouts de pagina.
     *
     * 2. Las ~90 rutas de API que necesitan sesion la comprueban POR SU CUENTA
     *    (`createClient()` + `getUser()`, o `auth()`). Y al ser Route Handlers
     *    SI pueden escribir cookies, asi que persisten el token refrescado;
     *    los Server Components no pueden, y por eso ahi si hacia falta.
     *
     * 3. `getUser()` refresca solo cuando el token ha expirado: comprobado en
     *    el codigo de @supabase/auth-js (`__loadSession` -> `_callRefreshToken`).
     *    El middleware no era el unico que lo hacia.
     *
     * 4. Los webhooks (Stripe, PayPal, Resend) y los endpoints de cron no
     *    autentican por sesion sino por firma o por CRON_SECRET. Para ellos el
     *    middleware era coste puro: una llamada de red antes de cada entrega.
     *
     * 5. El middleware NO protege ninguna ruta: no tiene redirects ni
     *    comprobaciones de permisos. La autorizacion vive en los layouts
     *    (app/(pages)/dashboard/layout.js) y en cada handler. Excluir /api no
     *    abre ningun agujero.
     *
     * Las paginas siguen cubiertas, que es donde el refresco si importa.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
