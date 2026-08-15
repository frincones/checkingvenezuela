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
      name: "Beach Destinations",
      subtitle: "Premium & Relaxation",
      icon: "Umbrella",
      destinations: [
        {
          id: "los-roques",
          name: "Los Roques Archipelago",
          shortName: "Los Roques",
          description:
            "The luxury destination par excellence. Its crystal-clear waters and white sands are compared to the Maldives. Ideal for travellers seeking exclusivity, diving and kitesurfing.",
          image: "https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?q=80&w=1974&auto=format&fit=crop",
          tags: ["Luxury", "Diving", "Kitesurf"],
          highlights: ["Crystal-clear waters", "White sands", "Exclusivity"],
        },
        {
          id: "margarita",
          name: "Margarita Island",
          shortName: "Margarita",
          description:
            "Perfect for its infrastructure. It offers everything from all-inclusive hotels and duty-free shopping to iconic beaches such as Playa El Yaque (world famous for windsurfing) and Playa El Agua.",
          image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop",
          tags: ["All Inclusive", "Shopping", "Windsurf"],
          highlights: ["Duty-free port", "Playa El Yaque", "Playa El Agua"],
        },
        {
          id: "morrocoy",
          name: "Morrocoy National Park",
          shortName: "Morrocoy",
          description:
            "Its cays (such as Cayo Sombrero) offer a 'natural pool' experience in the sea that delights anyone looking for classic Caribbean scenery.",
          image: "https://images.unsplash.com/photo-1559494007-9f5847c49d94?q=80&w=1974&auto=format&fit=crop",
          tags: ["Cays", "Nature", "Caribbean"],
          highlights: ["Cayo Sombrero", "Natural pools", "Caribbean landscapes"],
        },
      ],
    },
    {
      id: "adventure",
      name: "Adventure & Wild Nature",
      subtitle: "Unique experiences",
      icon: "Mountain",
      destinations: [
        {
          id: "canaima",
          name: "Canaima National Park",
          shortName: "Canaima",
          description:
            "The crown jewel. No visitor wants to leave without seeing the world's tallest waterfall (979 metres). It is an adventure trip that includes river travel by curiara canoe and a night in hammocks facing the falls.",
          image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2070&auto=format&fit=crop",
          tags: ["Angel Falls", "Adventure", "UNESCO"],
          highlights: ["Angel Falls (979m)", "Curiara canoe journey", "Overnight in hammocks"],
        },
        {
          id: "roraima",
          name: "Mount Roraima",
          shortName: "Roraima",
          description:
            "A world-class trekking destination. Hiking enthusiasts seek out this ancient formation (tepui) that inspired stories such as 'The Lost World'.",
          image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop",
          tags: ["Trekking", "Tepui", "Expedition"],
          highlights: ["World-class trekking", "Ancient tepui", "The Lost World"],
        },
        {
          id: "los-llanos",
          name: "Los Llanos",
          shortName: "Los Llanos",
          description:
            "Ideal for the 'Venezuelan Safari'. It is the best place for wildlife spotting (anacondas, caimans, capybaras and hundreds of birds).",
          image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=2068&auto=format&fit=crop",
          tags: ["Safari", "Wildlife", "Nature"],
          highlights: ["Venezuelan safari", "Anacondas", "Caimans", "Capybaras"],
        },
      ],
    },
    {
      id: "culture",
      name: "Culture & Mountains",
      subtitle: "Tradition and landscapes",
      icon: "Church",
      destinations: [
        {
          id: "merida",
          name: "Mérida & the Sierra Nevada",
          shortName: "Mérida",
          description:
            "Home to the world's highest and longest cable car (Mukumbarí). The favourite destination for those seeking colonial villages, cool weather and Andean landscapes.",
          image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2070&auto=format&fit=crop",
          tags: ["Cable car", "Andes", "Colonial"],
          highlights: ["Mukumbarí", "Colonial villages", "Andean landscapes"],
        },
        {
          id: "colonia-tovar",
          name: "Colonia Tovar",
          shortName: "Colonia Tovar",
          description:
            "A slice of Germany in the tropics. Its European architecture and cuisine, just an hour from Caracas, never fails to surprise visitors.",
          image: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2070&auto=format&fit=crop",
          tags: ["German", "Cuisine", "Architecture"],
          highlights: ["German architecture", "European cuisine", "Close to Caracas"],
        },
      ],
    },
    {
      id: "phenomena",
      name: "Unique Phenomena",
      subtitle: "Natural wonders",
      icon: "Zap",
      destinations: [
        {
          id: "catatumbo",
          name: "Catatumbo Lightning",
          shortName: "Catatumbo",
          description:
            "The place with the most lightning strikes per square kilometre per year in the world. A unique natural spectacle for photographers and scientists.",
          image: "https://images.unsplash.com/photo-1461511669078-d46bf351cd6e?q=80&w=2070&auto=format&fit=crop",
          tags: ["Lightning", "Unique", "Photography"],
          highlights: ["World lightning record", "Unique phenomenon", "Photography"],
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
