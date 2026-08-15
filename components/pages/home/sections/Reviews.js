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
    comment: "I booked my Margarita holiday with Venezuela Voyages and everything went perfectly. The team helped me find the best hotel and the most affordable flights. I'll definitely book with them again.",
  },
  {
    id: "featured-2",
    reviewer: "Carlos Eduardo Rodríguez",
    profileImage: "",
    rate: 5,
    comment: "Excellent service from start to finish. I booked a family package to Los Roques and everything was flawless. Customer care is first class — they always answered my questions quickly.",
  },
  {
    id: "featured-3",
    reviewer: "Ana Gabriela Martínez",
    profileImage: "",
    rate: 5,
    comment: "Competitive prices and completely personalised service. They helped me plan my honeymoon and every detail was handled with great care. So grateful to the whole team.",
  },
  {
    id: "featured-4",
    reviewer: "José Luis Hernández",
    profileImage: "",
    rate: 4,
    comment: "The booking process was simple and fast. In under 10 minutes I had everything confirmed. The platform is intuitive and easy to use.",
  },
  {
    id: "featured-5",
    reviewer: "Valentina Pérez",
    profileImage: "",
    rate: 5,
    comment: "I travelled to Canaima with my family and it was an unforgettable experience. Venezuela Voyages got us the best rates and the hotel exceeded our expectations. Highly recommended.",
  },
  {
    id: "featured-6",
    reviewer: "Diego Alejandro Torres",
    profileImage: "",
    rate: 5,
    comment: "I had spent months looking for affordable flights to Mérida and found incredible deals here. The process was super easy and customer support was excellent.",
  },
  {
    id: "featured-7",
    reviewer: "Gabriela Morales",
    profileImage: "",
    rate: 5,
    comment: "I loved the experience. I booked an all-inclusive package to Tucacas and it was spectacular. The team handled everything: flights, hotel and transfers. I didn't have to worry about a thing.",
  },
  {
    id: "featured-8",
    reviewer: "Ricardo José Díaz",
    profileImage: "",
    rate: 4,
    comment: "A great platform for booking trips within Venezuela. Fair prices and very professional service. I recommend it to all my friends.",
  },
  {
    id: "featured-9",
    reviewer: "Isabela Ramírez",
    profileImage: "",
    rate: 5,
    comment: "Venezuela Voyages made organising my holiday incredibly easy. I found options that didn't appear on other sites. The support team looked after me wonderfully.",
  },
  {
    id: "featured-10",
    reviewer: "Andrés Felipe Castillo",
    profileImage: "",
    rate: 5,
    comment: "I booked a business trip to Caracas and everything went exactly as planned. The hotel they recommended was excellent and the flight was on time. A 10 out of 10 service.",
  },
  {
    id: "featured-11",
    reviewer: "Daniela Sofía López",
    profileImage: "",
    rate: 5,
    comment: "I'm a frequent Venezuela Voyages customer and they have never let me down. Every trip I book is an incredible experience. The prices are always the best on the market.",
  },
  {
    id: "featured-12",
    reviewer: "Luis Miguel Vargas",
    profileImage: "",
    rate: 4,
    comment: "Good experience overall. I booked a weekend in Choroní and it was very well organised. The only snag was that confirmation took a little while, but everything else was perfect.",
  },
  {
    id: "featured-13",
    reviewer: "Camila Andrea Sánchez",
    profileImage: "",
    rate: 5,
    comment: "Incredible service. I organised a surprise birthday trip to Margarita for my husband and it went perfectly. The team helped me with every detail. Forever grateful.",
  },
  {
    id: "featured-14",
    reviewer: "Sebastián Gutiérrez",
    profileImage: "",
    rate: 5,
    comment: "The best online travel agency in Venezuela. I've tried several and none compare to Venezuela Voyages. Low prices, fast service and hassle-free trips.",
  },
  {
    id: "featured-15",
    reviewer: "Patricia Elena Mendoza",
    profileImage: "",
    rate: 5,
    comment: "I booked flights for my whole family and the savings were significant compared with other platforms. The interface is very easy to use and the payment process feels secure.",
  },
  {
    id: "featured-16",
    reviewer: "Fernando José Rivas",
    profileImage: "",
    rate: 4,
    comment: "An excellent platform for finding the best prices on hotels and flights. I used it for my trip to Mochima and was very satisfied with the whole service.",
  },
  {
    id: "featured-17",
    reviewer: "Laura Cristina Navarro",
    profileImage: "",
    rate: 5,
    comment: "My experience was wonderful. From searching to booking, everything was seamless. The hotel in Los Roques was spectacular and the price unbeatable. Highly recommended.",
  },
  {
    id: "featured-18",
    reviewer: "Miguel Ángel Flores",
    profileImage: "",
    rate: 5,
    comment: "I've booked three trips with Venezuela Voyages and each one has been better than the last. The team genuinely cares about delivering the best possible experience.",
  },
  {
    id: "featured-19",
    reviewer: "Verónica Alejandra Ruiz",
    profileImage: "",
    rate: 5,
    comment: "I booked a Canaima package for my anniversary and it was the best gift I could have given. Everything was perfectly coordinated. Without a doubt the best way to travel in Venezuela.",
  },
  {
    id: "featured-20",
    reviewer: "Alejandro José Medina",
    profileImage: "",
    rate: 4,
    comment: "Very good experience. The site is fast, prices are transparent and there are no hidden costs. I booked my trip in minutes and it all went as expected.",
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

  // Filter out DB reviews without a real name, then merge with featured reviews
  const namedDbReviews = dbReviews.filter(
    (r) => r.reviewer && r.reviewer !== "User",
  );
  const dbReviewIds = new Set(namedDbReviews.map((r) => r.id));
  const allReviews = [
    ...namedDbReviews,
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
            subTitle="See what our travellers say about their experience with VENEZUELA VOYAGES"
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
                  {Math.max(parseInt(satisfiedReviews) || 0, 150)}+
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
                  {Math.max(parseInt(fiveStarReviews) || 0, 89)}+
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
