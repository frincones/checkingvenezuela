/**
 * Hero Section Configuration
 *
 * Este archivo centraliza la configuración del headline del Hero.
 * Permite cambiar el mensaje principal sin modificar la UI.
 *
 * Para cambiar el headline activo, simplemente modifica el valor de `active`
 * al key de la variante deseada.
 */

export const heroConfig = {
  // Headline activo (cambiar este valor para usar otra variante)
  active: "caribbean-secret",

  // Variantes disponibles de headlines
  variants: {
    "caribbean-secret": {
      headline: "Venezuela: The Last Best Kept Secret in the Caribbean.",
      subtitle: null, // TBD en HU-003
      cta: null, // TBD en HU-004
      language: "en",
      targetAudience: "international",
      angle: "exclusivity-mystery",
      description: "Genera curiosidad y sensación de exclusividad; evita turismo masivo"
    },
    "adventure-paradise": {
      headline: "Discover Venezuela: Where Adventure Meets Paradise.",
      subtitle: null,
      cta: null,
      language: "en",
      targetAudience: "international",
      angle: "adventure",
      description: "Enfoque en aventura y destino paradisíaco"
    },
    "untold-stories": {
      headline: "Venezuela: A Story Waiting to Be Told.",
      subtitle: null,
      cta: null,
      language: "en",
      targetAudience: "international",
      angle: "storytelling",
      description: "Apela a viajeros que buscan historias que contar"
    },
    "hidden-gem": {
      headline: "Venezuela: The Caribbean's Best Hidden Gem Awaits You.",
      subtitle: null,
      cta: null,
      language: "en",
      targetAudience: "international",
      angle: "discovery",
      description: "Enfatiza el descubrimiento de un tesoro oculto"
    }
  }
};

/**
 * Obtiene la configuración del headline activo
 * @returns {Object} Configuración del headline activo
 */
export const getActiveHeroContent = () => {
  return heroConfig.variants[heroConfig.active];
};

/**
 * Obtiene solo el texto del headline activo
 * @returns {string} Texto del headline
 */
export const getActiveHeadline = () => {
  return heroConfig.variants[heroConfig.active]?.headline || "";
};

export default heroConfig;
