import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { BreadcrumbUI } from "@/components/local-ui/breadcrumb";
import { PackageBookingForm } from "@/components/pages/packages/sections/PackageBookingForm";
import { PackageBookingSummary } from "@/components/pages/packages/sections/PackageBookingSummary";
import { findPackageBySlug } from "@/lib/packages/slug";

async function getPackageBySlug(slug) {
  return findPackageBySlug(slug, {
    select: `
      *,
      provider:tourism_providers(id, name, slug, contact_email, contact_phone),
      destination:destinations(id, name, slug, image_url, country)
    `,
  });
}

export default async function PackageBookingPage({ params }) {
  // Sin muro de login.
  //
  // Antes esta página redirigía a /user/login, y como además no estaba
  // enlazada desde ningún sitio, el formulario completo que vive aquí era
  // inalcanzable: nadie podía llegar nunca.
  //
  // Ahora es el paso 2 opcional al que invita la confirmación del modal.
  // Para entonces el visitante ya ha enviado su solicitud y existe un lead,
  // así que exigirle crear una cuenta para ampliar sus datos solo serviría
  // para perderlo.
  //
  // La sesión se sigue leyendo, pero solo para precargar el email de quien ya
  // ha iniciado sesión. El formulario ya contemplaba su ausencia.
  const session = await auth();
  const packageData = await getPackageBySlug(params.slug);

  if (!packageData) {
    return notFound();
  }

  return (
    <main className="mx-auto mb-20 mt-10 w-[90%]">
      <BreadcrumbUI />

      <div className="my-10">
        <h1 className="mb-2 text-3xl font-bold text-secondary">
          Book this package
        </h1>
        <p className="text-gray-600">
          Fill in your details to request a quote
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Booking Form */}
        <div className="lg:col-span-2">
          <PackageBookingForm
            packageData={packageData}
            userEmail={session?.user?.email}
            userId={session?.user?.id}
          />
        </div>

        {/* Booking Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <PackageBookingSummary packageData={packageData} />
          </div>
        </div>
      </div>
    </main>
  );
}
