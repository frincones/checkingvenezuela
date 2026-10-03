# Plan: modal de solicitud con revelado progresivo

Estado: **analizado, pendiente de aprobación**
Fecha: 2026-10-03
Origen: requerimiento de Yeni + mockup aprobado
Rama: `feat/booking-request-modal` desde `dev` (hoy idéntica a `master`)

---

## 1. Hallazgo que cambia el plan

**El formulario que pide Yeni ya existe y nadie puede llegar a él.**

`components/pages/packages/sections/PackageBookingForm.jsx` tiene 9 campos:
nombre, apellido, email, teléfono con prefijo, fecha de viaje, número de
personas, peticiones especiales y consentimiento. Crea el lead y **no abre
WhatsApp**: muestra un toast de confirmación.

Vive en `/packages/[slug]/book`, y es inalcanzable por dos motivos:

1. **Ningún enlace apunta a ella.** Ni la ficha de paquete ni ningún otro sitio.
2. **Exige sesión iniciada.** `app/(pages)/packages/[slug]/book/page.js:23`
   redirige a login. Verificado en producción: responde 307 hacia
   `/user/login?callbackUrl=...`.

O sea: el 80% del formulario de Yeni está escrito, probado y muerto detrás de un
muro de autenticación que no tiene sentido para captar un lead frío.

**Consecuencia para el plan:** no se parte de cero. Se extrae la lógica de ese
formulario al modal y se reutiliza. Y la página `/book` queda como el "paso 2"
opcional tras convertir, ya sin exigir sesión.

---

## 2. Inventario exacto: 7 componentes

| # | Componente | Dónde se monta | Qué hace hoy | interest_type |
|---|---|---|---|---|
| 1 | `AnnouncementBar.jsx` | **`app/layout.js` → todo el sitio** | Cintillo naranja → WhatsApp | `other` |
| 2 | `FooterWhatsAppLink.jsx` | **`QuickLinks.js` → footer global** | Enlace → WhatsApp | `other` |
| 3 | `DualCTA.js` | 6 páginas, 3 variantes | "Get a quote" → WhatsApp | variable |
| 4 | `PackageActions.jsx` | `/packages/[slug]` | "Book now" → WhatsApp | `package` |
| 5 | `PackageBottomCTA.jsx` | `/packages/[slug]` | CTA inferior → WhatsApp | `package` |
| 6 | `ContactCTA.jsx` | `/about` | CTA → WhatsApp | `other` |
| 7 | `PackageBookingForm.jsx` | `/packages/[slug]/book` | Formulario real, sin WhatsApp | `package` |

### Dos grupos con necesidades distintas

**Con producto** (4, 5, 7): el modal precarga paquete y precio.
**Sin producto** (1, 2, 6): contacto genérico, `interest_type: "other"`. El modal
debe funcionar sin producto; si no, el cintillo del layout se rompe en todo el sitio.

### Código muerto confirmado

- `components/WhatsAppButton.js` — cero montajes, solo lo cita un comentario
- `components/ui/DualCTAWithTracking.js` — cero referencias

No se tocan. Anotados para limpieza aparte.

---

## 3. Análisis de riesgo por componente

| # | Componente | Riesgo | Por qué |
|---|---|---|---|
| 1 | `AnnouncementBar` | **ALTO** | Está en el layout raíz: un fallo afecta a todas las páginas |
| 2 | `FooterWhatsAppLink` | **ALTO** | Footer global, mismo alcance |
| 3 | `DualCTA` | **ALTO** | 3 variantes × 6 usos = 18 combinaciones a verificar |
| 4 | `PackageActions` | MEDIO | Una ruta, alta conversión |
| 5 | `PackageBottomCTA` | MEDIO | Una ruta |
| 6 | `ContactCTA` | BAJO | Una página |
| 7 | `PackageBookingForm` | MEDIO | Hoy inalcanzable; quitar el muro de login lo expone |

### 3.1 `DualCTA` es más complejo de lo que aparenta

Tres variantes (`compact`, `card`, `default`) y el modal repetido en las tres
ramas del return. Además:

- **El botón "Book now" NO abre modal.** Es un `<Link href={onlinePath}>`. Solo
  "Get a quote" abre el modal. El requerimiento de Yeni habla de "Book now", así
  que hay que decidir si ese enlace pasa a abrir el modal.
- **`variant="hero"` no existe** en el componente (`destinos/[slug]` lo pasa).
  Cae silenciosamente al default. Bug cosmético preexistente.
- **Etiquetas en español en un sitio en inglés**: `"Planificar mi viaje"` en blog
  y `"Cotizar Ahora"` en destinos. Resto del flip pendiente.

Los `onlinePath` reales: `/flights`, `/hotels`, `service.href`, y tres con
`onlineEnabled={false}`.

### 3.2 El doble WhatsApp

