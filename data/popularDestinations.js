/**
 * Destinos Populares - CHECK-IN VENEZUELA
 *
 * 10 destinos de vuelos internacionales + 10 destinos de hoteles
 * Datos estáticos para MVP (no dependen de BD)
 */

// 10 Destinos Populares de Vuelos (Internacionales)
export const flightDestinations = [
  {
    id: "cancun",
    name: "Cancún",
    country: "Mexico",
    type: "flight",
    description: "Paradise beaches on the Mexican Caribbean",
    image: "https://images.unsplash.com/photo-1510097467424-192d713fd8b2?q=80&w=2071&auto=format&fit=crop",
    iataCode: "CUN",
  },
  {
    id: "punta-cana",
    name: "Punta Cana",
    country: "Dominican Republic",
    type: "flight",
    description: "All-inclusive resorts in the Caribbean",
    image: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=2070&auto=format&fit=crop",
    iataCode: "PUJ",
  },
  {
    id: "miami",
    name: "Miami",
    country: "United States",
    type: "flight",
    description: "Florida's gateway to the sun",
    image: "https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?q=80&w=2070&auto=format&fit=crop",
    iataCode: "MIA",
  },
  {
    id: "madrid",
    name: "Madrid",
    country: "Spain",
    type: "flight",
    description: "Spain's cultural capital",
    image: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?q=80&w=2070&auto=format&fit=crop",
    iataCode: "MAD",
  },
  {
    id: "panama",
    name: "Panama City",
    country: "Panama",
    type: "flight",
    description: "Hub of the Americas and the famous Canal",
    image: "https://images.unsplash.com/photo-1555952494-efd681c7e3f9?q=80&w=2070&auto=format&fit=crop",
    iataCode: "PTY",
  },
  {
    id: "bogota",
    name: "Bogotá",
    country: "Colombia",
    type: "flight",
    description: "Colombia's vibrant capital",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=2070&auto=format&fit=crop",
    iataCode: "BOG",
  },
  {
    id: "buenos-aires",
    name: "Buenos Aires",
    country: "Argentina",
    type: "flight",
    description: "The Paris of South America",
    image: "https://images.unsplash.com/photo-1612294037637-ec328d0e075e?q=80&w=2070&auto=format&fit=crop",
    iataCode: "EZE",
  },
  {
    id: "lima",
    name: "Lima",
    country: "Peru",
    type: "flight",
    description: "The gastronomic capital of the Americas",
    image: "https://images.unsplash.com/photo-1531968455001-5c5272a41129?q=80&w=2070&auto=format&fit=crop",
    iataCode: "LIM",
  },
  {
    id: "new-york",
    name: "New York",
    country: "United States",
    type: "flight",
    description: "The city that never sleeps",
    image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=2070&auto=format&fit=crop",
    iataCode: "JFK",
  },
  {
    id: "cartagena",
    name: "Cartagena",
    country: "Colombia",
    type: "flight",
    description: "The walled city of the Caribbean",
    image: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?q=80&w=2070&auto=format&fit=crop",
    iataCode: "CTG",
  },
];

// 10 Destinos Populares de Hoteles
export const hotelDestinations = [
  {
    id: "los-roques-hotel",
    name: "Los Roques",
    country: "Venezuela",
    type: "hotel",
    description: "Luxury inns in a Caribbean paradise",
    image: "https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?q=80&w=1974&auto=format&fit=crop",
    category: "Resort",
  },
  {
    id: "margarita-hotel",
    name: "Margarita Island",
    country: "Venezuela",
    type: "hotel",
    description: "All-inclusive beachfront hotels",
    image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070&auto=format&fit=crop",
    category: "Todo Incluido",
  },
  {
    id: "canaima-hotel",
    name: "Canaima",
    country: "Venezuela",
    type: "hotel",
    description: "Adventure lodges beside Angel Falls",
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2070&auto=format&fit=crop",
    category: "Lodge",
  },
  {
    id: "merida-hotel",
    name: "Mérida",
    country: "Venezuela",
    type: "hotel",
    description: "Hotels with views over the Andes",
    image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2070&auto=format&fit=crop",
    category: "Boutique",
  },
  {
    id: "cartagena-hotel",
    name: "Cartagena",
    country: "Colombia",
    type: "hotel",
    description: "Boutique hotels in the walled city",
    image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=2070&auto=format&fit=crop",
    category: "Boutique",
  },
  {
    id: "santa-marta-hotel",
    name: "Santa Marta",
    country: "Colombia",
    type: "hotel",
    description: "Resorts facing Caribbean beaches",
    image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2025&auto=format&fit=crop",
    category: "Resort",
  },
  {
    id: "cancun-hotel",
    name: "Cancún",
    country: "Mexico",
    type: "hotel",
    description: "Luxury resorts on the Riviera Maya",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070&auto=format&fit=crop",
    category: "Lujo",
  },
  {
    id: "punta-cana-hotel",
    name: "Punta Cana",
    country: "Dominican Republic",
    type: "hotel",
    description: "All inclusive with dream beaches",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=2080&auto=format&fit=crop",
    category: "Todo Incluido",
  },
  {
    id: "miami-hotel",
    name: "Miami Beach",
    country: "United States",
    type: "hotel",
    description: "Iconic hotels in South Beach",
    image: "https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?q=80&w=2070&auto=format&fit=crop",
    category: "Urbano",
  },
  {
    id: "panama-hotel",
    name: "Panama City",
    country: "Panama",
    type: "hotel",
    description: "Modern hotels with skyline views",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?q=80&w=2089&auto=format&fit=crop",
    category: "Business",
  },
];

/**
 * Obtiene todos los destinos de vuelos
 */
export const getFlightDestinations = () => flightDestinations;

/**
 * Obtiene todos los destinos de hoteles
 */
export const getHotelDestinations = () => hotelDestinations;

/**
 * Obtiene todos los destinos combinados
 */
export const getAllDestinations = () => [...flightDestinations, ...hotelDestinations];

export default { flightDestinations, hotelDestinations };
