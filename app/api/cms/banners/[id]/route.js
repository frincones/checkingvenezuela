import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("banners")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: "Banner no encontrado" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const admin = createAdminClient();

    const allowedFields = [
      "title", "subtitle", "image_url", "link_url", "link_label",
      "badge_text", "position", "background_color", "display_order",
      "is_active", "starts_at", "ends_at",
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("banners")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Invalida la cache de las paginas que muestran banners.
    // Sin esto, una edicion en el CMS no se veria hasta que expirase
    // el TTL de la pagina, y el editor creeria que no se guardo.
    revalidatePath("/");
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { error } = await admin.from("banners").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Tambien al BORRAR: la pagina sigue mostrando el elemento
    // eliminado hasta que se invalide la cache.
    revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
