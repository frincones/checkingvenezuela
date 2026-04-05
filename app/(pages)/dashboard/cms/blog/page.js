"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, Eye, Search } from "lucide-react";

const inputCls = "block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm";

export default function BlogListPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  const categories = useMemo(() => {
    const cats = new Set(posts.map((p) => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (search && !post.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      if (categoryFilter !== "all" && post.category !== categoryFilter) return false;
      return true;
    });
  }, [posts, search, statusFilter, categoryFilter]);

  const statusColors = {
    draft: "bg-yellow-100 text-yellow-700",
    published: "bg-green-100 text-green-700",
    archived: "bg-gray-100 text-gray-600",
  };

  const categoryLabels = {
    general: "General",
    destinos: "Destinos",
    recomendaciones: "Recomendaciones",
    tips: "Tips de viaje",
    noticias: "Noticias",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
        <Link href="/dashboard/cms/blog/new" className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nuevo Post
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por titulo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
          <option value="all">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputCls}>
          <option value="all">Todas las categorias</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Cargando...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-center">
          <p className="text-gray-500">
            {posts.length === 0 ? "No hay posts todavia" : "No se encontraron posts con los filtros actuales"}
          </p>
          {posts.length === 0 && (
            <Link href="/dashboard/cms/blog/new" className="mt-3 text-sm font-medium text-primary hover:underline">Crear el primer post</Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Titulo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{post.title}</div>
                    <div className="text-xs text-gray-400">/{post.slug}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{categoryLabels[post.category] || post.category}</td>
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
