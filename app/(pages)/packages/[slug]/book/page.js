import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BreadcrumbUI } from "@/components/local-ui/breadcrumb";
import { PackageBookingForm } from "@/components/pages/packages/sections/PackageBookingForm";
import { PackageBookingSummary } from "@/components/pages/packages/sections/PackageBookingSummary";
import { createAdminClient } from "@/lib/db/supabase/server";
import routes from "@/data/routes.json";

async function getPackageBySlug(slug) {
  try {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("service_inventory")
      .select(`
        *,
        provider:tourism_providers(id, name, slug, contact_email, contact_phone),
        destination:destinations(id, name, slug, image_url, country)
      `)
      .eq("product_type", "package")
      .eq("is_published", true)
      .ilike("name", `%${slug.split('-').join(' ')}%`)
      .single();

    if (error) {
      console.error("Error fetching package:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error in getPackageBySlug:", err);
    return null;
  }
}

export default async function PackageBookingPage({ params }) {
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect(`${routes.login.path}?callbackUrl=/packages/${params.slug}/book`);
  }

  const packageData = await getPackageBySlug(params.slug);

  if (!packageData) {
    return notFound();
  }

  return (
    <main className="mx-auto mb-20 mt-10 w-[90%]">
      <BreadcrumbUI />

      <div className="my-10">
        <h1 className="mb-2 text-3xl font-bold text-secondary">
          Reservar Paquete
        </h1>
        <p className="text-gray-600">
          Completa tus datos para solicitar una cotización
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Booking Form */}
        <div className="lg:col-span-2">
          <PackageBookingForm
            packageData={packageData}
            userEmail={session.user.email}
            userId={session.user.id}
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
