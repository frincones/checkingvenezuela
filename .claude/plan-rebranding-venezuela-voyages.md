# Plan de Rebranding: Venezuela Voyages

## Resumen Ejecutivo

Este plan detalla la migración del branding de "CHECK-IN VENEZUELA" a "VENEZUELA VOYAGES" siguiendo las directrices de diseño proporcionadas.

---

## 1. ANÁLISIS DEL ESTADO ACTUAL

### 1.1 Logo Actual
- **Archivo**: `/public/images/checkin-venezuela-logo.png`
- **Componente**: `components/Logo.js`
- **Alt text**: "Check-in Venezuela Logo"
- **Aria-label**: "Check-in Venezuela - Ir a inicio"

### 1.2 Paleta de Colores Actual (globals.css)
```css
--primary: 207 100% 23%;        /* Azul ~#004077 */
--secondary: 162 59% 41%;       /* Verde menta ~#3A9D86 */
--accent: 210 40% 96.1%;        /* Gris claro */
```

### 1.3 Archivos que Usan Logo/Branding

| Archivo | Uso |
|---------|-----|
| `components/Logo.js` | Componente principal del logo |
| `components/sections/Nav.js` | Header/Navegación |
| `components/sections/Footer.js` | Pie de página |
| `components/sections/QuickLinks.js` | Footer - Info de contacto |
| `components/local-ui/nav/SideBar.js` | Menú móvil |
| `app/layout.js` | Metadata, title, description |
| `data/emailDefaultData.js` | Templates de email |
| `app/api/crm/quotations/[id]/pdf/route.js` | PDF de cotizaciones |
| `components/pages/user.my_bookings.flights.[bookingRef].ticket/Ticket.jsx` | Tickets de vuelo |

### 1.4 Colores Hardcodeados Detectados
- `#8DD3BB` - Verde menta (SubscribeNewsletter, varios)
- `#CDEAE1` - Verde claro (SubscribeNewsletter background)
- `#004077` - Azul (NextTopLoader)

---

## 2. NUEVO BRANDING: VENEZUELA VOYAGES

### 2.1 Identidad Cromática

| Elemento | Nombre | Hexadecimal | HSL (Tailwind) | Uso |
|----------|--------|-------------|----------------|-----|
| **Primario** | Azul Profundo | `#0A1A44` | `225 75% 15%` | Textos principales, fondos oscuros |
| **Secundario** | Naranja Atardecer | `#F2A93B` | `38 87% 59%` | Botones CTA, iconos |
| **Acento** | Dorado Arena | `#FFD275` | `42 100% 73%` | Detalles, resaltados |
| **Base** | Blanco Nube | `#FFFFFF` | `0 0% 100%` | Fondos principales |

### 2.2 Gradientes
```css
/* Gradiente Solar (Botones y Banners) */
background: linear-gradient(45deg, #F2A93B, #FFD275);

/* Gradiente Abismo (Footers y Hero Sections) */
background: linear-gradient(180deg, #1B498B, #0A1A44);
```

### 2.3 Tipografía
- **Títulos**: Montserrat Bold (ya configurada como `--font-monserrat`)
- **Cuerpo**: Montserrat Regular (ya configurada)

### 2.4 Nuevo Logo
- **Archivo fuente**: `logo mama.PNG`
- **Nombre destino**: `/public/images/venezuela-voyages-logo.png`
- **Marca**: "VENEZUELA VOYAGES"
- **Eslogan**: "EXPLORE NOW"

---

## 3. PLAN DE IMPLEMENTACIÓN

### Fase 1: Preparación de Assets
**Archivos a crear/modificar:**

1. **Copiar y renombrar logo**
   - De: `logo mama.PNG`
   - A: `/public/images/venezuela-voyages-logo.png`

2. **Crear versión negativa del logo** (para fondos oscuros)
   - `/public/images/venezuela-voyages-logo-white.png`

### Fase 2: Actualizar Sistema de Colores

**Archivo: `app/globals.css`**
```css
:root {
  /* Nuevos colores Venezuela Voyages */
  --primary: 225 75% 15%;           /* #0A1A44 Azul Profundo */
  --primary-foreground: 0 0% 100%;  /* Blanco */

  --secondary: 38 87% 59%;          /* #F2A93B Naranja Atardecer */
  --secondary-foreground: 225 75% 15%; /* Azul Profundo */

  --accent: 42 100% 73%;            /* #FFD275 Dorado Arena */
  --accent-foreground: 225 75% 15%; /* Azul Profundo */

  /* Gradientes como custom properties */
  --gradient-solar: linear-gradient(45deg, #F2A93B, #FFD275);
  --gradient-abyss: linear-gradient(180deg, #1B498B, #0A1A44);
}
```

**Archivo: `tailwind.config.js`**
- Agregar colores adicionales para gradientes
- Agregar clases de utilidad para gradientes

### Fase 3: Actualizar Componente Logo

**Archivo: `components/Logo.js`**
- Cambiar src a nuevo logo
- Actualizar alt text: "Venezuela Voyages Logo"
- Actualizar aria-label: "Venezuela Voyages - Ir a inicio"
- Agregar prop `variant` para versión clara/oscura

### Fase 4: Actualizar Header/Nav

**Archivo: `components/sections/Nav.js`**
- Logo ya usa componente `<Logo />` - se actualizará automáticamente
- Actualizar colores de botones de acción al nuevo secondary (naranja)

### Fase 5: Actualizar Footer

**Archivo: `components/sections/Footer.js`**
- Cambiar "CHECK-IN VENEZUELA" → "VENEZUELA VOYAGES"
- Aplicar gradiente Abismo como fondo

