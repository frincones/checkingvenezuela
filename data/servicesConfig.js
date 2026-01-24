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
      name: "Vuelos",
      description: "Encuentra los mejores vuelos nacionales e internacionales",
      icon: "Plane",
      enabled: true,
      hasOnlinePurchase: true,
      hasQuoteRequest: true,
      href: "/flights",
      comingSoon: false,
    },
    {
      id: "hotels",
      name: "Hoteles",
      description: "Reserva alojamiento en los mejores destinos",
      icon: "Building2",
      enabled: true,
      hasOnlinePurchase: true,
      hasQuoteRequest: true,
      href: "/hotels",
      comingSoon: false,
    },
    {
      id: "packages",
      name: "Paquetes",
      description: "Vuelo + hotel con los mejores precios combinados",
      icon: "Package",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "tours",
      name: "Tours y Actividades",
      description: "Experiencias únicas en cada destino",
      icon: "Compass",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "transfers",
      name: "Traslados",
      description: "Transporte seguro aeropuerto-hotel y más",
      icon: "Car",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "insurance",
      name: "Seguro de Viaje",
      description: "Viaja protegido con cobertura completa",
      icon: "Shield",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "car-rental",
      name: "Alquiler de Autos",
      description: "Libertad para explorar a tu ritmo",
      icon: "CarFront",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "cruises",
      name: "Cruceros",
      description: "Aventuras en altamar con todo incluido",
      icon: "Ship",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "corporate",
      name: "Plan Corporativo",
      description: "Soluciones de viaje para empresas",
      icon: "Briefcase",
      enabled: true,
      hasOnlinePurchase: false,
      hasQuoteRequest: true,
      href: "#",
      comingSoon: true,
    },
    {
      id: "all-inclusive",
      name: "Todo Incluido",
      description: "Paquetes premium sin preocupaciones",
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
    defaultMessage: "Hola, estoy interesado en cotizar un servicio de viaje.",
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
    ? `Hola, estoy interesado en cotizar: ${serviceName}`
    : servicesConfig.whatsapp.defaultMessage;
  return `https://wa.me/${servicesConfig.whatsapp.number}?text=${encodeURIComponent(message)}`;
};

export default servicesConfig;
