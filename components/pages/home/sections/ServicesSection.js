import { SectionTitle } from "@/components/SectionTitle";
import { Card, CardContent } from "@/components/ui/card";
import { DualCTA } from "@/components/ui/DualCTA";
import { getEnabledServices } from "@/data/servicesConfig";
import {
  Plane,
  Building2,
  Package,
  Compass,
  Car,
  Shield,
  CarFront,
  Ship,
  Briefcase,
  Sparkles,
} from "lucide-react";

// Mapa de iconos de Lucide
const iconMap = {
  Plane,
  Building2,
  Package,
  Compass,
  Car,
  Shield,
  CarFront,
  Ship,
  Briefcase,
  Sparkles,
};

/**
 * ServicesSection - Catálogo de Servicios
 *
 * HU-003: Muestra los 10 servicios con dual CTA
 * - Comprar online (si está disponible)
 * - Cotizar con asesor (WhatsApp)
 */
export function ServicesSection() {
  const services = getEnabledServices();

  return (
    <section className="mx-auto mb-[80px]">
      <div className="mb-[20px] md:mb-[40px]">
        <SectionTitle
          title="Nuestros Servicios"
          subTitle="Todo lo que necesitas para tu viaje perfecto"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {services.map((service) => {
          const IconComponent = iconMap[service.icon];
          const whatsappMessage = `Hola, estoy interesado en cotizar: ${service.name}`;

          return (
            <Card
              key={service.id}
              className="group relative overflow-hidden transition-all hover:shadow-lg"
            >
              <CardContent className="flex flex-col items-center p-4 text-center">
                {/* Icono */}
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {IconComponent && <IconComponent className="h-6 w-6" />}
                </div>

                {/* Nombre del servicio */}
                <h3 className="mb-1 font-semibold text-foreground">
                  {service.name}
                </h3>

                {/* Descripción */}
                <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">
                  {service.description}
                </p>

                {/* Badge "Próximamente" */}
                {service.comingSoon && (
                  <span className="mb-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Próximamente
                  </span>
                )}

                {/* Dual CTA */}
                <DualCTA
                  variant="compact"
                  onlineEnabled={service.hasOnlinePurchase}
                  onlinePath={service.href}
                  onlineLabel={service.name}
                  onlineComingSoon={service.comingSoon}
                  quoteEnabled={service.hasQuoteRequest}
                  quoteMessage={whatsappMessage}
                  quoteLabel={`Cotizar ${service.name}`}
                  className="mt-auto"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default ServicesSection;
