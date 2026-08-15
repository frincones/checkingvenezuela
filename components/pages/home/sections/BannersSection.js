import { createAdminClient } from "@/lib/db/supabase/server";
import Link from "next/link";
import Image from "next/image";

async function getBannersByPosition(position) {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("banners")
      .select("*")
      .eq("is_active", true)
      .eq("position", position)
      .order("display_order", { ascending: true });

    if (error) return [];

    const now = new Date();
    return (data || []).filter((b) => {
      if (b.starts_at && new Date(b.starts_at) > now) return false;
      if (b.ends_at && new Date(b.ends_at) < now) return false;
      return true;
    });
  } catch {
    return [];
  }
}

function BannerCard({ banner, className = "" }) {
  const content = (
    <div
      className={`relative flex items-center overflow-hidden ${className}`}
      style={{ backgroundColor: banner.background_color || "#0A1A44" }}
    >
      {banner.image_url && (
        <Image
          src={banner.image_url}
          alt={banner.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 90vw"
        />
      )}
      <div className="absolute inset-0 bg-black/30" />
      {banner.badge_text && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-yellow-400 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-gray-900 shadow">
          {banner.badge_text}
        </span>
      )}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 text-center text-white">
        <h3 className="text-lg font-bold leading-tight drop-shadow-md md:text-2xl lg:text-3xl">
          {banner.title}
        </h3>
        {banner.subtitle && (
          <p className="mt-1.5 max-w-xl text-xs font-medium drop-shadow-sm md:text-sm">
            {banner.subtitle}
          </p>
        )}
        {banner.link_url && (
          <span className="mt-3 inline-block rounded-lg bg-white px-5 py-2 text-xs font-semibold text-gray-900 shadow-md transition-colors hover:bg-gray-100 md:text-sm">
            {banner.link_label || "Learn more"}
          </span>
        )}
      </div>
    </div>
  );

  if (banner.link_url) {
    return <Link href={banner.link_url}>{content}</Link>;
  }
  return content;
}

// Hero banners: carousel horizontal at top of homepage
export async function BannersHero() {
  const banners = await getBannersByPosition("hero");
  if (!banners.length) return null;

  return (
    <section className="w-full">
      <div
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {banners.map((banner) => (
          <BannerCard
            key={banner.id}
            banner={banner}
            className="h-[200px] w-full min-w-full snap-center rounded-2xl shadow-md md:h-[300px]"
          />
        ))}
      </div>
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

// Section banners: promotional banner within homepage content
export async function BannersSection() {
  const banners = await getBannersByPosition("section");
  if (!banners.length) return null;

  return (
    <section className="w-full space-y-4">
      {banners.map((banner) => (
        <BannerCard
          key={banner.id}
          banner={banner}
          className="h-[150px] w-full rounded-2xl shadow-md md:h-[200px]"
        />
      ))}
    </section>
  );
}

// Sidebar banners: vertical banners on left/right of all pages
export async function BannersSidebar() {
  const banners = await getBannersByPosition("sidebar");
  if (!banners.length) return null;

  const leftBanners = banners.filter((_, i) => i % 2 === 0);
  const rightBanners = banners.filter((_, i) => i % 2 === 1);
  // If only 1 banner, show on both sides
  const left = leftBanners.length ? leftBanners : banners;
  const right = rightBanners.length ? rightBanners : banners;

  return (
    <>
      {/* Left sidebar */}
      <div className="fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
        <div className="flex flex-col gap-3 pl-2">
          {left.map((banner) => (
            <SidebarBannerCard key={banner.id} banner={banner} />
          ))}
        </div>
      </div>
      {/* Right sidebar */}
      <div className="fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
        <div className="flex flex-col gap-3 pr-2">
          {right.map((banner) => (
            <SidebarBannerCard key={banner.id} banner={banner} />
          ))}
        </div>
      </div>
    </>
  );
}

function SidebarBannerCard({ banner }) {
  const content = (
    <div
      className="relative flex h-[280px] w-[120px] flex-col items-center justify-center overflow-hidden rounded-xl shadow-lg transition-transform hover:scale-105"
      style={{ backgroundColor: banner.background_color || "#0A1A44" }}
    >
      {banner.image_url && (
        <Image
          src={banner.image_url}
          alt={banner.title}
          fill
          className="object-cover"
          sizes="120px"
        />
      )}
      <div className="absolute inset-0 bg-black/40" />
      {banner.badge_text && (
        <span className="absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-900">
          {banner.badge_text}
        </span>
      )}
      <div className="relative z-10 flex flex-col items-center px-2 text-center text-white">
        <p className="text-xs font-bold leading-tight drop-shadow-md">
          {banner.title}
        </p>
        {banner.subtitle && (
          <p className="mt-1 text-[10px] leading-tight opacity-80">
            {banner.subtitle}
          </p>
        )}
        {banner.link_url && (
          <span className="mt-2 rounded bg-white/90 px-3 py-1 text-[10px] font-semibold text-gray-900">
            {banner.link_label || "Learn more"}
          </span>
        )}
      </div>
    </div>
  );

  if (banner.link_url) {
    return (
      <Link href={banner.link_url} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

export default BannersSection;
