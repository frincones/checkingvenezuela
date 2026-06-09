/**
 * POST /api/email/bulk
 *
 * Apply an action to many emails at once. Body shape:
 *   { ids: string[], action: 'archive' | 'trash' | 'delete'
 *                          | 'mark_read' | 'mark_unread'
 *                          | 'star' | 'unstar'
 *                          | 'move',
 *     folder?: string  // required when action === 'move' }
 *
 * Returns { updated: number } on success.
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

const VALID_FOLDERS = ["inbox", "sent", "drafts", "archive", "trash"];

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    const action = body.action;

    if (!ids.length) {
      return NextResponse.json({ error: "Sin correos seleccionados" }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json(
        { error: "Máximo 200 correos por operación" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    let patch = null;
    let isDelete = false;

    switch (action) {
      case "archive":
        patch = { folder: "archive", updated_at: now };
        break;
      case "trash":
        patch = { folder: "trash", updated_at: now };
        break;
      case "delete":
        isDelete = true;
        break;
      case "mark_read":
        patch = { is_read: true, updated_at: now };
        break;
      case "mark_unread":
        patch = { is_read: false, updated_at: now };
        break;
      case "star":
        patch = { is_starred: true, updated_at: now };
        break;
      case "unstar":
        patch = { is_starred: false, updated_at: now };
        break;
      case "move": {
        const folder = body.folder;
        if (!VALID_FOLDERS.includes(folder)) {
          return NextResponse.json(
            { error: "Carpeta destino inválida" },
            { status: 400 }
          );
        }
        patch = { folder, updated_at: now };
        break;
      }
      default:
        return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
    }

    if (isDelete) {
      const { error, count } = await admin
        .from("emails")
        .delete({ count: "exact" })
        .in("id", ids);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ updated: count || 0 });
    }

    const { error, count } = await admin
      .from("emails")
      .update(patch, { count: "exact" })
      .in("id", ids);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ updated: count || 0 });
  } catch (err) {
    console.error("POST /api/email/bulk error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
