import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("destinations")
      .select("id, name, slug, description, image_url")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching destinations:", error);
      return NextResponse.json({ error: "Error al obtener destinos" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Error in GET destinations:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
