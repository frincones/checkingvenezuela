/**
 * Cintillo naranja, sobre la barra de navegación en todas las páginas.
 *
 * Enlace DIRECTO a WhatsApp: un clic abre el chat con el mensaje ya escrito,
 * sin formulario de por medio.
 *
 * Esto es deliberado y no debe cambiarse sin consultarlo. En octubre se migró
 * este cintillo al modal de solicitud junto con los otros seis puntos de
 * contacto del sitio, y fue un error: dejó de llevar a WhatsApp pese a que su
 * texto lo promete, y pasó a abrir el mismo formulario que el cintillo azul de
 * correo que tiene justo debajo. Dos franjas distintas haciendo lo mismo, y la
 * naranja ofreciendo algo que no entregaba.
 *
 * La separación es intencionada:
 *   naranja -> WhatsApp directo, para quien ya quiere hablar ahora
 *   azul    -> formulario con copia al cliente, para quien prefiere escribir
 *
 * No usa `useLeadCapture`. Ese hook abre el modal, que es justo lo que aquí no
 * se quiere. Los otros seis puntos de contacto sí lo necesitan y siguen
 * usándolo sin cambios.
 *
 * Montado desde app/layout.js, así que un fallo aquí se ve en todo el sitio.
 *
 * Sin "use client": al no tener estado ni manejadores, se renderiza en el
 * servidor y no añade JavaScript al bundle de ninguna página.
 */

const WHATSAPP_NUMBER = "584264034052";

const ANNOUNCEMENT_TEXT = "BOOK NOW VIA OUR WHATSAPP, WE ARE AVAILABLE 24/7";
const WHATSAPP_PREFILLED =
  "Hi, I'd like to book a signature travel experience in Venezuela.";

const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_PREFILLED,
)}`;

export function AnnouncementBar() {
  return (
    // Un <a> en vez de un <button> con window.open: el navegador lo trata como
    // navegación iniciada por el usuario, así que ningún bloqueador de ventanas
    // emergentes lo detiene. Además permite abrirlo en otra pestaña con el
    // botón central o copiar el enlace, cosas que un botón no da.
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open WhatsApp to book a signature travel experience"
      className="block w-full bg-orange-500 px-4 py-2 text-center text-xs font-semibold tracking-wide text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 sm:text-sm"
    >
      {ANNOUNCEMENT_TEXT}
    </a>
  );
}
