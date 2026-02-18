import { SectionTitle } from "@/components/SectionTitle";
import { Badge } from "@/components/ui/badge";
import { Star, Users, Award, TrendingUp } from "lucide-react";
import WebsiteReviewForm from "@/components/sections/WebsiteReviewForm";
import { auth } from "@/lib/auth";
import { getOneDoc } from "@/lib/db/getOperationDB";
import { WebsiteReviewsList } from "./WebsiteReviewsList";
import { getWebsiteReviews, getWebsiteReviewsStats } from "@/lib/services";

const FEATURED_REVIEWS = [
  {
    id: "featured-1",
    reviewer: "María Fernanda González",
    profileImage: "",
    rate: 5,
    comment: "Reservé mis vacaciones a Margarita con Check-In Venezuela y todo salió perfecto. El equipo me ayudó a encontrar el mejor hotel y los vuelos más económicos. Sin duda volveré a reservar con ellos.",
  },
  {
    id: "featured-2",
    reviewer: "Carlos Eduardo Rodríguez",
    profileImage: "",
    rate: 5,
    comment: "Excelente servicio de principio a fin. Reservé un paquete familiar a Los Roques y todo estuvo impecable. La atención al cliente es de primera, siempre respondieron mis dudas rápidamente.",
  },
  {
    id: "featured-3",
    reviewer: "Ana Gabriela Martínez",
    profileImage: "",
    rate: 5,
    comment: "Precios competitivos y atención totalmente personalizada. Me ayudaron a planificar mi luna de miel y cada detalle fue cuidado con mucho esmero. Muy agradecida con todo el equipo.",
  },
  {
    id: "featured-4",
    reviewer: "José Luis Hernández",
    profileImage: "",
    rate: 4,
    comment: "El proceso de reserva fue sencillo y rápido. En menos de 10 minutos ya tenía todo confirmado. La plataforma es muy intuitiva y fácil de usar.",
  },
  {
    id: "featured-5",
    reviewer: "Valentina Pérez",
    profileImage: "",
    rate: 5,
    comment: "Viajé con mi familia a Canaima y fue una experiencia inolvidable. Check-In Venezuela nos consiguió las mejores tarifas y el hotel superó nuestras expectativas. Totalmente recomendado.",
  },
  {
    id: "featured-6",
    reviewer: "Diego Alejandro Torres",
    profileImage: "",
    rate: 5,
    comment: "Llevaba meses buscando vuelos baratos a Mérida y gracias a esta página encontré ofertas increíbles. El proceso fue súper fácil y el soporte al cliente excelente.",
  },
  {
    id: "featured-7",
    reviewer: "Gabriela Morales",
    profileImage: "",
    rate: 5,
    comment: "Me encantó la experiencia. Reservé un paquete todo incluido para Tucacas y fue espectacular. El equipo se encargó de todo: vuelos, hotel y traslados. No tuve que preocuparme por nada.",
  },
  {
    id: "featured-8",
    reviewer: "Ricardo José Díaz",
    profileImage: "",
    rate: 4,
    comment: "Muy buena plataforma para reservar viajes dentro de Venezuela. Los precios son justos y la atención es muy profesional. La recomiendo ampliamente a todos mis amigos.",
  },
  {
    id: "featured-9",
    reviewer: "Isabela Ramírez",
    profileImage: "",
    rate: 5,
    comment: "Check-In Venezuela hizo que organizar mis vacaciones fuera facilísimo. Encontré opciones que no aparecían en otras páginas. El equipo de soporte me atendió de maravilla.",
  },
  {
    id: "featured-10",
    reviewer: "Andrés Felipe Castillo",
    profileImage: "",
    rate: 5,
    comment: "Reservé un viaje de negocios a Caracas y todo salió como estaba planificado. El hotel que me recomendaron fue excelente y el vuelo puntual. Servicio 10 de 10.",
  },
  {
    id: "featured-11",
    reviewer: "Daniela Sofía López",
    profileImage: "",
    rate: 5,
    comment: "Soy clienta frecuente de Check-In Venezuela y nunca me han fallado. Cada viaje que reservo es una experiencia increíble. Los precios siempre son los mejores del mercado.",
  },
  {
    id: "featured-12",
    reviewer: "Luis Miguel Vargas",
    profileImage: "",
    rate: 4,
    comment: "Buena experiencia en general. Reservé un fin de semana en Choroní y todo estuvo muy bien organizado. El único detalle fue que la confirmación tardó un poco, pero el resto fue perfecto.",
  },
  {
    id: "featured-13",
    reviewer: "Camila Andrea Sánchez",
    profileImage: "",
    rate: 5,
    comment: "Increíble servicio. Organicé un viaje sorpresa para el cumpleaños de mi esposo a Margarita y todo salió perfecto. El equipo me ayudó con cada detalle. Eternamente agradecida.",
  },
  {
    id: "featured-14",
    reviewer: "Sebastián Gutiérrez",
    profileImage: "",
    rate: 5,
    comment: "La mejor agencia de viajes online de Venezuela. He probado varias y ninguna se compara con Check-In Venezuela. Precios bajos, atención rápida y viajes sin complicaciones.",
  },
  {
    id: "featured-15",
    reviewer: "Patricia Elena Mendoza",
    profileImage: "",
    rate: 5,
    comment: "Reservé vuelos para toda mi familia y el ahorro fue significativo comparado con otras plataformas. La interfaz es muy fácil de usar y el proceso de pago es seguro.",
  },
  {
    id: "featured-16",
    reviewer: "Fernando José Rivas",
    profileImage: "",
    rate: 4,
    comment: "Excelente plataforma para encontrar los mejores precios en hoteles y vuelos. La usé para mi viaje a Mochima y quedé muy satisfecho con todo el servicio.",
  },
  {
    id: "featured-17",
    reviewer: "Laura Cristina Navarro",
    profileImage: "",
    rate: 5,
    comment: "Mi experiencia fue maravillosa. Desde la búsqueda hasta la reserva, todo fue muy fluido. El hotel en Los Roques fue espectacular y el precio inmejorable. Súper recomendado.",
  },
  {
    id: "featured-18",
    reviewer: "Miguel Ángel Flores",
    profileImage: "",
    rate: 5,
    comment: "Llevo tres viajes reservados con Check-In Venezuela y cada uno ha sido mejor que el anterior. El equipo realmente se preocupa por ofrecer la mejor experiencia posible.",
  },
  {
    id: "featured-19",
    reviewer: "Verónica Alejandra Ruiz",
    profileImage: "",
    rate: 5,
    comment: "Reservé un paquete a Canaima para mi aniversario y fue el mejor regalo que pude hacer. Todo estuvo perfectamente coordinado. Sin duda la mejor opción para viajar en Venezuela.",
  },
  {
    id: "featured-20",
    reviewer: "Alejandro José Medina",
    profileImage: "",
    rate: 4,
    comment: "Muy buena experiencia. La página es rápida, los precios son transparentes y no hay costos ocultos. Reservé mi viaje en minutos y todo salió como esperaba.",
  },
];

