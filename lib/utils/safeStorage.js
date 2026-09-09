/**
 * Acceso tolerante a fallos a localStorage / sessionStorage.
 *
 * Por qué existe
 * --------------
 * El almacenamiento de sitio no siempre está disponible, y cuando no lo está
 * NO se comporta como un objeto vacío: según el navegador y la configuración,
 * `window.localStorage` puede ser `null`, o existir pero lanzar `SecurityError`
 * o `QuotaExceededError` al leer o escribir. Pasa con las cookies de sitio
 * bloqueadas por política corporativa, en modos de privacidad estrictos, dentro
 * de un iframe de terceros y con algunas extensiones.
 *
 * Eso convirtió una línea del footer en una caída de página completa: el
 * bloque de newsletter hacía `localStorage.getItem("subscribed")` sin
 * protección, y con el almacenamiento bloqueado lanzaba
 *
 *   TypeError: Cannot read properties of null (reading 'getItem')
 *
 * Como el proyecto tiene un único error boundary y está en la raíz
 * (`app/error.js`), esa excepción no degradaba el footer: sustituía la página
 * entera por "Something went wrong". Se detectó porque una usuaria con un
 * equipo corporativo lo veía en páginas que para el resto cargaban bien.
 *
 * Cómo usarlo
 * -----------
 * Estas funciones NUNCA lanzan. Si el almacenamiento no está disponible, leer
 * devuelve `null` y escribir devuelve `false`. Eso obliga a que la ausencia de
 * almacenamiento sea un caso normal en la UI —un visitante que no recuerda su
 * estado— en lugar de un error.
 *
 * Solo para código de cliente: en el servidor no hay `window` y todas las
 * funciones devuelven el valor de fallo.
 */

function getStore(kind) {
  // `typeof window` primero: en SSR ni siquiera existe el objeto global.
  if (typeof window === "undefined") return null;
  try {
    // El acceso a la propiedad ya puede lanzar, no solo los métodos.
    const store = kind === "session" ? window.sessionStorage : window.localStorage;
    if (!store) return null;
    return store;
  } catch {
    return null;
  }
}

/** Lee una clave. Devuelve `null` si no existe o si no hay almacenamiento. */
export function readStorage(key, { session = false } = {}) {
  const store = getStore(session ? "session" : "local");
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

/** Escribe una clave. Devuelve `true` solo si se persistió de verdad. */
export function writeStorage(key, value, { session = false } = {}) {
  const store = getStore(session ? "session" : "local");
  if (!store) return false;
  try {
    store.setItem(key, String(value));
    return true;
  } catch {
    // Cuota agotada o escritura denegada. No es un fallo de la aplicación.
    return false;
  }
}

/** Borra una clave. Devuelve `true` solo si se borró de verdad. */
export function removeStorage(key, { session = false } = {}) {
  const store = getStore(session ? "session" : "local");
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lee y parsea JSON. Devuelve `fallback` si no hay valor, si no hay
 * almacenamiento o si el contenido guardado está corrupto —que ocurre cuando
 * cambia la forma de los datos entre despliegues.
 */
export function readStorageJSON(key, fallback = null, { session = false } = {}) {
  const raw = readStorage(key, { session });
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Serializa y escribe JSON. Devuelve `true` solo si se persistió. */
export function writeStorageJSON(key, value, { session = false } = {}) {
  try {
    return writeStorage(key, JSON.stringify(value), { session });
  } catch {
    // Referencias circulares u objetos no serializables.
    return false;
  }
}

/** `true` si el almacenamiento está disponible para lectura y escritura. */
export function isStorageAvailable({ session = false } = {}) {
  const store = getStore(session ? "session" : "local");
  if (!store) return false;
  try {
    const probe = "__vv_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
