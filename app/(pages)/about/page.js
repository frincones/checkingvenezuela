import { ContactCTA } from "@/components/pages/about/ContactCTA";

export const metadata = {
  title: "Our Story | Venezuela Voyages",
  description:
    "Discover the story of Venezuela Voyages, 17 years of experience crafting epic expeditions across Venezuela.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-[90%] max-w-4xl py-10 lg:py-16">
      {/* Hero Section */}
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">
          The Spirit of Venezuela Voyages
        </h1>
        <p className="text-xl font-semibold text-primary">
          Welcome to the adventure of a lifetime!
        </p>
      </div>

      {/* Intro */}
      <section className="mb-12">
        <p className="mb-4 text-lg leading-relaxed text-gray-700">
          At Venezuela Voyages, we don&apos;t just sell destinations — we awaken
          your explorer spirit. We are a team of nature enthusiasts passionate
          about our land, experts in taking you beyond the conventional.
        </p>
        <p className="text-lg leading-relaxed text-gray-700">
          What sets us apart is not just our passion, but our track record: we
          have{" "}
          <strong className="text-primary">
            17 years of uninterrupted experience
          </strong>{" "}
          exploring every corner of this country. Nearly two decades designing
          epic expeditions have made us the local experts who know exactly how to
          turn a trip into a legendary story. From the world&apos;s tallest
          waterfall to the wildest waves in the Caribbean, we have perfected the
          art of travel with the ideal balance of adrenaline, safety, and
          comfort.
        </p>
      </section>

      {/* Mission & Vision */}
      <div className="mb-12 grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-8 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              🎯
            </span>
            <h2 className="text-2xl font-bold text-gray-900">Our Mission</h2>
          </div>
          <p className="leading-relaxed text-gray-700">
            To transform every trip into an epic expedition. We are dedicated to
            creating routes packed with action, safety, and excitement,
            connecting bold travelers with Venezuela&apos;s most vibrant
            treasures. Our goal is for you to return home with a heart full of
            stories and the certainty of having conquered paradise with the best
            guides in the country.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              🚀
            </span>
            <h2 className="text-2xl font-bold text-gray-900">Our Vision</h2>
          </div>
          <p className="leading-relaxed text-gray-700">
            To establish ourselves as the leading boutique agency in adventure
            tourism and disruptive experiences in Venezuela. We aspire to be
            recognized worldwide as the architects of unforgettable journeys,
            where untamed nature and 17 years of expert knowledge come together
            at every step of the way.
          </p>
        </div>
      </div>

      {/* Call to Action */}
      <section className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-white md:p-12">
        <h2 className="mb-4 text-3xl font-bold">
          Time to Fire Up the Engines!
        </h2>
        <p className="mx-auto mb-4 max-w-2xl text-lg leading-relaxed text-white/90">
          Don&apos;t just hear about it — live it. The jungle roars, the
          Caribbean awaits, and adventure has your name written all over it. At
          Venezuela Voyages, we are ready to take you to the wildest and most
          beautiful corners you&apos;ve ever imagined, with the confidence that
          only years of experience can provide.
        </p>
        <p className="mb-6 text-xl font-semibold">
          Are you ready to break the routine and conquer paradise?
        </p>
        <ContactCTA />
        <p className="mt-4 text-sm text-white/70">
          The Venezuela of your dreams is calling!
        </p>
      </section>
    </div>
  );
}
