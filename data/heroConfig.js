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
      headline: "Venezuela The Last Best Kept Secret in the Caribbean.",
      subtitle: "We design signature itineraries in the most exclusive destinations in Venezuela",
      cta: null, // TBD en HU-004
      language: "en",
      targetAudience: "international",
      angle: "exclusivity-mystery",
      description: "Sparks curiosity and a sense of exclusivity; avoids mass tourism"
    },
    "adventure-paradise": {
      headline: "Discover Venezuela: Where Adventure Meets Paradise.",
      subtitle: null,
      cta: null,
      language: "en",
      targetAudience: "international",
      angle: "adventure",
      description: "Focus on adventure and a paradise destination"
    },
    "untold-stories": {
      headline: "Venezuela: A Story Waiting to Be Told.",
      subtitle: null,
      cta: null,
      language: "en",
      targetAudience: "international",
      angle: "storytelling",
      description: "Appeals to travellers looking for stories to tell"
    },
    "hidden-gem": {
      headline: "Venezuela: The Caribbean's Best Hidden Gem Awaits You.",
      subtitle: null,
      cta: null,
      language: "en",
      targetAudience: "international",
      angle: "discovery",
      description: "Emphasises the discovery of a hidden treasure"
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
