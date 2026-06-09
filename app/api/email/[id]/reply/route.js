/**
 * Reply to an email
 * POST /api/email/[id]/reply
 *
 * Accepts the FULL edited payload from the composer (to/cc/bcc/attachments/
 * from_address) because the user may have changed recipients before sending.
 * Falls back to deriving sensible defaults from the original email when
 * fields are omitted.
 *
 * Threading: always emits a valid In-Reply-To / References header. If the
 * original row has no message_id (outbound emails sent before we tracked
 * it), we synthesize one from the resend_id so external clients (Gmail,
 * Outlook) still group the conversation.
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "ventas@venezuelavoyages.com";
const DOMAIN = "venezuelavoyages.com";

function normalizeAddr(e) {
  if (!e) return null;
  if (typeof e === "string") return e.trim().toLowerCase();
  return (e.email || "").trim().toLowerCase();
}

function dedupAddrs(list, exclude = []) {
  const ex = new Set(exclude.map(normalizeAddr).filter(Boolean));
  const seen = new Set();
  const out = [];
  for (const e of list) {
    const a = normalizeAddr(e);
    if (!a || ex.has(a) || seen.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out;
}

function buildMessageId(original) {
  if (original.message_id) return original.message_id;
  if (original.resend_id) return `<${original.resend_id}@${DOMAIN}>`;
  return `<${original.id}@${DOMAIN}>`;
}

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
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

    const fromAddress = body.from_address || FROM_EMAIL;

    // Determine primary recipient. Honor user override; otherwise default
    // by direction (inbound→sender, outbound→original recipient).
    const userTo = Array.isArray(body.to) ? body.to.filter(Boolean) : [];
    let primaryTo = userTo[0];
    if (!primaryTo) {
      primaryTo =
        original.direction === "outbound"
          ? normalizeAddr(original.to_emails?.[0])
          : original.from_email;
    }
    if (!primaryTo) {
      return NextResponse.json(
        { error: "No se pudo determinar el destinatario" },
        { status: 400 }
      );
    }

    // Build final To/Cc lists.
    let toList = userTo.length ? userTo : [primaryTo];
    let ccList = Array.isArray(body.cc) ? body.cc.filter(Boolean) : [];
    const bccList = Array.isArray(body.bcc) ? body.bcc.filter(Boolean) : [];

    // Reply-all: if the composer didn't already include the original
    // participants in TO/CC, add them now to the CC line (deduped,
    // excluding ourselves and the primary recipient).
    if (body.replyAll) {
      const originalAll = [
        ...(Array.isArray(original.to_emails) ? original.to_emails : []),
        ...(Array.isArray(original.cc) ? original.cc : []),
      ];
      if (original.direction !== "outbound" && original.from_email) {
        // Inbound: original sender is the primary, already in toList
      }
      const extras = dedupAddrs(originalAll, [primaryTo, fromAddress, ...toList, ...ccList]);
      ccList = [...ccList, ...extras];
    }

    toList = dedupAddrs(toList);
    ccList = dedupAddrs(ccList, toList);

    const subject = original.subject?.startsWith("Re: ")
      ? original.subject
      : `Re: ${original.subject || "(Sin asunto)"}`;

    const threadId = original.thread_id || original.id;
    const originalMsgId = buildMessageId(original);

    // Build reply HTML with quoted original (only when composer didn't already
    // include one — the rich editor usually does).
    const replyHtml =
      body.html ||
      `<div>${body.text || ""}</div>
       <br/>
       <div style="border-left:2px solid #ccc;padding-left:12px;margin-top:16px;color:#666;">
         <p style="font-size:12px;margin:0 0 8px;">
           El ${new Date(original.created_at).toLocaleString("es-VE")} &lt;${original.from_email}&gt; escribió:
         </p>
         ${original.body_html || `<p>${original.body_text || ""}</p>`}
       </div>`;

    // Build attachments payload if present
    const attachments = Array.isArray(body.attachments) ? body.attachments : undefined;

    // Send via Resend
    const sendPayload = {
      from: `Venezuela Voyages <${fromAddress}>`,
      to: toList,
      subject,
      html: replyHtml,
      headers: {
        "In-Reply-To": originalMsgId,
        References: original.in_reply_to
          ? `${original.in_reply_to} ${originalMsgId}`
          : originalMsgId,
      },
    };
    if (ccList.length) sendPayload.cc = ccList;
    if (bccList.length) sendPayload.bcc = bccList;
    if (attachments?.length) sendPayload.attachments = attachments;

    const { data: emailData, error: emailError } = await getResend().emails.send(sendPayload);

    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 500 });
    }

    // Save reply to DB. attachments stored as metadata only (the bytes were
    // sent inline to Resend, not persisted in our bucket).
    const attMeta =
      attachments?.map((a) => ({
        filename: a.filename,
        content_type: a.type || "application/octet-stream",
        size: a.content
          ? Math.floor((a.content.length * 3) / 4) // approx from base64
          : null,
      })) || [];

    const { data: saved } = await adminClient
      .from("emails")
      .insert({
        resend_id: emailData?.id,
        direction: "outbound",
        folder: "sent",
        from_email: fromAddress,
        from_name: "Venezuela Voyages",
        to_emails: toList.map((e) => ({ email: e })),
        cc: ccList.map((e) => ({ email: e })),
        bcc: bccList.map((e) => ({ email: e })),
        subject,
        body_html: replyHtml,
        body_text: body.text || "",
        attachments: attMeta,
        status: "sent",
        is_read: true,
        thread_id: threadId,
        in_reply_to: originalMsgId,
      })
      .select("id")
      .single();

    return NextResponse.json({
      success: true,
      id: saved?.id,
      resend_id: emailData?.id,
      to: toList,
      cc: ccList,
    });
  } catch (error) {
    console.error("POST /api/email/[id]/reply error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