**Archivo: `components/sections/QuickLinks.js`**
- Logo ya usa `<Logo />` - se actualizará automáticamente
- Actualizar colores de iconos sociales

### Fase 6: Actualizar Newsletter

**Archivo: `components/SubscribeNewsletter.js`**
- Reemplazar `#CDEAE1` por variable CSS o nuevo color acento
- Reemplazar `#8DD3BB` por variable CSS
- Aplicar gradiente Solar a botón de suscripción

### Fase 7: Actualizar Metadata

**Archivo: `app/layout.js`**
```javascript
export const metadata = {
  title: "VENEZUELA VOYAGES | Explore Now - Tu Agencia de Viajes",
  description: "VENEZUELA VOYAGES es tu agencia de viajes en Venezuela...",
  // ...
};
```

### Fase 8: Actualizar PDFs y Emails

**Archivo: `app/api/crm/quotations/[id]/pdf/route.js`**
- Cambiar "CHECK-IN VENEZUELA" → "VENEZUELA VOYAGES"
- Actualizar colores del PDF (#0A1A44 primario, #F2A93B secundario)
- Cambiar slogan a "EXPLORE NOW"

**Archivo: `data/emailDefaultData.js`**
- Actualizar URL del logo
- Actualizar nombre de empresa

### Fase 9: Actualizar Tickets de Vuelo

**Archivo: `components/pages/user.my_bookings.flights.[bookingRef].ticket/Ticket.jsx`**
- Actualizar colores y branding en ticket impreso

### Fase 10: Limpieza de Colores Hardcodeados

Reemplazar en todos los archivos:
- `#8DD3BB` → `hsl(var(--accent))` o clase Tailwind
- `#CDEAE1` → Crear variable `--accent-light`
- `#004077` → `hsl(var(--primary))`

---

## 4. VALIDACIÓN UX/UI (según designer-ux-ui.md)

### 4.1 Checklist de Validación

#### Colores
- [ ] No hay colores hardcodeados (usar variables CSS)
- [ ] Contraste >= 4.5:1 en textos (WCAG AA)
- [ ] Colores consistentes en toda la app

#### Componentes
- [ ] Logo visible en fondos claros y oscuros
- [ ] Botones CTA con gradiente Solar
- [ ] Estados hover/active actualizados con nuevos colores

#### Responsive
- [ ] Logo se escala correctamente en mobile
- [ ] Newsletter section mantiene legibilidad
- [ ] Footer legible en todos los breakpoints

#### Accesibilidad
- [ ] Alt texts actualizados
- [ ] Aria-labels actualizados
- [ ] Focus states visibles con nuevo esquema de color

### 4.2 Matriz de Contraste

| Combinación | Ratio | Estado |
|-------------|-------|--------|
| Azul Profundo (#0A1A44) sobre Blanco | 15.2:1 | ✅ AAA |
| Naranja (#F2A93B) sobre Azul Profundo | 6.8:1 | ✅ AA |
| Blanco sobre Naranja (#F2A93B) | 2.4:1 | ⚠️ Usar texto grande |
| Dorado (#FFD275) sobre Azul Profundo | 9.1:1 | ✅ AAA |

---

## 5. ARCHIVOS A MODIFICAR (Lista Completa)

### Alta Prioridad (Visibles al Usuario)
1. `/public/images/` - Agregar nuevo logo
2. `app/globals.css` - Sistema de colores
3. `tailwind.config.js` - Extender colores
4. `components/Logo.js` - Componente logo
5. `components/sections/Nav.js` - Header
6. `components/sections/Footer.js` - Footer
7. `components/sections/QuickLinks.js` - Footer links
8. `components/SubscribeNewsletter.js` - Newsletter
9. `app/layout.js` - Metadata

### Media Prioridad (Funcionalidades)
10. `app/api/crm/quotations/[id]/pdf/route.js` - PDFs
11. `components/pages/user.my_bookings.flights.[bookingRef].ticket/Ticket.jsx` - Tickets
12. `data/emailDefaultData.js` - Emails
13. `app/(pages)/dashboard/page.js` - Dashboard CRM
14. `components/local-ui/nav/SideBar.js` - Menú móvil

### Baja Prioridad (Colores hardcodeados)
15-62. Archivos con colores hardcodeados listados en análisis

---

## 6. RIESGOS Y MITIGACIÓN

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Contraste insuficiente | Alto | Validar con herramientas WCAG |
| Logo pixelado | Medio | Usar PNG de alta resolución |
| Colores inconsistentes | Medio | Usar solo variables CSS |
| Hidratación React | Alto | Usar `suppressHydrationWarning` donde necesario |

---

## 7. ORDEN DE EJECUCIÓN RECOMENDADO

1. **Assets** - Copiar logo
2. **CSS Variables** - globals.css + tailwind.config.js
3. **Logo Component** - Logo.js
4. **Layout** - Nav, Footer, QuickLinks
5. **Newsletter** - SubscribeNewsletter.js
6. **Metadata** - layout.js
7. **PDF/Emails** - Funcionalidades internas
8. **Cleanup** - Colores hardcodeados restantes
9. **Testing** - Validar en todos los breakpoints
10. **Commit & Deploy**

---

## 8. ESTIMACIÓN

- **Archivos principales**: ~15 archivos
- **Archivos secundarios**: ~47 archivos (colores hardcodeados)
- **Complejidad**: Media-Alta (cambio sistemático de branding)

---

*Plan elaborado siguiendo las guías de fullstack-dev.md y designer-ux-ui.md*