`hooks/useLeadCapture.js` abre WhatsApp **dos veces**: `requestCapture()` lo abre
al pulsar, antes de rellenar nada, y `handleLeadSubmit()` otra vez al enviar.

Hoy pasa desapercibido porque el destino coincide. Con el selector de canal se
vuelve un fallo visible: elegir "Email" abriría WhatsApp igualmente.

**Corrección:** `requestCapture()` solo abre el modal. La acción se ejecuta al
enviar, según el canal elegido. Toca los 6 componentes que usan el hook a la vez.

### 3.3 `preferred_contact_method` escrito a fuego

```
components/ui/LeadCaptureModal.jsx:109          "whatsapp"
components/pages/packages/sections/PackageBookingForm.jsx:73   "whatsapp"
app/api/crm/leads/route.js:181                  body.… || "whatsapp"
```

Los 14 leads lo tienen igual porque **nadie lo eligió**. No hay evidencia de que
la gente rechace WhatsApp; solo de que nunca se le ofreció otra cosa.

Riesgo: verificar que `dashboard/leads` renderiza `email` y `phone` sin asumir
`whatsapp`.

### 3.4 Bug preexistente en el CRM

`dashboard/leads/[id]/page.js` pinta `lead.interest` y `lead.metadata`, y
**ninguna columna existe**. Los datos están en `interest_type` e
`interest_details`.

```jsx
{lead.interest && ( ... )}                                    // siempre undefined
{lead.metadata && Object.keys(lead.metadata).length > 0 && ( ... )}
```

No rompe (guardas `&&`), pero **el asesor nunca ve qué pidió el cliente**. Con el
modal nuevo guardaríamos más contexto que nadie podría leer, así que se arregla.

### 3.5 El contrato de `/api/crm/leads` no se toca

Lo consumen **11 sitios**: listado, alta, detalle y edición de leads, alta de
cotizaciones, el formulario de paquete y el modal.

Verificado: el CRM **guarda pero no renderiza** `interest_details` en ningún
sitio. Añadirle claves es seguro.

### 3.6 Seguridad

`POST /api/crm/leads` es público, sin autenticación y sin rate limiting, usando
`createAdminClient()` (salta RLS). Verificado que un anónimo **no** puede
insertar directo en `leads`.

El endpoint nuevo lleva límite por IP, con el patrón de
`app/api/chatbot/chat/route.js`. No hay captcha en el proyecto.

### 3.7 Correo: Resend, no Mailjet

`lib/email/sendEmail.js` usa Mailjet, sin credenciales en local ni en Vercel.
Falla en silencio:

```js
if (!client) { console.warn("Email not sent - Mailjet not configured"); return; }
```

Efecto ya presente: confirmación de registro, reseteo de contraseña y
verificación de email **no llegan a nadie**. Problema aparte.

Aquí se usa **Resend**, operativo en producción.

### 3.8 Checklist

| Comprobación | Estado |
|---|---|
| Contrato `/api/crm/leads` | No se modifica |
| `interest_details` renderizado en CRM | No, solo guardado |
| RLS: insert anónimo en `leads` | Bloqueado |
| RLS: lectura anónima `quotations`, `profiles` | Bloqueada |
| Resend operativo | Sí |
| Mailjet operativo | **No** |
| Rate limiting reutilizable | Sí (chatbot) |
| Captcha | No existe |
| Cintillo naranja | Se conserva |
| WhatsApp como canal | Sigue, ahora elegible |

---

## 4. Base de datos

```sql
create table booking_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  request_type text not null default 'quote'
    check (request_type in ('booking','quote')),
  product_type text,
  product_slug text,
  product_name text,
  travel_period text,
  travelers_count int,
  adults int,
  children int,
  preferred_channel text
    check (preferred_channel in ('whatsapp','email','phone')),
  companions jsonb default '[]'::jsonb,
  needs_flight boolean default false,
  departure_city text,
  special_requirements text,
  locale text default 'en',
  client_email_sent_at timestamptz,
  team_email_sent_at timestamptz,
  created_at timestamptz default now()
);

alter table booking_requests enable row level security;
-- Sin políticas para anon ni authenticated.
create index on booking_requests (lead_id);
create index on booking_requests (created_at desc);
```

Sin tabla de pasaportes, por minimización de datos.

---

## 5. Pasos de implementación

### Fase A — sin tocar nada existente (riesgo bajo)

**Paso 1. Migración `booking_requests`**
Tabla nueva con RLS cerrada. No afecta a nada.
*Verificar:* la tabla existe; un anónimo no puede leerla ni escribirla.

**Paso 2. `POST /api/booking-requests`**
Endpoint nuevo con rate limiting por IP. Crea lead + booking_request en una
operación. Reutiliza la forma de datos del endpoint actual.
*Verificar:* crea ambos registros; el límite corta al superarse.

