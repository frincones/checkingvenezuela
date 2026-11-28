# REVERTIR — Contingencia por restricción de egress en Supabase

> **Fecha límite: 4 de diciembre de 2026.**
> Todo lo descrito aquí es temporal y debe retirarse. Si no se retira, el código
> deja de funcionar por sí solo (caducidad incorporada), pero los archivos y las
> variables siguen ahí y hay que limpiarlos.

## Qué pasó

El 27 de noviembre de 2026 Supabase aplicó la restricción `exceed_egress_quota`
al proyecto `checkinvenezuela`: 6,65 GB consumidos de 5,5 GB disponibles en el
plan Free. La cuota se recarga el **4 de diciembre de 2026** (con posible
retraso de hasta 48 h según su documentación).

Mientras la restricción está activa, **todos los servicios HTTP de Supabase
devuelven HTTP 402**: PostgREST, Auth, Storage, Realtime y Edge Functions. La
base de datos en sí **no** está restringida y acepta conexiones por el pooler
con normalidad.

Soporte confirmó (ticket SU-572422) que no pueden levantar la restricción
manualmente en el plan Free, y que pausar o borrar el proyecto no borra el
consumo ya registrado.

## Causa raíz (ya corregida, commit `dd69642`)

El buzón del CRM (`app/(pages)/dashboard/email/page.js`) recargaba la bandeja
cada 30 segundos descargando el cuerpo completo de 50 correos, incluso con la
pestaña en segundo plano. Al ritmo de ~20 KB por correo, eso suponía del orden
de 1 GB al día contra una cuota mensual de 5,5 GB.

Corregido en tres frentes: intervalo a 120 s, pausa cuando la pestaña no está
visible, y recorte del cuerpo a 200 caracteres en la respuesta de la lista.

---

## PASO 1 — Comprobar que Supabase ya responde

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://stbbckupkuxasfthlsys.supabase.co/rest/v1/destinations?select=id&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

- `200` → la restricción se levantó. Continuar.
- `402` → sigue activa. **No revertir todavía.**

## PASO 2 — Quitar las variables de entorno

En **Vercel** (Settings → Environment Variables) y en el `.env.local` local,
borrar el bloque marcado `CONTINGENCIA POR RESTRICCION DE EGRESS`:

| Variable | Qué activaba |
|---|---|
| `PG_FALLBACK_ENABLED` | acceso a datos por Postgres directo |
| `SUPABASE_DB_PASSWORD` | credencial de ese acceso |
| `SUPABASE_DB_HOST` | host del pooler |
| `SUPABASE_DB_PORT` | puerto del pooler |
| `TEMP_GATE_ENABLED` | puerta de acceso al CRM |
| `TEMP_GATE_PASSWORD` | contraseña de esa puerta |
| `TEMP_GATE_SECRET` | secreto de firma de la cookie |
| `FORWARD_TO` | destino del reenvío de correos |

**Quitar `PG_FALLBACK_ENABLED` y `TEMP_GATE_ENABLED` basta para desactivarlo
todo**: sin ellas, el código recorre exactamente los mismos caminos que antes de
la contingencia. El resto de la limpieza es higiene.

En **GitHub** (Settings → Secrets → Actions), borrar `FORWARD_TO`. El secret
`RESEND_API_KEY` se conserva si lo usa algo más.

## PASO 3 — Borrar los archivos de contingencia

```bash
git rm -r lib/db/pg/ lib/auth/tempGate.js app/temp-login/ \
          app/api/temp-gate/ app/api/cronjob/forward_emails/ \
          scripts/email/forward-to-gmail.mjs \
          .github/workflows/temp-forward-emails.yml
```

`scripts/email/reingest.mjs` **se puede conservar**: no depende de la
contingencia y sirve para recuperar correos desde Resend en cualquier momento.

## PASO 4 — Revertir los archivos modificados

Cuatro archivos tienen bloques marcados como temporales. En cada uno, borrar el
bloque comentado y dejar el código original:

| Archivo | Qué quitar |
|---|---|
| `lib/db/supabase/server.js` | el `if (isPgFallbackEnabled())` de `createAdminClient`, el envoltorio de `auth.getUser` en `createClient`, y los tres imports temporales |
| `lib/auth-supabase.js` | la llamada a `getTempGateSession()` dentro de `auth()` y su import |
| `app/(pages)/dashboard/layout.js` | el `if (isTempGateEnabled()) redirect("/temp-login")` y su import |
| `vercel.json` | la entrada de `crons` |

Alternativa más limpia si no hubo otros cambios encima:

```bash
git revert <hash-del-commit-de-contingencia>
```

## PASO 5 — Quitar las dependencias si no se usan

```bash
npm uninstall pg          # solo lo usaba la ruta de Postgres
```

`resend` **se conserva**: ya existía antes (se actualizó de `^6.9.3` a
`^6.41.0`) y lo usa el envío normal de correos.

## PASO 6 — Recuperar los adjuntos perdidos

Durante la restricción, Supabase Storage estuvo caído y los adjuntos de los
correos entrantes no se guardaron. Las filas tienen `storage_path: null` y
`ingest_error: "storage_restringido_egress_2026-11"`.

Los ficheros **siguen en Resend** y se pueden recuperar. Para localizarlos:

```sql
SELECT id, resend_id, subject, created_at
FROM emails
WHERE attachments::text LIKE '%storage_restringido_egress%'
ORDER BY created_at DESC;
```

## PASO 7 — Verificar

```bash
npm run build
npm run start
```

Comprobar: `/`, `/packages`, `/blog`, el login normal en `/user/login`, el
buzón del CRM y el envío de un correo de prueba.

---

## ROTAR CREDENCIALES — HACER ESTO IGUAL

Estas credenciales se pegaron en un chat durante la contingencia y deben
considerarse **expuestas**:

| Credencial | Dónde se rota | Riesgo |
|---|---|---|
| Contraseña de Postgres | Dashboard → Settings → Database | acceso total de lectura y escritura a la base |
| Token de gestión `sbp_` | Dashboard → Account → Access Tokens | **control total de la organización** |
| `service_role` key | Dashboard → Settings → API | salta RLS |
| Tokens de Vercel `vcp_` | vercel.com/account/tokens | despliegues y variables |
| `TEMP_GATE_PASSWORD` | deja de existir al revertir | acceso al CRM |

Rotar la contraseña de Postgres **después** de revertir, o la aplicación perderá
el acceso mientras `PG_FALLBACK_ENABLED` siga activo.

## PREVENIR QUE VUELVA A PASAR

1. **Vigilar el egress** en Dashboard → Usage, no solo al final del ciclo.
2. **No devolver cuerpos completos en listados.** El patrón que agotó la cuota
   fue una lista que traía `body_text` entero de 50 filas cada 30 segundos.
   Recortar en el servidor y pedir el detalle solo al abrir.
3. **Pausar el sondeo con la pestaña oculta.** Un `visibilitychange` evita miles
   de peticiones nocturnas.
4. **Contar en Postgres, no en JavaScript.** `select("id", { count: "exact",
   head: true })` devuelve la cifra sin traer filas.
5. **Considerar el plan Pro** (25 USD/mes): 250 GB de egress frente a 5,5 GB, y
   la restricción se levanta al instante si vuelve a ocurrir.
