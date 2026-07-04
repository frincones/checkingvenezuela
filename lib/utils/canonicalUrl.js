export const SITE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://venezuelavoyages.com";

export function canonicalUrl(path = "/") {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL.replace(/\/$/, "")}${suffix}`;
}
