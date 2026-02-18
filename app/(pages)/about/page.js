export const metadata = {
  title: "Nuestra Historia | Venezuela Voyages",
  description:
    "Conoce la historia de Venezuela Voyages, 17 años de experiencia creando expediciones épicas por Venezuela.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-[90%] max-w-4xl py-10 lg:py-16">
      {/* Hero Section */}
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">
          El Espíritu de Venezuela Voyages
        </h1>
        <p className="text-xl font-semibold text-primary">
          ¡Bienvenidos a la aventura de su vida!
        </p>
      </div>

      {/* Intro */}
      <section className="mb-12">
        <p className="mb-4 text-lg leading-relaxed text-gray-700">
          En Venezuela Voyages, no solo vendemos destinos; despertamos tu
          espíritu explorador. Somos un equipo de adictos a la naturaleza y
          apasionados por nuestra tierra, expertos en llevarte más allá de lo
          convencional.
        </p>
        <p className="text-lg leading-relaxed text-gray-700">
          Lo que nos diferencia no es solo nuestra pasión, sino nuestra
          trayectoria: contamos con{" "}
          <strong className="text-primary">
            17 años de experiencia ininterrumpida
          </strong>{" "}
          explorando cada rincón de este país. Casi dos décadas diseñando
          expediciones épicas nos han convertido en los expertos locales que
          saben exactamente cómo transformar un viaje en una historia legendaria.
          Desde el salto de agua más alto del mundo hasta las olas más salvajes
          del Caribe, hemos perfeccionado el arte de viajar con el equilibrio
          perfecto entre adrenalina, seguridad y confort.
        </p>
      </section>

      {/* Misión y Visión */}
      <div className="mb-12 grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-8 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              🎯
            </span>
            <h2 className="text-2xl font-bold text-gray-900">
              Nuestra Misión
            </h2>
          </div>
          <p className="leading-relaxed text-gray-700">
            Transformar cada viaje en una expedición épica. Nos dedicamos a
            crear rutas llenas de acción, seguridad y emoción, conectando a
            viajeros audaces con los tesoros más vibrantes de Venezuela. Nuestra
            meta es que regreses a casa con el corazón lleno de historias y la
            certeza de haber conquistado el paraíso con los mejores guías del
            país.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
              🚀
            </span>
            <h2 className="text-2xl font-bold text-gray-900">
              Nuestra Visión
            </h2>
          </div>
          <p className="leading-relaxed text-gray-700">
            Consolidarnos como la agencia boutique líder en turismo de aventura
            y experiencias disruptivas en Venezuela. Queremos ser reconocidos
            mundialmente como los arquitectos de viajes inolvidables, donde la
            naturaleza salvaje y el conocimiento experto de 17 años se
            encuentran en cada paso del camino.
          </p>
        </div>
      </div>

      {/* Call to Action */}
      <section className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-white md:p-12">
        <h2 className="mb-4 text-3xl font-bold">
          ¡Es hora de arrancar motores!
        </h2>
        <p className="mx-auto mb-4 max-w-2xl text-lg leading-relaxed text-white/90">
          No dejes que te lo cuenten. La selva ruge, el Caribe te espera y la
          aventura tiene tu nombre escrito. En Venezuela Voyages, estamos listos
          para llevarte a los rincones más salvajes y hermosos que jamás hayas
          imaginado, con la confianza que solo los años de experiencia pueden
          darte.
        </p>
        <p className="mb-6 text-xl font-semibold">
          ¿Estás listo para romper la rutina y conquistar el paraíso?
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
          ¡Contáctanos ahora!
        </a>
        <p className="mt-4 text-sm text-white/70">
          ¡El Venezuela de tus sueños te está llamando!
        </p>
      </section>
    </div>
  );
}
