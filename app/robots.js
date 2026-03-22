export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/user/"],
      },
    ],
    sitemap: "https://venezuelavoyages.com/sitemap.xml",
  };
}
