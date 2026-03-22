"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";

export default function BlogListPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    try {
      const res = await fetch("/api/cms/blog");
      const data = await res.json();
      if (!data.error) setPosts(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function deletePost(id) {
    if (!confirm("¿Eliminar este post?")) return;
    await fetch(`/api/cms/blog/${id}`, { method: "DELETE" });
    fetchPosts();
  }

  const statusColors = {
    draft: "bg-yellow-100 text-yellow-700",
    published: "bg-green-100 text-green-700",
    archived: "bg-gray-100 text-gray-600",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
        <Link href="/dashboard/cms/blog/new" className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nuevo Post
        </Link>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Cargando...</div>
      ) : posts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-center">
          <p className="text-gray-500">No hay posts todavía</p>
          <Link href="/dashboard/cms/blog/new" className="mt-3 text-sm font-medium text-primary hover:underline">Crear el primer post</Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Título</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{post.title}</div>
                    <div className="text-xs text-gray-400">/{post.slug}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{post.category}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[post.status] || statusColors.draft}`}>
                      {post.status === "published" ? "Publicado" : post.status === "archived" ? "Archivado" : "Borrador"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(post.created_at).toLocaleDateString("es-VE")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {post.status === "published" && (
                        <Link href={`/blog/${post.slug}`} target="_blank" className="rounded p-1.5 text-gray-400 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                      )}
                      <Link href={`/dashboard/cms/blog/${post.id}`} className="rounded p-1.5 text-gray-400 hover:text-primary"><Edit className="h-4 w-4" /></Link>
                      <button onClick={() => deletePost(post.id)} className="rounded p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
