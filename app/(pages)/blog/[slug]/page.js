import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/db/supabase/server";
import { Calendar, Tag, ArrowLeft, ChevronRight, Clock } from "lucide-react";
import ShareButtons from "./ShareButtons";
import { DualCTA } from "@/components/ui/DualCTA";

// Normaliza un slug removiendo tildes, pasando a minúsculas y dejando solo a-z0-9-
function normalizeSlug(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function getPost(slug) {
  const admin = createAdminClient();

  // 1) Match exacto (ruta rápida para slugs bien formados).
  const { data: exact } = await admin
    .from("blog_posts")
    .select("*, destination:destinations(id, name, slug, image_url)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (exact) return exact;

  // 2) Fallback: hay posts heredados cuyo slug quedó con tildes/mayúsculas
  // (ej. "guía-turismo-Mérida-andes-Venezuela"). Comparamos normalizado.
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;

  const { data: candidates } = await admin
    .from("blog_posts")
    .select("id, slug")
    .eq("status", "published");

  const match = candidates?.find((p) => normalizeSlug(p.slug) === normalizedSlug);
  if (!match) return null;

  const { data } = await admin
    .from("blog_posts")
    .select("*, destination:destinations(id, name, slug, image_url)")
    .eq("id", match.id)
    .maybeSingle();
  return data || null;
}

async function getRelatedPosts(category, excludeId) {
  if (!category) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image, category, author_name, published_at")
    .eq("status", "published")
    .eq("category", category)
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(3);
  return data || [];
}

function estimateReadTime(content) {
  if (!content) return 1;
  // Rough: strip HTML, then ~1000 chars per minute
  const text = content.replace(/<[^>]*>/g, "");
  const minutes = Math.ceil(text.length / 1000);
  return Math.max(1, minutes);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata(props) {
  const params = await props.params;
  const post = await getPost(params.slug);
  if (!post) return { title: "Post no encontrado | Venezuela Voyages" };

  const keywords = [
    ...(post.tags || []),
    post.category,
    "venezuela voyages",
    "blog viajes",
    "turismo venezuela",
  ].filter(Boolean);

  return {
    title: post.meta_title || `${post.title} | Blog Venezuela Voyages`,
    description:
      post.meta_description ||
      post.excerpt ||
      `Read ${post.title} on the Venezuela Voyages blog.`,
    keywords,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.meta_description,
      images: post.cover_image ? [post.cover_image] : [],
      type: "article",
      locale: "en_VE",
      publishedTime: post.published_at,
      authors: post.author_name ? [post.author_name] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt || post.meta_description,
      images: post.cover_image ? [post.cover_image] : [],
    },
  };
}

export default async function BlogPostPage(props) {
  const params = await props.params;
  const post = await getPost(params.slug);
  if (!post) return notFound();

  const relatedPosts = await getRelatedPosts(post.category, post.id);
  const readTime = estimateReadTime(post.content);
  const postUrl = `https://venezuelavoyages.com/blog/${post.slug}`;

  return (
    <main className="min-h-screen bg-gray-50/50">
      <article className="mx-auto w-[92%] max-w-4xl pb-16 pt-8 md:pb-20">
        {/* Breadcrumb */}
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-gray-400">
          <Link href="/blog" className="transition-colors hover:text-[#0A1A44]">
            Blog
          </Link>
          {post.category && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link
                href={`/blog?category=${post.category}`}
                className="transition-colors hover:text-[#0A1A44]"
              >
                {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
              </Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="line-clamp-1 text-gray-600">{post.title}</span>
        </nav>

        {/* Cover image */}
        {post.cover_image && (
          <div className="relative mb-8 h-64 overflow-hidden rounded-2xl sm:h-80 md:h-[420px]">
            <Image
              src={post.cover_image}
              alt={post.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 896px"
            />
          </div>
        )}

        {/* Meta row */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {post.category && (
            <Link
              href={`/blog?category=${post.category}`}
              className="rounded-full bg-[#F2A93B]/15 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-[#0A1A44] transition-colors hover:bg-[#F2A93B]/25"
            >
              {post.category}
            </Link>
          )}
          {post.published_at && (
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              {formatDate(post.published_at)}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            {readTime} min read
          </span>
        </div>

        {/* Title */}
        <h1 className="mb-6 text-3xl font-extrabold leading-tight text-gray-900 sm:text-4xl lg:text-[2.75rem]">
          {post.title}
        </h1>

        {/* Author */}
        <div className="mb-8 flex items-center gap-3 border-b border-gray-100 pb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0A1A44] text-lg font-bold text-white">
            {(post.author_name || "V")[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{post.author_name || "Venezuela Voyages"}</p>
            <p className="text-xs text-gray-400">Venezuela Voyages</p>
          </div>
        </div>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="mb-8 rounded-xl border-l-4 border-[#F2A93B] bg-[#F2A93B]/5 py-4 pl-5 pr-4 text-lg italic text-gray-600">
            {post.excerpt}
          </p>
        )}

        {/* Content */}
        <div
          className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-h2:mt-10 prose-h2:text-2xl prose-h3:mt-8 prose-h3:text-xl prose-p:text-gray-700 prose-p:leading-relaxed prose-a:font-medium prose-a:text-[#0A1A44] prose-a:underline prose-a:decoration-[#F2A93B]/40 hover:prose-a:decoration-[#F2A93B] prose-blockquote:border-l-[#F2A93B] prose-blockquote:bg-gray-50 prose-blockquote:py-1 prose-blockquote:text-gray-600 prose-img:rounded-xl prose-img:shadow-md prose-table:overflow-hidden prose-table:rounded-lg prose-th:bg-[#0A1A44]/5 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-gray-100 pt-8">
            <Tag className="mr-1 h-4 w-4 text-gray-400" />
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-3.5 py-1 text-sm font-medium text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Share buttons */}
        <div className="mt-8 border-t border-gray-100 pt-8">
          <p className="mb-4 text-sm font-semibold text-gray-500">Share this article</p>
          <ShareButtons title={post.title} url={postUrl} />
        </div>

        {/* Related destination */}
        {post.destination && (
          <div className="mt-10 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-col sm:flex-row">
              {post.destination.cover_image && (
                <div className="relative h-48 sm:h-auto sm:w-1/3">
                  <Image
                    src={post.destination.cover_image}
                    alt={post.destination.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 300px"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col justify-center p-6">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#F2A93B]">
                  Destino relacionado
                </p>
                <Link
                  href={`/destinos/${post.destination.slug}`}
                  className="text-xl font-bold text-[#0A1A44] transition-colors hover:text-[#0A1A44]/80"
                >
                  {post.destination.name}
                </Link>
                <Link
                  href={`/destinos/${post.destination.slug}`}
                  className="mt-3 inline-flex w-fit items-center gap-1 text-sm font-semibold text-[#0A1A44] hover:underline"
                >
                  Ver destino <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-[#0A1A44] to-[#0A1A44]/90 p-8 text-center text-white md:p-10">
          <h2 className="text-2xl font-extrabold md:text-3xl">Ready to travel?</h2>
          <p className="mx-auto mt-3 max-w-md text-white/70">
            Let us help you plan your next adventure through Venezuela.
          </p>
          <div className="mt-6 flex justify-center">
            <DualCTA
              onlineEnabled={false}
              quoteLabel="Planificar mi viaje"
              quoteMessage="Hi, I just read an article on your blog and I'd like to plan a trip."
              trackingData={{
                interest_type: "blog_cta",
                interest_details: { post_slug: post.slug, post_title: post.title },
              }}
            />
          </div>
        </div>
      </article>

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="border-t border-gray-100 bg-white px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
              Related Articles
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.id}
                  href={`/blog/${rp.slug}`}
                  className="group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-lg"
                >
                  <div className="relative aspect-video overflow-hidden">
                    {rp.cover_image ? (
                      <Image
                        src={rp.cover_image}
                        alt={rp.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#0A1A44]/10 to-[#F2A93B]/10">
                        <Tag className="h-10 w-10 text-[#0A1A44]/20" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {rp.category && (
                      <span className="mb-2 inline-block rounded-full bg-[#F2A93B]/15 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#0A1A44]">
                        {rp.category}
                      </span>
                    )}
                    <h3 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-[#0A1A44]">
                      {rp.title}
                    </h3>
                    {rp.excerpt && (
                      <p className="line-clamp-2 text-sm text-gray-600">{rp.excerpt}</p>
                    )}
                    <p className="mt-3 text-xs text-gray-400">
                      {formatDate(rp.published_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back to blog */}
      <div className="border-t border-gray-100 bg-white py-8 text-center">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0A1A44] transition-colors hover:text-[#0A1A44]/70"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to blog
        </Link>
      </div>
    </main>
  );
}
