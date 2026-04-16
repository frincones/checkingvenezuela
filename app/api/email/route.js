/**
 * Email CRUD API
 * GET  /api/email — list emails (folder, search, starred)
 * POST /api/email — send/compose a new email
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { validateAttachmentSize } from "@/lib/email/attachmentLimits";

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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const adminClient = createAdminClient();
    let query = adminClient
      .from("emails")
      .select("id, resend_id, direction, folder, from_email, from_name, to_emails, subject, body_text, status, is_read, is_starred, thread_id, attachments, mailbox_id, created_at", { count: "exact" })
      .eq("folder", folder)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (mailboxId) {
      query = query.eq("mailbox_id", mailboxId);
    }

    if (starred === "true") {
      query = query.eq("is_starred", true);
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,from_email.ilike.%${search}%,body_text.ilike.%${search}%`);
    }

    const { data: emails, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count unread per folder (filtered by mailbox if specified)
    let unreadQuery = adminClient
      .from("emails")
      .select("folder")
      .eq("is_read", false)
      .not("folder", "eq", "trash");

    if (mailboxId) {
      unreadQuery = unreadQuery.eq("mailbox_id", mailboxId);
    }

    const { data: unreadCounts } = await unreadQuery;

    const unreadByFolder = {};
    (unreadCounts || []).forEach((e) => {
      unreadByFolder[e.folder] = (unreadByFolder[e.folder] || 0) + 1;
    });

    return NextResponse.json({
      emails: emails || [],
      total: count || 0,
      page,
      limit,
      unread: unreadByFolder,
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

    // Validate attachment sizes before sending
    if (attachments?.length) {
      const sizeCheck = validateAttachmentSize(
        attachments.map((a) => ({ size: a.content?.length || 0 })),
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
    if (attachments?.length) emailPayload.attachments = attachments;

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
