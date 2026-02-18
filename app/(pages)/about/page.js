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
        <a
          href="https://wa.me/584264034052"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-lg font-semibold text-primary transition-transform hover:scale-105"
        >
          <svg
            className="h-6 w-6"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Contact Us Now!
        </a>
        <p className="mt-4 text-sm text-white/70">
          The Venezuela of your dreams is calling!
        </p>
      </section>
    </div>
  );
}
