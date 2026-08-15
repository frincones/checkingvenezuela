/**
 * Configuración del Catálogo de Servicios - VENEZUELA VOYAGES
 *
 * Todos los servicios tienen:
 * - Comprar online (o flujo definido si pagos no están listos)
 * - Cotizar con asesor (WhatsApp)
 *
 * NOTA: Este archivo contiene datos estáticos de fallback.
 * Los componentes ahora pueden obtener datos de la BD usando lib/cms.js
 */

export const servicesConfig = {
  // Servicios disponibles
  services: [
    {
      id: "flights",
      name: "Flights",
      description: "Find the best domestic and international flights",
      icon: "Plane",
      enabled: true,
      hasOnlinePurchase: true,
      hasQuoteRequest: true,
      href: "/flights",
      comingSoon: false,
    },
    {
      id: "hotels",
      name: "Hotels",
      description: "Book accommodation in the best destinations",
      icon: "Building2",
      enabled: true,
      hasOnlinePurchase: true,
      hasQuoteRequest: true,
      href: "/hotels",
      comingSoon: false,
    },
    {
      id: "packages",
      name: "Packages",
      description: "Flight + hotel at the best combined prices",
      icon: "Package",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "tours",
      name: "Tours & Activities",
      description: "Unique experiences in every destination",
      icon: "Compass",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "transfers",
      name: "Transfers",
      description: "Safe airport-hotel transport and more",
      icon: "Car",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "insurance",
      name: "Travel Insurance",
      description: "Travel protected with full coverage",
      icon: "Shield",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "car-rental",
      name: "Car Rental",
      description: "Freedom to explore at your own pace",
      icon: "CarFront",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "cruises",
      name: "Cruises",
      description: "All-inclusive adventures on the high seas",
      icon: "Ship",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "corporate",
      name: "Corporate Travel",
      description: "Travel solutions for businesses",
      icon: "Briefcase",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "all-inclusive",
      name: "All Inclusive",
      description: "Premium worry-free packages",
      icon: "Sparkles",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
  ],

  // Configuración de contacto para cotizaciones
  whatsapp: {
    number: "584264034052",
    defaultMessage: "Hi, I'm interested in getting a quote for a travel service.",
  },
};

/**
 * Obtiene todos los servicios habilitados
 */
export const getEnabledServices = () => {
  return servicesConfig.services.filter((service) => service.enabled);
};

/**
 * Obtiene servicios activos (no "próximamente")
 */
export const getActiveServices = () => {
  return servicesConfig.services.filter(
    (service) => service.enabled && !service.comingSoon
  );
};

/**
 * Genera URL de WhatsApp para cotización
 */
export const getWhatsAppQuoteUrl = (serviceName = "") => {
  const message = serviceName
    ? `Hi, I'd like a quote for: ${serviceName}`
    : servicesConfig.whatsapp.defaultMessage;
  return `https://wa.me/${servicesConfig.whatsapp.number}?text=${encodeURIComponent(message)}`;
};

export default servicesConfig;
