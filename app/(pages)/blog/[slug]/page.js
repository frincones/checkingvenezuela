import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/sections/Nav";
import { Footer } from "@/components/sections/Footer";
import { createAdminClient } from "@/lib/db/supabase/server";
import { auth } from "@/lib/auth";
import { Calendar, User, ArrowLeft, Tag } from "lucide-react";

async function getPost(slug) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select("*, destination:destinations(id, name, slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (error) return null;
  return data;
}

export async function generateMetadata({ params }) {
  const post = await getPost(params.slug);
  if (!post) return { title: "Post no encontrado | Venezuela Voyages" };
  return {
    title: post.meta_title || `${post.title} | Venezuela Voyages`,
    description: post.meta_description || post.excerpt || `Lee ${post.title} en el blog de Venezuela Voyages.`,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.meta_description,
      images: post.cover_image ? [post.cover_image] : [],
      type: "article",
      locale: "es_VE",
      publishedTime: post.published_at,
      authors: post.author_name ? [post.author_name] : [],
    },
  };
}

export default async function BlogPostPage({ params }) {
  const post = await getPost(params.slug);
  if (!post) return notFound();

  const session = await auth();

  return (
    <>
      <header className="relative">
        <Nav type="default" session={session} />
      </header>

      <article className="mx-auto mb-10 w-[90%] max-w-3xl pt-8 md:mb-20">
        {/* Back link */}
        <Link href="/blog" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Volver al blog
        </Link>

        {/* Header */}
        <div className="mb-8">
          {post.category && (
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
              {post.category}
            </span>
          )}
          <h1 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {post.author_name && (
              <span className="flex items-center gap-1.5"><User className="h-4 w-4" />{post.author_name}</span>
            )}
            {post.published_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(post.published_at).toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
          </div>
        </div>

        {/* Cover image */}
        {post.cover_image && (
          <div className="relative mb-10 h-64 overflow-hidden rounded-xl sm:h-80 lg:h-96">
            <Image src={post.cover_image} alt={post.title} fill className="object-cover" priority />
          </div>
        )}

        {/* Excerpt */}
        {post.excerpt && (
          <p className="mb-8 border-l-4 border-primary pl-4 text-lg italic text-gray-600">
            {post.excerpt}
          </p>
        )}

        {/* Content */}
        <div
          className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-primary prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Related destination */}
        {post.destination && (
          <div className="mt-12 rounded-xl border border-gray-100 bg-gray-50 p-6">
            <p className="mb-2 text-sm font-medium text-gray-500">Destino relacionado</p>
            <Link href={`/destinos/${post.destination.slug}`} className="text-lg font-bold text-primary hover:underline">
              {post.destination.name}
            </Link>
          </div>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                <Tag className="h-3 w-3" />{tag}
              </span>
            ))}
          </div>
        )}
      </article>

      <Footer />
    </>
  );
}
