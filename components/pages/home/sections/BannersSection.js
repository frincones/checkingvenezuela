import { createAdminClient } from "@/lib/db/supabase/server";
import Link from "next/link";
import Image from "next/image";

async function getActiveBanners() {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("banners")
      .select("*")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching banners:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error fetching banners:", err);
    return [];
  }
}

export async function BannersSection() {
  const banners = await getActiveBanners();

  if (!banners.length) return null;

  return (
    <section className="w-full">
      <div
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="relative flex h-[200px] w-full min-w-full snap-center items-center overflow-hidden rounded-2xl shadow-md md:h-[300px]"
            style={{ backgroundColor: banner.background_color || "#0A1A44" }}
          >
            {/* Background image */}
            {banner.image_url && (
              <Image
                src={banner.image_url}
                alt={banner.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 90vw"
              />
            )}

            {/* Overlay for readability */}
            <div className="absolute inset-0 bg-black/30" />

            {/* Badge */}
            {banner.badge_text && (
              <span className="absolute left-4 top-4 z-10 rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-900 shadow">
                {banner.badge_text}
              </span>
            )}

            {/* Content */}
            <div className="relative z-10 flex w-full flex-col items-center justify-center px-6 text-center text-white md:px-12">
              <h3 className="text-xl font-bold leading-tight drop-shadow-md md:text-3xl lg:text-4xl">
                {banner.title}
              </h3>
              {banner.subtitle && (
                <p className="mt-2 max-w-xl text-sm font-medium drop-shadow-sm md:text-base">
                  {banner.subtitle}
                </p>
              )}
              {banner.link_url && (
                <Link
                  href={banner.link_url}
                  className="mt-4 inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 shadow-md transition-colors hover:bg-gray-100"
                >
                  {banner.link_label || "Ver más"}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {banners.map((_, i) => (
            <span
              key={i}
              className={`inline-block h-2 w-2 rounded-full ${i === 0 ? "bg-primary" : "bg-gray-300"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default BannersSection;
