import { createAdminClient } from "@/lib/db/supabase/server";

const BASE_URL = "https://venezuelavoyages.com";

export default async function sitemap() {
  const adminClient = createAdminClient();

  // Static pages
  const staticPages = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/packages`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/flights`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/hotels`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/support`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms-of-service`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/return-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/security-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  // Dynamic: destinations
  let destinationPages = [];
  try {
    const { data: destinations } = await adminClient
      .from("destinations")
      .select("slug, updated_at")
      .eq("is_active", true);

    if (destinations) {
      destinationPages = destinations.map((d) => ({
        url: `${BASE_URL}/destinos/${d.slug}`,
        lastModified: d.updated_at ? new Date(d.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }));
    }
  } catch (e) {
    console.error("Sitemap: error fetching destinations", e);
  }

  // Dynamic: packages by destination
  let packageDestinationPages = [];
  try {
    const { data: destinations } = await adminClient
      .from("destinations")
      .select("slug, updated_at")
      .eq("is_active", true);

    if (destinations) {
      packageDestinationPages = destinations.map((d) => ({
        url: `${BASE_URL}/packages/destino/${d.slug}`,
        lastModified: d.updated_at ? new Date(d.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      }));
    }
  } catch (e) {
    console.error("Sitemap: error fetching package destinations", e);
  }

  // Dynamic: individual packages
  let packagePages = [];
  try {
    const { data: packages } = await adminClient
      .from("service_inventory")
      .select("slug, updated_at")
      .eq("is_published", true)
      .eq("product_type", "package")
      .neq("status", "discontinued");

    if (packages) {
      packagePages = packages.map((p) => ({
        url: `${BASE_URL}/packages/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      }));
    }
  } catch (e) {
    console.error("Sitemap: error fetching packages", e);
  }

  // Dynamic: blog posts
  let blogPages = [];
  try {
    const { data: posts } = await adminClient
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("status", "published");

    if (posts) {
      blogPages = posts.map((p) => ({
        url: `${BASE_URL}/blog/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      }));
    }
  } catch (e) {
    console.error("Sitemap: error fetching blog posts", e);
  }

  return [
    ...staticPages,
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ...destinationPages,
    ...packageDestinationPages,
    ...packagePages,
    ...blogPages,
  ];
}
