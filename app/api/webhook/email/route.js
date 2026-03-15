/**
 * Webhook endpoint para Resend events (inbound + tracking)
 * POST /api/webhook/email
 */

import { createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function verifyWebhook(request, body) {
  if (!WEBHOOK_SECRET) return true; // skip verification in dev
  const wh = new Webhook(WEBHOOK_SECRET);
  const headers = {
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  };
  try {
    wh.verify(body, headers);
    return true;
  } catch {
    return false;
  }
}

async function fetchReceivedEmail(emailId) {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchAttachments(emailId) {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}/attachments`,
    { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export async function POST(request) {
  try {
    const rawBody = await request.text();

    if (!(await verifyWebhook(request, rawBody))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const { type, data } = event;
    const supabase = createAdminClient();

    switch (type) {
      case "email.received": {
        // Fetch full email content from Resend
        const emailId = data.email_id || data.id;
        const [fullEmail, attachments] = await Promise.all([
          fetchReceivedEmail(emailId),
          fetchAttachments(emailId),
        ]);

        const toEmails = Array.isArray(data.to)
          ? data.to.map((e) => (typeof e === "string" ? { email: e } : e))
          : [{ email: data.to }];

        // Check if this is a reply to an existing thread
        let threadId = null;
        if (fullEmail?.in_reply_to) {
          const { data: parent } = await supabase
            .from("emails")
            .select("thread_id, id")
            .eq("message_id", fullEmail.in_reply_to)
            .single();
          if (parent) {
            threadId = parent.thread_id || parent.id;
          }
        }

        const attachmentsMeta = attachments.map((a) => ({
          filename: a.filename,
          size: a.size,
          content_type: a.content_type,
          url: a.download_url,
        }));

        await supabase.from("emails").insert({
          resend_id: emailId,
          direction: "inbound",
          folder: "inbox",
          from_email: data.from || fullEmail?.from,
          from_name: data.from_name || null,
          to_emails: toEmails,
          cc: fullEmail?.cc || [],
          subject: data.subject || fullEmail?.subject,
          body_html: fullEmail?.html || null,
          body_text: fullEmail?.text || null,
          attachments: attachmentsMeta,
          status: "delivered",
          is_read: false,
          thread_id: threadId,
          in_reply_to: fullEmail?.in_reply_to || null,
          message_id: fullEmail?.message_id || null,
        });
        break;
      }

      case "email.delivered":
      case "email.bounced":
      case "email.opened": {
        const statusMap = {
          "email.delivered": "delivered",
          "email.bounced": "bounced",
          "email.opened": "opened",
        };
        const emailId = data.email_id || data.id;
        if (emailId) {
          await supabase
            .from("emails")
            .update({ status: statusMap[type], updated_at: new Date().toISOString() })
            .eq("resend_id", emailId);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
