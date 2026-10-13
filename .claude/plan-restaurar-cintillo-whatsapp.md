# Plan: restaurar el acceso directo a WhatsApp en el cintillo naranja

Estado: **analizado, pendiente de aprobación**
Fecha: 2026-10-13
Origen: correo de Yeni del 12 de octubre

---

## 1. El reclamo

> "Favor cambiar el contenido del cintillo anaranjado ya que habla de whatsapp y
> la información que arroja es la misma que el cintillo azul. Pon la conexión
> con el whatsapp como estaba antes, ese te había pedido que lo dejaras igual ya
> que hay personas que aun pueden usar Whatsapp y hay que tener esa opción
> disponible."

Tiene razón en ambas cosas, y el error es mío.

---

## 2. Qué pasó exactamente

### Antes (hasta el commit 5dca705)

El cintillo llamaba a `requestCapture({ action: "whatsapp", ... })`. En aquella
versión del hook, esa función **abría WhatsApp directamente** con `window.open`
y **nunca abría el modal**: no guardaba `pendingAction` ni ponía
`modalOpen = true`.

El `<LeadCaptureModal>` estaba montado en el JSX pero era inalcanzable desde
este componente. Para el visitante, el cintillo era un enlace directo a
WhatsApp. **Eso es exactamente lo que Yeni describe.**

### Después (commits 8c4f73c y 5dca705)

Dos cambios encadenados:

1. `8c4f73c` arregló el hook para que `requestCapture` abriera el modal en vez
   de ejecutar la acción. Correcto en general, pero cambió el comportamiento
   del cintillo sin que yo lo notara.
2. `5dca705` sustituyó el modal viejo por `BookingRequestModal`.

Resultado: el cintillo naranja dejó de ir a WhatsApp y pasó a abrir el mismo
formulario que el azul.

### El estado actual, visto por el usuario

| | Naranja | Azul |
|---|---|---|
| Texto | "BOOK NOW VIA OUR WHATSAPP, WE ARE AVAILABLE 24/7" | "PREFER EMAIL? WRITE TO US…" |
| Al pulsar | Abre `BookingRequestModal` | Abre `BookingRequestModal` |
| Diferencia real | `origin="announcement_bar"` | `origin="email_bar"` |

Dos franjas, dos colores, dos textos, **el mismo comportamiento**. Y la naranja
promete WhatsApp sin darlo.

### Un daño adicional que causé

Cambié el `aria-label` de "Open WhatsApp to book a signature travel experience"
a "Request a signature travel experience". Quien usa lector de pantalla ya no
oye la palabra WhatsApp, que es justo la información que distingue esa franja.

---

## 3. El cambio propuesto

**Un solo fichero: `components/sections/AnnouncementBar.jsx`.**

- Quitar `BookingRequestModal` y el estado `open`.
- El `onClick` abre `https://wa.me/584264034052` con el mensaje prellenado, en
  pestaña nueva con `noopener,noreferrer`.
- Restaurar el `aria-label` que menciona WhatsApp.
- Mantener texto, colores y clases. No cambia nada visual.

**No se toca el cintillo azul.** Sigue abriendo el modal, que es lo correcto.

### Por qué NO se restaura el hook `useLeadCapture`

La versión antigua funcionaba por un defecto: el hook no abría el modal porque
le faltaba `setModalOpen(true)`. Volver a depender de eso sería construir sobre
un fallo.

Además `8c4f73c` arregló ese hook para los otros seis puntos de contacto, que
hoy sí lo necesitan. Revertirlo rompería esos seis.

El cintillo pasa a hacer `window.open` directo, sin hook. Es más simple, más
honesto respecto a lo que hace, y no arrastra dependencias.

---

## 4. Análisis de regresión

### 4.1 Alcance

`AnnouncementBar` se monta en **un solo sitio**: `app/layout.js:150`. Eso lo
pone en todas las páginas, así que un fallo aquí se ve en todo el sitio. Pero el
cambio es acotado: quitar un modal y poner un `window.open`.

### 4.2 Qué NO se toca

