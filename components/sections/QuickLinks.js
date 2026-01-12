import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MapPin, Phone, Clock, Instagram, Facebook, Youtube } from "lucide-react";

// Configuración de redes sociales - Actualizar URLs cuando estén disponibles
const socialLinks = [
  {
    name: "Instagram",
    href: "#", // TODO: Agregar URL de Instagram
    icon: Instagram,
    enabled: true,
  },
  {
    name: "Facebook",
    href: "#", // TODO: Agregar URL de Facebook
    icon: Facebook,
    enabled: true,
  },
  {
    name: "TikTok",
    href: "#", // TODO: Agregar URL de TikTok
    icon: null, // TikTok no está en Lucide, usamos SVG personalizado
    enabled: true,
  },
  {
    name: "YouTube",
    href: "#", // TODO: Agregar URL de YouTube
    icon: Youtube,
    enabled: true,
  },
];

// Componente SVG para TikTok (no está en Lucide)
function TikTokIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export function QuickLinks() {
  const links = {
    "Destinos": [
      {
        name: "Venezuela",
        href: "#",
      },
      {
        name: "Colombia",
        href: "#",
      },
      {
        name: "México",
        href: "#",
      },
      {
        name: "Estados Unidos",
        href: "#",
      },
    ],
    "Servicios": [
      {
        name: "Vuelos",
        href: "/flights",
      },
      {
        name: "Hoteles",
        href: "/hotels",
      },
      {
        name: "Paquetes Turísticos",
        href: "#",
      },
    ],
    "Nosotros": [
      {
        name: "Nuestra Historia",
        href: "#",
      },
      {
        name: "Trabaja con Nosotros",
        href: "#",
      },
    ],
  };

  return (
    <section className="relative z-10 mx-auto mb-[80px] flex w-[90%] gap-[40px] max-sm:flex-col sm:gap-[80px]">
      <div className="min-w-[200px]">
        <Logo className={"mb-[24px] block h-[40px] w-fit"} />

        {/* Ubicación */}
        <div className="mb-4 flex items-center gap-2 text-secondary">
          <MapPin className="h-4 w-4" />
          <span className="text-sm font-medium">Caracas - Venezuela</span>
        </div>

        {/* Teléfono/WhatsApp */}
        <div className="mb-4 flex items-center gap-2 text-secondary">
          <Phone className="h-4 w-4" />
          <a
            href="tel:+584264034052"
            className="text-sm font-medium hover:underline"
          >
            +58 426 4034052
          </a>
        </div>

        {/* Horario */}
        <div className="mb-6 flex items-center gap-2 text-secondary">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">Atención 24/7</span>
        </div>

        {/* Redes sociales */}
        <div className="flex items-center gap-3">
          {socialLinks
            .filter((social) => social.enabled)
            .map((social) => {
              const IconComponent = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Síguenos en ${social.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/10 text-secondary transition-all duration-200 hover:bg-secondary hover:text-white"
                >
                  {social.name === "TikTok" ? (
                    <TikTokIcon className="h-4 w-4" />
                  ) : (
                    <IconComponent className="h-4 w-4" />
                  )}
                </a>
              );
            })}
        </div>
      </div>
      <div className="grid grow justify-start gap-[24px] md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Object.entries(links).map((link, i) => {
          return (
            <div
              key={link[0]}
              className="text-[0.875rem] font-medium text-secondary/70"
            >
              <h3 className="mb-[16px] font-bold text-secondary">{link[0]}</h3>
              <div className="flex flex-col gap-3">
                {link[1].map((item) => {
                  return (
                    <div key={item.name}>
                      <Link
                        aria-label={"Ir a " + item.name}
                        href={item.href}
                        className="text-[0.875rem] hover:underline inline font-medium text-secondary/70"
                      >
                        {item.name}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Contacto section */}
        <div className="text-[0.875rem] font-medium text-secondary/70">
          <h3 className="mb-[16px] font-bold text-secondary">Contacto</h3>
          <div className="flex flex-col gap-3">
            <a
              href="https://wa.me/584264034052"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.875rem] hover:underline inline font-medium text-secondary/70"
            >
              WhatsApp
            </a>
            <span className="text-[0.875rem] font-medium text-secondary/40">
              Email: Próximamente
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