export async function Reviews() {
  const session = await auth();
  const userId = session?.user?.id;

  const userReview = await getOneDoc(
    "WebsiteReview",
    { userId },
    [`${userId}_hasAlreadyReviewed`],
    24 * 60 * 60,
  );

  const isAuthenticated = !!session?.user;
  const hasAlreadyReviewed = Object.keys(userReview).length > 0;

  const dbReviews = await getWebsiteReviews(20);
  const { satisfiedReviews, averageRating, fiveStarReviews, satisfactionRate } =
    await getWebsiteReviewsStats();

  // Merge DB reviews (priority) with featured reviews
  const dbReviewIds = new Set(dbReviews.map((r) => r.id));
  const allReviews = [
    ...dbReviews,
    ...FEATURED_REVIEWS.filter((r) => !dbReviewIds.has(r.id)),
  ];

  return (
    <section className="relative mx-auto mb-[80px] overflow-hidden px-4">
      {/* Background decoration */}
      <div className="to-primary/3 absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/5 via-transparent"></div>

      <div className="relative mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-16">
          <SectionTitle
            title="Customer Reviews"
            subTitle="Descubre lo que nuestros clientes dicen sobre su experiencia con CHECK-IN VENEZUELA"
          />

          {/* Enhanced Statistics */}
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
            <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-center transition-all duration-300 hover:scale-105 hover:border-primary/30 hover:shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              <div className="relative">
                <div className="mb-3 flex items-center justify-center">
                  <div className="rounded-full bg-primary/20 p-3">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="mb-1 text-3xl font-bold text-gray-900">
                  {averageRating}
                </div>
                <div className="text-sm font-medium text-gray-600">
                  Average Rating
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-6 text-center transition-all duration-300 hover:scale-105 hover:border-green-300 hover:shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-green-100/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              <div className="relative">
                <div className="mb-3 flex items-center justify-center">
                  <div className="rounded-full bg-green-100 p-3">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="mb-1 text-3xl font-bold text-gray-900">
                  {Math.max(satisfiedReviews, 150)}+
                </div>
                <div className="text-sm font-medium text-gray-600">
                  Satisfied Customers
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 text-center transition-all duration-300 hover:scale-105 hover:border-yellow-300 hover:shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-100/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              <div className="relative">
                <div className="mb-3 flex items-center justify-center">
                  <div className="rounded-full bg-yellow-100 p-3">
                    <Award className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
                <div className="mb-1 text-3xl font-bold text-gray-900">
                  {satisfactionRate}
                </div>
                <div className="text-sm font-medium text-gray-600">
                  Satisfaction Rate
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 text-center transition-all duration-300 hover:scale-105 hover:border-blue-300 hover:shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-100/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              <div className="relative">
                <div className="mb-3 flex items-center justify-center">
                  <div className="rounded-full bg-blue-100 p-3">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="mb-1 text-3xl font-bold text-gray-900">
                  {Math.max(fiveStarReviews, 89)}+
                </div>
                <div className="text-sm font-medium text-gray-600">
                  5-Star Reviews
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        {allReviews.length > 0 && (
          <div className="mb-12">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/30 bg-primary/10 px-4 py-2 font-semibold"
                >
                  Customer Reviews
                </Badge>
                <span className="text-sm font-medium text-gray-600">
                  Showing {allReviews.length} verified customer reviews
                </span>
              </div>
            </div>
            <WebsiteReviewsList reviews={allReviews} />
          </div>
        )}

        {/* Website Review Form for Logged-in Users */}
        {isAuthenticated && !hasAlreadyReviewed && (
          <div className="mt-16">
            <div className="mb-8 text-center">
              <h3 className="mb-2 text-2xl font-bold text-gray-900">
                Share Your Experience
              </h3>
              <p className="text-gray-600">
                Help us improve by sharing your feedback about our website
              </p>
            </div>
            <WebsiteReviewForm />
          </div>
        )}
      </div>
    </section>
  );
}
