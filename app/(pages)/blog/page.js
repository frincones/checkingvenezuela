import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/sections/Nav";
import { Footer } from "@/components/sections/Footer";
import { createAdminClient } from "@/lib/db/supabase/server";
import { auth } from "@/lib/auth";
import { Calendar, User, Tag } from "lucide-react";

export const metadata = {
  title: "Blog | Venezuela Voyages",
  description: "Lee nuestro blog de viajes. Descubre destinos, recomendaciones y tips para tus próximas aventuras con Venezuela Voyages.",
  keywords: ["blog viajes", "destinos venezuela", "recomendaciones viaje", "tips viajero", "venezuela voyages blog"],
};

export const dynamic = "force-dynamic";

async function getPublishedPosts() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image, category, author_name, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);
  return data || [];
}

export default async function BlogPage() {
  const session = await auth();
  const posts = await getPublishedPosts();

  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))];

  return (
    <>
      <header className="relative">
        <Nav type="default" session={session} />
      </header>

      <main className="mx-auto mb-10 w-[90%] max-w-6xl pt-8 md:mb-20">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Blog</h1>
          <p className="mt-2 text-lg text-gray-600">
            Descubre destinos, recomendaciones y tips para tus próximas aventuras
          </p>
        </div>

        {/* Category filters */}
        {categories.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span key={cat} className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <p className="text-xl font-medium text-gray-500">Próximamente</p>
            <p className="mt-2 text-gray-400">Estamos preparando contenido increíble para ti</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-lg">
                {post.cover_image ? (
                  <div className="relative h-48 overflow-hidden">
                    <Image src={post.cover_image} alt={post.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                    <Tag className="h-12 w-12 text-primary/30" />
                  </div>
                )}
                <div className="p-5">
                  {post.category && (
                    <span className="mb-2 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
                      {post.category}
                    </span>
                  )}
                  <h2 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-primary">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mb-4 line-clamp-2 text-sm text-gray-600">{post.excerpt}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {post.author_name && (
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{post.author_name}</span>
                    )}
                    {post.published_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.published_at).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
