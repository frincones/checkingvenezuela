/**
 * Email CRUD API
 * GET  /api/email — list emails (folder, search, starred)
 * POST /api/email — send/compose a new email
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { validateAttachmentSize } from "@/lib/email/attachmentLimits";
import { parseSearchQuery, applyFiltersToQuery } from "@/lib/email/searchQuery";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "ventas@venezuelavoyages.com";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "inbox";
    const search = searchParams.get("search") || "";
    const starred = searchParams.get("starred");
    const mailboxId = searchParams.get("mailbox_id");
    const labelId = searchParams.get("label_id");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const adminClient = createAdminClient();
    let query = adminClient
      .from("emails")
      // `body_text` se pide aqui SOLO para el fragmento de vista previa de la
      // lista (EmailList.jsx usa los primeros 100 caracteres). Se recorta mas
      // abajo, antes de responder, porque devolver el cuerpo entero de 50
      // correos cada 30 s fue lo que agoto la cuota de egress de Supabase
      // (6,65 GB de 5,5 GB el 2026-11-27).
      //
      // No se puede quitar de este SELECT: la busqueda de texto libre filtra
      // con `body_text.ilike` (lib/email/searchQuery.js). Ese filtro es un
      // WHERE en Postgres y funcionaria igual sin la columna, pero el recorte
      // en servidor es lo que evita mandarla por la red al navegador.
      .select("id, resend_id, direction, folder, from_email, from_name, to_emails, subject, body_text, status, is_read, is_starred, thread_id, attachments, mailbox_id, created_at", { count: "exact" })
      .eq("folder", folder)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (mailboxId === "unassigned") {
      query = query.is("mailbox_id", null);
    } else if (mailboxId) {
      query = query.eq("mailbox_id", mailboxId);
    }

    // Filter by label (looks at the join table)
    if (labelId) {
      const { data: linkedRows } = await adminClient
        .from("email_label_links")
        .select("email_id")
        .eq("label_id", labelId);
      const allowedIds = (linkedRows || []).map((r) => r.email_id);
      if (allowedIds.length === 0) {
        return NextResponse.json({ emails: [], total: 0, page, limit, unread: {}, hasUnassigned: false });
      }
      query = query.in("id", allowedIds);
    }

    if (starred === "true") {
      query = query.eq("is_starred", true);
    }

    if (search) {
      // Gmail-style operators: from:foo to:bar subject:"hello world"
      // has:attachment is:unread is:starred before:YYYY-MM-DD after:YYYY-MM-DD
      // Anything else is free-text and OR'd across subject/from_email/body_text.
      const filters = parseSearchQuery(search);
      query = applyFiltersToQuery(query, filters);
    }

    const { data: emails, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // No-leidos por carpeta.
    //
    // Antes esto descargaba UNA FILA POR CADA correo no leido (solo la columna
    // `folder`) y las contaba en JavaScript. Con la bandeja recargandose cada
    // 30 s, eso es trafico que crece con el numero de no leidos y que no hacia
    // falta: Postgres sabe contar.
    //
    // Ahora se pide un `count` con `head: true`, que NO devuelve filas, solo la
    // cifra en la cabecera Content-Range. El resultado es identico: un objeto
    // { carpeta: numero } con las mismas claves que antes.
    //
    // Se excluye `trash`, igual que la version anterior. Una carpeta sin no
    // leidos simplemente no aparece en el objeto, que es como se comportaba
    // antes y lo que EmailSidebar ya maneja (`unread?.[f.key] || 0`).
    const UNREAD_FOLDERS = ["inbox", "sent", "drafts", "archive"];

    const unreadEntries = await Promise.all(
      UNREAD_FOLDERS.map(async (f) => {
        let q = adminClient
          .from("emails")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false)
          .eq("folder", f);

        if (mailboxId === "unassigned") {
          q = q.is("mailbox_id", null);
        } else if (mailboxId) {
          q = q.eq("mailbox_id", mailboxId);
        }

        const { count: c } = await q;
        return [f, c || 0];
      }),
    );

    const unreadByFolder = {};
    for (const [folderKey, c] of unreadEntries) {
      if (c > 0) unreadByFolder[folderKey] = c;
    }

    // Does the user have any inbound row without a mailbox? Used to surface
    // the "Sin asignar" option in the dropdown only when relevant.
    const { count: unassignedCount } = await adminClient
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .is("mailbox_id", null);

    // Recorte del cuerpo antes de responder.
    //
    // La lista solo pinta los primeros 100 caracteres (getPreview en
    // EmailList.jsx). Mandar el cuerpo completo de 50 correos, cada 30 s y por
    // cada pestana abierta, consumia del orden de 1 GB al dia.
    //
    // Se recortan 200 y no 100 para dejar margen si algun dia el fragmento se
    // alarga, y porque `EmailView` NO usa estos datos: al abrir un correo se
    // pide /api/email/[id], que hace `select("*")` y sigue trayendo el cuerpo
    // entero. Responder y reenviar tambien parten de ahi, asi que no se
    // pierde nada.
    const PREVIEW_CHARS = 200;
    const trimmed = (emails || []).map((e) =>
      typeof e.body_text === "string" && e.body_text.length > PREVIEW_CHARS
        ? { ...e, body_text: e.body_text.slice(0, PREVIEW_CHARS) }
        : e,
    );

    return NextResponse.json({
      emails: trimmed,
      total: count || 0,
      page,
      limit,
      unread: unreadByFolder,
      hasUnassigned: (unassignedCount || 0) > 0,
    });
  } catch (error) {
    console.error("GET /api/email error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { to, cc, bcc, subject, html, text, reply_to, attachments, isDraft, from_address } = body;

    if (!isDraft && (!to || to.length === 0)) {
      return NextResponse.json({ error: "Destinatario requerido" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const toEmails = (Array.isArray(to) ? to : [to]).map((e) =>
      typeof e === "string" ? { email: e } : e
    );

    // Resolve mailbox for the sender address
    const senderAddress = from_address || FROM_EMAIL;
    let mailboxId = null;
    let senderDisplayName = "Venezuela Voyages";
    const { data: mailbox } = await adminClient
      .from("mailboxes")
      .select("id, display_name")
      .eq("address", senderAddress)
      .single();
    if (mailbox) {
      mailboxId = mailbox.id;
      senderDisplayName = mailbox.display_name || "Venezuela Voyages";
    }

    // Save as draft
    if (isDraft) {
      const { data: draft, error: draftError } = await adminClient
        .from("emails")
        .insert({
          direction: "outbound",
          folder: "drafts",
          from_email: senderAddress,
          from_name: senderDisplayName,
          to_emails: toEmails,
          cc: cc || [],
          bcc: bcc || [],
          subject: subject || "",
          body_html: html || "",
          body_text: text || "",
          status: "draft",
          is_read: true,
          mailbox_id: mailboxId,
        })
        .select("id")
        .single();

      if (draftError) {
        return NextResponse.json({ error: draftError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, id: draft.id, isDraft: true });
    }

    // Validate attachment sizes before sending.
    // `content` is a base64 string, so the binary size is ~length * 3/4.
    if (attachments?.length) {
      const sizeCheck = validateAttachmentSize(
        attachments.map((a) => ({
          size: Math.ceil(((a.content?.length || 0) * 3) / 4),
        })),
        "resend"
      );
      if (!sizeCheck.ok) {
        return NextResponse.json({ error: sizeCheck.error }, { status: 413 });
      }
    }

    // Send via Resend
    const emailPayload = {
      from: `${senderDisplayName} <${senderAddress}>`,
      to: toEmails.map((e) => e.email),
      subject: subject || "(Sin asunto)",
      html: html || text || "",
    };

    if (cc?.length) emailPayload.cc = cc;
    if (bcc?.length) emailPayload.bcc = bcc;
    if (reply_to) emailPayload.reply_to = reply_to;
    if (attachments?.length) {
      // Normalize attachment shape: Resend expects { filename, content, content_type? }
      emailPayload.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        ...(a.type ? { content_type: a.type } : {}),
      }));
    }

    const { data: emailData, error: emailError } = await getResend().emails.send(emailPayload);

    if (emailError) {
      const msg = emailError.message || "";
      const isSize = /size|too large|payload|limit/i.test(msg);
      return NextResponse.json(
        { error: isSize
            ? "El correo excede el límite de tamaño permitido por el proveedor. Reduce el tamaño de los adjuntos."
            : `Error al enviar email: ${msg}` },
        { status: isSize ? 413 : 500 }
      );
    }

    // Save to DB
    const { data: saved } = await adminClient
      .from("emails")
      .insert({
        resend_id: emailData?.id,
        direction: "outbound",
        folder: "sent",
        from_email: senderAddress,
        from_name: senderDisplayName,
        mailbox_id: mailboxId,
        to_emails: toEmails,
        cc: cc || [],
        bcc: bcc || [],
        subject: subject || "(Sin asunto)",
        body_html: html || "",
        body_text: text || "",
        status: "sent",
        is_read: true,
        reply_to: reply_to || null,
        in_reply_to: body.in_reply_to || null,
        thread_id: body.thread_id || null,
        attachments: (attachments || []).map((a) => ({
          filename: a.filename,
          size: a.content?.length || 0,
          content_type: a.type || "application/octet-stream",
        })),
      })
      .select("id")
      .single();

    return NextResponse.json({
      success: true,
      id: saved?.id,
      resend_id: emailData?.id,
    });
  } catch (error) {
    console.error("POST /api/email error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
