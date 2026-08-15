import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/db/supabase/server";
import { Calendar, User, Tag, Search, Mail, ArrowRight, MessageCircle } from "lucide-react";

export const metadata = {
  title: "Travel Blog | Venezuela Voyages",
  description:
    "Discover destinations, tips, itineraries and travel experiences across Venezuela. Expert advice, deals and news from Venezuelan tourism.",
  keywords: [
    "venezuela travel blog",
    "venezuela destinations",
    "traveller tips",
    "venezuela itineraries",
    "venezuela tourism",
    "venezuela voyages blog",
  ],
};

export const dynamic = "force-dynamic";

const WHATSAPP_NUMBER = "584264034052";

const ALL_CATEGORIES = [
  { key: "todos", label: "All" },
  { key: "destinos", label: "Destinations" },
  { key: "tips", label: "Travel Tips" },
  { key: "consejos", label: "Advice" },
  { key: "itinerarios", label: "Itineraries" },
  { key: "ofertas", label: "Deals" },
  { key: "noticias", label: "News" },
];

async function getPublishedPosts({ query, category }) {
  const admin = createAdminClient();
  let q = admin
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image, category, author_name, published_at, tags")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);

  if (category && category !== "todos") {
    q = q.eq("category", category);
  }

  if (query) {
    q = q.or(`title.ilike.%${query}%,excerpt.ilike.%${query}%`);
  }

  const { data } = await q;
  return data || [];
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PostCard({ post, featured = false }) {
  const linkClass = featured
    ? "group flex flex-col md:flex-row overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-lg"
    : "group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-lg";

  return (
    <Link href={`/blog/${post.slug}`} className={linkClass}>
      {/* Image */}
      <div className={`relative overflow-hidden ${featured ? "h-56 md:h-auto md:w-2/5" : "aspect-video w-full"}`}>
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes={featured ? "(max-width: 768px) 100vw, 40vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
          />
        ) : (
          <div className="flex h-full min-h-[180px] items-center justify-center bg-gradient-to-br from-[#0A1A44]/10 to-[#F2A93B]/10">
            <Tag className="h-12 w-12 text-[#0A1A44]/20" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-1 flex-col justify-center ${featured ? "p-6 md:p-8" : "p-5"}`}>
        {post.category && (
          <span className="mb-2 inline-block w-fit rounded-full bg-[#F2A93B]/15 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#0A1A44]">
            {post.category}
          </span>
        )}
        <h2
          className={`mb-2 font-bold text-gray-900 transition-colors group-hover:text-[#0A1A44] ${
            featured ? "text-xl md:text-2xl" : "text-lg"
          }`}
        >
          {post.title}
        </h2>
        {post.excerpt && (
          <p className={`mb-4 text-gray-600 ${featured ? "line-clamp-3 text-base" : "line-clamp-2 text-sm"}`}>
            {post.excerpt}
          </p>
        )}
        <div className="mt-auto flex items-center gap-4 text-xs text-gray-400">
          {post.author_name && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {post.author_name}
            </span>
          )}
          {post.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.published_at)}
            </span>
          )}
        </div>
        {featured && (
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0A1A44]">
            Read more <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </Link>
  );
}

function MiniPostCard({ post }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex gap-3 py-3">
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
        {post.cover_image ? (
          <Image src={post.cover_image} alt={post.title} fill className="object-cover" sizes="56px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#0A1A44]/5">
            <Tag className="h-4 w-4 text-[#0A1A44]/20" />
          </div>
        )}
      </div>
      <div className="flex-1">
        <h4 className="line-clamp-2 text-sm font-medium text-gray-800 transition-colors group-hover:text-[#0A1A44]">
          {post.title}
        </h4>
        <p className="mt-1 text-xs text-gray-400">{formatDate(post.published_at)}</p>
      </div>
    </Link>
  );
}

export default async function BlogPage(props) {
  const searchParams = await props.searchParams;
  const query = searchParams?.q || "";
  const category = searchParams?.category || "todos";

  const posts = await getPublishedPosts({ query, category });

  // All posts unfiltered for sidebar (recent posts)
  const allPostsForSidebar =
    category !== "todos" || query
      ? await getPublishedPosts({ query: "", category: "todos" })
      : posts;

  const featuredPosts = posts.slice(0, 3);
  const gridPosts = posts.slice(3);
  const recentPosts = allPostsForSidebar.slice(0, 5);

  // Collect unique categories from all posts
  const existingCategories = allPostsForSidebar.map((p) => p.category).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  return (
    <main className="min-h-screen bg-gray-50/50">
      {/* ===== HERO ===== */}
      <section className="bg-gradient-to-br from-[#0A1A44] to-[#0A1A44]/90 px-4 pb-16 pt-12 text-white md:pb-20 md:pt-16">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
            Travel Blog
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80 md:text-xl">
            Discover destinations, tips and travel experiences across Venezuela
          </p>

          {/* Search */}
          <form method="GET" action="/blog" className="mx-auto mt-8 max-w-xl">
            <input type="hidden" name="category" value={category} />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Search articles..."
                className="w-full rounded-full border-0 bg-white py-3.5 pl-12 pr-5 text-gray-900 shadow-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F2A93B]"
              />
            </div>
          </form>

          {/* Category tabs */}
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const isActive = category === cat.key;
              return (
                <Link
                  key={cat.key}
                  href={`/blog?category=${cat.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[#F2A93B] text-[#0A1A44] shadow-md"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {cat.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto w-[92%] max-w-6xl">
        {/* Search results info */}
        {(query || category !== "todos") && (
          <div className="mt-8 flex items-center gap-3">
            <p className="text-sm text-gray-500">
              {posts.length} resultado{posts.length !== 1 ? "s" : ""}
              {query && (
                <> para &quot;<span className="font-medium text-gray-700">{query}</span>&quot;</>
              )}
              {category !== "todos" && (
                <> en <span className="font-medium text-gray-700">{category}</span></>
              )}
            </p>
            <Link href="/blog" className="text-sm font-medium text-[#0A1A44] hover:underline">
              Limpiar filtros
            </Link>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-[#0A1A44]/5 p-4">
              <Search className="h-8 w-8 text-[#0A1A44]/30" />
            </div>
            <p className="text-xl font-semibold text-gray-600">No articles found</p>
            <p className="mt-2 text-gray-400">
              {query ? "Try different search terms" : "We are preparing incredible content for you"}
            </p>
            {query && (
              <Link href="/blog" className="mt-4 text-sm font-medium text-[#0A1A44] hover:underline">
                View all articles
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ===== FEATURED POSTS ===== */}
            {featuredPosts.length > 0 && !query && category === "todos" && (
              <section className="mt-10">
                <h2 className="mb-6 text-2xl font-bold text-gray-900">Featured Articles</h2>
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* First featured post — large */}
                  <div className="lg:row-span-2">
                    <PostCard post={featuredPosts[0]} featured />
                  </div>
                  {/* Second and third */}
                  {featuredPosts.slice(1).map((post) => (
                    <PostCard key={post.id} post={post} featured />
                  ))}
                </div>
              </section>
            )}

            {/* ===== GRID + SIDEBAR ===== */}
            <section className="mt-12 pb-16 md:pb-20">
              <div className="flex flex-col gap-10 lg:flex-row">
                {/* Main grid */}
                <div className="flex-1">
                  {(category !== "todos" || query ? posts : gridPosts).length > 0 ? (
                    <>
                      <h2 className="mb-6 text-2xl font-bold text-gray-900">
                        {category !== "todos" || query ? "Results" : "More Articles"}
                      </h2>
                      <div className="grid gap-6 sm:grid-cols-2">
                        {(category !== "todos" || query ? posts : gridPosts).map((post) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Sidebar */}
                <aside className="w-full flex-shrink-0 lg:w-80">
                  <div className="sticky top-24 space-y-8">
                    {/* Categories */}
                    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                      <h3 className="mb-4 text-lg font-bold text-gray-900">Categories</h3>
                      <ul className="space-y-2">
                        {ALL_CATEGORIES.filter((c) => c.key === "todos" || existingCategories.includes(c.key)).map(
                          (cat) => {
                            const count =
                              cat.key === "todos"
                                ? allPostsForSidebar.length
                                : allPostsForSidebar.filter((p) => p.category === cat.key).length;
                            return (
                              <li key={cat.key}>
                                <Link
                                  href={`/blog?category=${cat.key}`}
                                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                                    category === cat.key
                                      ? "bg-[#0A1A44]/5 font-semibold text-[#0A1A44]"
                                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                  }`}
                                >
                                  <span>{cat.label}</span>
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                                    {count}
                                  </span>
                                </Link>
                              </li>
                            );
                          }
                        )}
                      </ul>
                    </div>

                    {/* Recent posts */}
                    {recentPosts.length > 0 && (
                      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-lg font-bold text-gray-900">Posts Recientes</h3>
                        <div className="divide-y divide-gray-100">
                          {recentPosts.map((post) => (
                            <MiniPostCard key={post.id} post={post} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Subscribe */}
                    <div className="rounded-xl bg-gradient-to-br from-[#0A1A44] to-[#0A1A44]/90 p-6 text-white shadow-sm">
                      <Mail className="mb-3 h-8 w-8 text-[#F2A93B]" />
                      <h3 className="mb-2 text-lg font-bold">Subscribe</h3>
                      <p className="mb-4 text-sm text-white/70">
                        Get the best travel articles straight to your inbox.
                      </p>
                      <form action="/api/blog/subscribe" method="POST">
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="you@email.com"
                          className="mb-3 w-full rounded-lg border-0 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#F2A93B]"
                        />
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-[#F2A93B] px-4 py-2.5 text-sm font-semibold text-[#0A1A44] transition-colors hover:bg-[#F2A93B]/90"
                        >
                          Subscribe
                        </button>
                      </form>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          </>
        )}
      </div>

      {/* ===== CTA FINAL ===== */}
      <section className="bg-gradient-to-r from-[#0A1A44] to-[#0A1A44]/95 px-4 py-16 text-center text-white md:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-extrabold md:text-4xl">
            Ready for your next adventure?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/70">
            Get in touch and we will design the perfect trip through Venezuela for you.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hola, me interesa planificar un viaje con Venezuela Voyages.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#F2A93B] px-8 py-3.5 text-base font-bold text-[#0A1A44] shadow-lg transition-all hover:bg-[#F2A93B]/90 hover:shadow-xl"
          >
            <MessageCircle className="h-5 w-5" />
            Message us on WhatsApp
          </a>
        </div>
      </section>
    </main>
  );
}
