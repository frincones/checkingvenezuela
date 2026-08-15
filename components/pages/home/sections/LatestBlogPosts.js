import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/db/supabase/server";
import { Calendar, ArrowRight } from "lucide-react";
import { CATEGORY_LABELS as categoryLabels } from "@/lib/blogCategories";

async function getLatestPosts() {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("blog_posts")
      .select("id, title, slug, excerpt, cover_image, category, author_name, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3);
    return data || [];
  } catch {
    return [];
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


export async function LatestBlogPosts() {
  const posts = await getLatestPosts();
  if (!posts.length) return null;

  return (
    <section>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Blog de Viajes
          </h2>
          <p className="mt-1 text-gray-500">
            Discover destinations, tips and travel experiences
          </p>
        </div>
        <Link
          href="/blog"
          className="group hidden items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white sm:inline-flex"
        >
          View all
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-lg"
          >
            <div className="relative aspect-video overflow-hidden bg-gray-100">
              {post.cover_image ? (
                <Image
                  src={post.cover_image}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl text-gray-300">
                  VV
                </div>
              )}
              {post.category && (
                <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  {categoryLabels[post.category] || post.category}
                </span>
              )}
            </div>
            <div className="p-5">
              <h3 className="mb-2 line-clamp-2 text-lg font-bold text-gray-900 group-hover:text-primary">
                {post.title}
              </h3>
              {post.excerpt && (
                <p className="mb-3 line-clamp-2 text-sm text-gray-600">
                  {post.excerpt}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {post.author_name && <span>{post.author_name}</span>}
                {post.published_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(post.published_at)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 text-center sm:hidden">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary"
        >
          View all articles
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
