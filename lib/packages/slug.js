/**
 * Shared package slug helpers.
 *
 * Packages do not have a `slug` column in the database; the slug is derived
 * from the package `name` at runtime. Both the link generator (PackageCard)
 * and the route resolvers (/packages/[slug], /packages/[slug]/book,
 * /api/packages/[slug]) must use the exact same algorithm — otherwise URLs
 * stop resolving for names with accents, punctuation or slashes.
 *
 * Keeping generateSlug + findPackageBySlug in one module prevents that drift
 * from happening again. See commit e94e6d5 and the follow-up 404 on /book for
 * context.
 */

import { createAdminClient } from "@/lib/db/supabase/server";

/**
 * Generate the URL slug for a package from its name.
 *
 * The steps are:
 *   1. lowercase
 *   2. NFD-normalize + strip diacritics (á → a, é → e, ñ → n)
 *   3. " - " → "-"    (pretty-dashes in titles like "Canaima - Salto Ángel")
 *   4. whitespace → "-"
 *   5. "/" → "-"      (durations like "3D/2N")
 *   6. strip anything that is not a-z, 0-9, or "-"
 *   7. collapse consecutive dashes
 *   8. trim leading/trailing dashes
 */
export function generateSlug(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+-\s+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/\/+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Resolve a package by its URL slug.
 *
 * We fetch all published packages and match in JavaScript instead of using
 * `ilike` against the name, because `ilike` is NOT accent-insensitive in
 * PostgreSQL by default — and the slug always arrives without accents, while
 * the name in the DB may have them.
 *
 * @param {string} slug — slug from the URL
 * @param {object} [options]
 * @param {string} [options.select] — custom select clause (defaults to
 *   "* + provider + destination" joins used by both detail and book pages)
 * @returns {Promise<object|null>}
 */
export async function findPackageBySlug(slug, options = {}) {
  if (!slug) return null;

  const select =
    options.select ||
    `
      *,
      provider:tourism_providers(id, name, slug, logo_url, contact_email, contact_phone),
      destination:destinations(id, name, slug, image_url, country, city)
    `;

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("service_inventory")
    .select(select)
    .eq("product_type", "package")
    .eq("is_published", true);

  if (error) {
    console.error("findPackageBySlug error:", error);
    return null;
  }

  return (data || []).find((pkg) => generateSlug(pkg.name) === slug) || null;
}
