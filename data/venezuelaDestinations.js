/**
 * Destinos de Venezuela - CHECK-IN VENEZUELA
 *
 * Contenido exacto según especificación HU-003
 * Agrupado por categorías temáticas
 */

export const venezuelaDestinations = {
  // Categorías de destinos
  categories: [
    {
      id: "beach",
      name: "Destinos de Playa",
      subtitle: "Premium y Relax",
      icon: "Umbrella",
      destinations: [
        {
          id: "los-roques",
          name: "Archipiélago Los Roques",
          shortName: "Los Roques",
          description:
            "Es el destino de lujo por excelencia. Sus aguas cristalinas y arenas blancas son comparadas con las Maldivas. Es ideal para extranjeros que buscan exclusividad, buceo y kitesurf.",
          image: "https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?q=80&w=1974&auto=format&fit=crop",
          tags: ["Lujo", "Buceo", "Kitesurf"],
          highlights: ["Aguas cristalinas", "Arenas blancas", "Exclusividad"],
        },
        {
          id: "margarita",
          name: "Isla de Margarita",
          shortName: "Margarita",
          description:
            "Perfecta por su infraestructura. Ofrece desde hoteles todo incluido y compras (puerto libre) hasta playas icónicas como Playa El Yaque (famosa mundialmente para windsurf) y Playa El Agua.",
          image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop",
          tags: ["Todo Incluido", "Compras", "Windsurf"],
          highlights: ["Puerto libre", "Playa El Yaque", "Playa El Agua"],
        },
        {
          id: "morrocoy",
          name: "Parque Nacional Morrocoy",
          shortName: "Morrocoy",
          description:
            "Sus cayos (como Cayo Sombrero) ofrecen una experiencia de 'piscina natural' en el mar que encanta a quienes buscan paisajes caribeños clásicos.",
          image: "https://images.unsplash.com/photo-1559494007-9f5847c49d94?q=80&w=1974&auto=format&fit=crop",
          tags: ["Cayos", "Naturaleza", "Caribe"],
          highlights: ["Cayo Sombrero", "Piscinas naturales", "Paisajes caribeños"],
        },
      ],
    },
    {
      id: "adventure",
      name: "Aventura y Naturaleza Salvaje",
      subtitle: "Experiencias únicas",
      icon: "Mountain",
      destinations: [
        {
          id: "canaima",
          name: "Parque Nacional Canaima",
          shortName: "Canaima",
          description:
            "Es la joya de la corona. Ningún extranjero quiere irse sin ver la caída de agua más alta del mundo (979 metros). Es un viaje de aventura que incluye navegación en curiara y pernocta en hamacas frente al salto.",
          image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2070&auto=format&fit=crop",
          tags: ["Salto Ángel", "Aventura", "UNESCO"],
          highlights: ["Salto Ángel (979m)", "Navegación en curiara", "Pernocta en hamacas"],
        },
        {
          id: "roraima",
          name: "Monte Roraima",
          shortName: "Roraima",
          description:
            "Un destino de trekking de clase mundial. Los extranjeros amantes del senderismo buscan esta formación milenaria (tepuy) que inspiró historias como 'El Mundo Perdido'.",
          image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop",
          tags: ["Trekking", "Tepuy", "Expedición"],
          highlights: ["Trekking clase mundial", "Tepuy milenario", "El Mundo Perdido"],
        },
        {
          id: "los-llanos",
          name: "Los Llanos",
          shortName: "Los Llanos",
          description:
            "Ideal para el 'Safari Venezolano'. Es el mejor lugar para el avistamiento de fauna (anacondas, caimanes, chigüires y cientos de aves).",
          image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=2068&auto=format&fit=crop",
          tags: ["Safari", "Fauna", "Naturaleza"],
          highlights: ["Safari venezolano", "Anacondas", "Caimanes", "Chigüires"],
        },
      ],
    },
    {
      id: "culture",
      name: "Cultura y Montaña",
      subtitle: "Tradición y paisajes",
      icon: "Church",
      destinations: [
        {
          id: "merida",
          name: "Mérida y la Sierra Nevada",
          shortName: "Mérida",
          description:
            "Ofrece el teleférico más alto y largo del mundo (Mukumbarí). Es el destino preferido para quienes buscan pueblos coloniales, clima frío y paisajes andinos.",
          image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2070&auto=format&fit=crop",
          tags: ["Teleférico", "Andes", "Colonial"],
          highlights: ["Mukumbarí", "Pueblos coloniales", "Paisajes andinos"],
        },
        {
          id: "colonia-tovar",
          name: "Colonia Tovar",
          shortName: "Colonia Tovar",
          description:
            "Un pedazo de Alemania en el trópico. Su arquitectura y gastronomía europea a solo una hora de Caracas siempre sorprende a los visitantes.",
          image: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2070&auto=format&fit=crop",
          tags: ["Alemán", "Gastronomía", "Arquitectura"],
          highlights: ["Arquitectura alemana", "Gastronomía europea", "Cerca de Caracas"],
        },
      ],
    },
    {
      id: "phenomena",
      name: "Fenómenos Únicos",
      subtitle: "Maravillas naturales",
      icon: "Zap",
      destinations: [
        {
          id: "catatumbo",
          name: "Relámpago del Catatumbo",
          shortName: "Catatumbo",
          description:
            "El lugar con más relámpagos por kilómetro cuadrado al año en el mundo. Un espectáculo natural único para fotógrafos y científicos.",
          image: "https://images.unsplash.com/photo-1461511669078-d46bf351cd6e?q=80&w=2070&auto=format&fit=crop",
          tags: ["Relámpagos", "Único", "Fotografía"],
          highlights: ["Récord mundial de relámpagos", "Fenómeno único", "Fotografía"],
        },
      ],
    },
  ],
};

/**
 * Obtiene todos los destinos de Venezuela en formato plano
 */
export const getAllVenezuelaDestinations = () => {
  return venezuelaDestinations.categories.flatMap((cat) =>
    cat.destinations.map((dest) => ({
      ...dest,
      category: cat.name,
      categoryId: cat.id,
    }))
  );
};

/**
 * Obtiene destinos por categoría
 */
export const getDestinationsByCategory = (categoryId) => {
  const category = venezuelaDestinations.categories.find(
    (cat) => cat.id === categoryId
  );
  return category ? category.destinations : [];
};

export default venezuelaDestinations;
