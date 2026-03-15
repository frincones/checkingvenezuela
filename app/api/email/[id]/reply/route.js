/**
 * Reply to an email
 * POST /api/email/[id]/reply
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "ventas@venezuelavoyages.com";

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const adminClient = createAdminClient();

    // Get original email
    const { data: original, error: origError } = await adminClient
      .from("emails")
      .select("*")
      .eq("id", id)
      .single();

    if (origError || !original) {
      return NextResponse.json({ error: "Email original no encontrado" }, { status: 404 });
    }

    // Determine reply recipient
    const replyTo = original.direction === "inbound"
      ? original.from_email
      : original.to_emails?.[0]?.email;

    if (!replyTo) {
      return NextResponse.json({ error: "No se pudo determinar el destinatario" }, { status: 400 });
    }

    const subject = original.subject?.startsWith("Re: ")
      ? original.subject
      : `Re: ${original.subject || "(Sin asunto)"}`;

    const threadId = original.thread_id || original.id;

    // Build reply HTML with quoted original
    const replyHtml = `
      <div>${body.html || body.text || ""}</div>
      <br/>
      <div style="border-left:2px solid #ccc;padding-left:12px;margin-top:16px;color:#666;">
        <p style="font-size:12px;margin:0 0 8px;">
          El ${new Date(original.created_at).toLocaleString("es-VE")} &lt;${original.from_email}&gt; escribió:
        </p>
        ${original.body_html || `<p>${original.body_text || ""}</p>`}
      </div>
    `;

    // Determine all recipients for reply-all
    const toList = body.replyAll
      ? [replyTo, ...(original.cc || []).filter((e) => e !== FROM_EMAIL)]
      : [replyTo];

    // Send via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `Venezuela Voyages <${FROM_EMAIL}>`,
      to: toList,
      subject,
      html: replyHtml,
      headers: {
        "In-Reply-To": original.message_id || "",
        References: original.message_id || "",
      },
    });

    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 500 });
    }

    // Save reply to DB
    const { data: saved } = await adminClient
      .from("emails")
      .insert({
        resend_id: emailData?.id,
        direction: "outbound",
        folder: "sent",
        from_email: FROM_EMAIL,
        from_name: "Venezuela Voyages",
        to_emails: toList.map((e) => ({ email: e })),
        subject,
        body_html: replyHtml,
        body_text: body.text || "",
        status: "sent",
        is_read: true,
        thread_id: threadId,
        in_reply_to: original.message_id || null,
      })
      .select("id")
      .single();

    return NextResponse.json({
      success: true,
      id: saved?.id,
      resend_id: emailData?.id,
    });
  } catch (error) {
    console.error("POST /api/email/[id]/reply error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
