/**
 * Texto de consentimiento de tratamiento de datos personales (GDPR-style + LOPD VE).
 * Versionado para auditoría.
 */

export const CONSENT_TEXT_VERSION = "1.0";

export const CONSENT_TEXT = {
  es: {
    version: "1.0",
    title: "Autorización de tratamiento de datos",
    body: `Para que un asesor de Venezuela Voyages pueda contactarte, necesitamos guardar tu nombre, email y teléfono.
Tus datos serán usados ÚNICAMENTE para gestionar tu solicitud de viaje y enviarte información relacionada.

Puedes solicitar la eliminación de tus datos en cualquier momento escribiendo a privacidad@venezuelavoyages.com.

Al aceptar declaras que eres mayor de edad y autorizas el tratamiento de tus datos según nuestra
Política de Privacidad.`,
    accept: "Acepto y deseo ser contactado",
    decline: "No, gracias",
  },
  en: {
    version: "1.0",
    title: "Personal data processing consent",
    body: `For a Venezuela Voyages advisor to contact you, we need to store your name, email and phone.
Your data will be used ONLY to handle your travel request and send you related information.

You can request deletion of your data at any time by writing to privacy@venezuelavoyages.com.

By accepting you declare you are of legal age and authorize the processing of your data according
to our Privacy Policy.`,
    accept: "I accept and want to be contacted",
    decline: "No, thanks",
  },
};

export function getConsentText(language = "es") {
  return CONSENT_TEXT[language] || CONSENT_TEXT.es;
}