**Paso 3. Correos por Resend**
Dos plantillas: cliente (confirmación, sin datos sensibles) y equipo
(`reservas@`, todo). Idioma según el del formulario.
*Verificar:* llegan los dos; el del cliente en el idioma correcto.

**Paso 4. `BookingRequestModal`**
Componente nuevo, sin sustituir nada todavía. Revelado progresivo, selector de
canal, funciona **con y sin producto**.
*Verificar:* montarlo en una página de prueba y enviar.

### Fase B — tocar lo existente (riesgo alto)

**Paso 5. Corregir el doble WhatsApp en `useLeadCapture`**
`requestCapture()` solo abre el modal.
*Verificar:* los 6 componentes; no debe abrirse WhatsApp al pulsar.

**Paso 6. Sustituir en los 3 de riesgo bajo/medio**
`ContactCTA`, `PackageActions`, `PackageBottomCTA`.
*Verificar:* `/about` y la ficha de paquete.

**Paso 7. Sustituir en `DualCTA`**
Las 3 variantes. Decidir si "Book now" abre el modal o sigue navegando.
*Verificar:* las 6 páginas y las 3 variantes.

**Paso 8. Sustituir en los 2 globales**
`AnnouncementBar` y `FooterWhatsAppLink`. **El más delicado**: están en el layout.
*Verificar:* varias páginas distintas, incluida la home.

### Fase C — complementos (riesgo bajo)

**Paso 9. Cintillo azul de email** bajo el naranja.

**Paso 10. Ocultar vuelos y hoteles populares** (`app/page.js:86-89`).

**Paso 11. Arreglar `lead.interest` / `lead.metadata`** en el detalle del CRM.

**Paso 12. Liberar `/book` como paso 2**
Quitar el muro de login y enlazarla desde la confirmación del modal, con el lead
ya creado.
*Verificar:* accesible sin sesión; no rompe el flujo autenticado.

---

## 6. Verificación antes de desplegar

1. `next build` sin errores.
2. Los 7 componentes abren el modal y envían.
3. `AnnouncementBar` y `FooterWhatsAppLink` funcionan en varias páginas.
4. **No se abre WhatsApp al pulsar**, solo al enviar con ese canal.
5. Los 3 canales se comportan distinto.
6. Modal **sin producto** (cintillo, footer, about) funciona.
7. Llegan los dos correos, idioma correcto.
8. El lead aparece con `preferred_contact_method` real.
9. El detalle del lead muestra el interés.
10. Las 6 páginas de `DualCTA` × 3 variantes, en navegador real.
11. En producción: los 7 puntos tras desplegar.

---

## 7. Fuera de alcance

- Arreglar Mailjet / `sendEmail.js` (roto, documentado)
- Arreglar `/flights` (rota y en el sitemap)
- Desindexar `/flights` y `/hotels`
- Borrar código muerto (`WhatsAppButton.js`, `DualCTAWithTracking.js`)
- Traducir las etiquetas en español de `DualCTA`
- Arreglar `variant="hero"` inexistente
- Captcha

---

## 8. Reversión

Un commit por paso. El modal antiguo permanece en el repositorio hasta que el
nuevo lleve tiempo en producción, así que cualquier paso de la fase B se revierte
con `git revert`.

La tabla nueva no se borra al revertir; queda vacía sin afectar a nada.

---

## 9. Decisión tomada: "Book now" abre el modal

Confirmado por Emma el 2026-10-03. En `DualCTA`, el botón deja de ser un `<Link>`
de navegación y pasa a abrir el modal, igual que "Get a quote".

Efecto secundario a favor: hoy dos de los seis usos navegan a `/flights` y
`/hotels`. `/flights` está rota en producción, así que el modal también evita
que alguien aterrice en una pantalla de error desde la home.

Los tres usos con `onlineEnabled={false}` (blog, destinos, destinos de Venezuela)
no muestran ese botón, así que no cambian.

### Consecuencia de diseño: el modal sirve a TRES contextos

| Contexto | Componentes | Cabecera del modal |
|---|---|---|
| **Con producto** | PackageActions, PackageBottomCTA, PackageBookingForm | Nombre + precio |
| **Con destino** | DualCTA en destinos, blog, servicios | Nombre, sin precio |
| **Sin nada** | AnnouncementBar, FooterWhatsAppLink, ContactCTA | Solo "Talk to an advisor" |

El bloque de fecha y viajeros solo aparece en los dos primeros. En el genérico se
sustituye por un campo libre de mensaje.

**Esto es un requisito duro, no un detalle estético:** si el modal diera por hecho
que siempre hay producto, el cintillo del layout raíz se rompería en todas las
páginas del sitio.

Mockup navegable con los tres contextos:
https://claude.ai/artifact/77pG3EVppT71rErFGyJfmh