| Componente | Por qué no le afecta |
|---|---|
| `EmailBar` | Fichero distinto, no comparte estado |
| `useLeadCapture` | El cintillo deja de usarlo; los otros 6 puntos siguen igual |
| `BookingRequestModal` | Se deja de montar aquí; sigue montado en los otros 6 |
| `/api/booking-requests` | Sin cambios |
| Los 6 CTA restantes | No se tocan sus ficheros |

### 4.3 Pérdida de captura de lead: medida, no estimada

El cintillo dejaría de crear leads. Verificado en base de datos:

```
leads con origin = announcement_bar : 0 de 15
booking_requests desde el cintillo  : 0 de 1
```

**Cero leads perdidos**, ni antes del cambio ni después. El cintillo nunca ha
sido una fuente de captación: es un acceso rápido para quien ya quiere hablar.

### 4.4 Content-Security-Policy

Era el riesgo real a descartar: si la CSP bloqueara la navegación externa, el
clic no haría nada.

Revisada la cabecera en producción. No hay directiva `navigate-to`.
`form-action 'self'` solo aplica a `<form action>`, y `default-src` no restringe
`window.open` ni enlaces salientes. **WhatsApp no se bloquea.**

Confirmación práctica: `BookingRequestModal:210` ya abre `wa.me` hoy y funciona.

### 4.5 Analítica

Ninguno de los dos cintillos emite eventos a GA4 ni a Clarity. No hay métrica
que se rompa ni informe que dependa de esto.

Nota aparte: tampoco había forma de medir clics en el cintillo antes. Si
interesa saber cuánta gente lo usa, es un añadido posterior.

### 4.6 Tests

Hay tres ficheros de test (`leads`, `supabaseOperations`, `connection`). Ninguno
cubre componentes de interfaz. No hay snapshots. Nada que actualizar.

### 4.7 Número de WhatsApp duplicado

El mismo número aparece en cuatro sitios:

```
hooks/useLeadCapture.js:5           WHATSAPP_NUMBER
components/ui/BookingRequestModal.jsx:210   literal
lib/ai/tools/talkToHuman.js:16      WHATSAPP_NUMBER
components/sections/QuickLinks.js:106   tel: (teléfono, no WhatsApp)
```

Este cambio añadiría un quinto. **No lo centralizo ahora**: hacerlo tocaría tres
ficheros más y ampliaría el alcance de una corrección urgente. Queda anotado.

### 4.8 Riesgos

**R1 — Bloqueadores de ventanas emergentes.** `window.open` dentro de un manejador
de clic directo no suele bloquearse, y es el mismo patrón que ya usa el modal.
Riesgo bajo.

**R2 — Pérdida del contexto de campaña.** Al no pasar por el modal, un visitante
que llegue por campaña y pulse el cintillo no deja UTM registrado. Es el
comportamiento que había antes y el que Yeni pide. Aceptado.

**R3 — El azul queda como único captador desde la cabecera.** Correcto por
diseño: el naranja es acceso inmediato, el azul es captación con copia al
cliente.

---

## 5. Verificación antes de desplegar

1. `next build` sin errores.
2. El cintillo naranja abre `wa.me` en pestaña nueva, con el mensaje prellenado.
3. **No** abre ningún modal.
4. El cintillo azul sigue abriendo el modal.
5. El `aria-label` vuelve a mencionar WhatsApp.
6. Renderizar en navegador real varias páginas (home, `/about`, paquete, blog):
   sin error boundary.
7. Los otros 6 puntos de contacto siguen abriendo el modal.
8. En producción tras desplegar: repetir 2, 3 y 4.

---

## 6. Fuera de alcance

- Centralizar el número de WhatsApp (4 sitios hoy, 5 tras el cambio).
- Añadir seguimiento de clics en los cintillos.
- Revisar el texto del cintillo azul.
- Mailjet roto, `/flights` rota: pendientes de antes.

---

## 7. Reversión

Un solo commit sobre un solo fichero. `git revert` y vuelve al estado actual.
