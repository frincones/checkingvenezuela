import { createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let email;

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      email = formData.get("email");
    } else {
      const body = await request.json();
      email = body.email;
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      // Redirect back with error for form submissions
      return NextResponse.redirect(new URL("/blog?subscribed=error", request.url), 303);
    }

    const admin = createAdminClient();

    // Check if already subscribed
    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.redirect(new URL("/blog?subscribed=already", request.url), 303);
    }

    // Insert subscription
    await admin.from("subscriptions").insert({
      email: email.trim().toLowerCase(),
      source: "blog_sidebar",
      created_at: new Date().toISOString(),
    });

    return NextResponse.redirect(new URL("/blog?subscribed=success", request.url), 303);
  } catch (error) {
    console.error("Blog subscribe error:", error);
    return NextResponse.redirect(new URL("/blog?subscribed=error", request.url), 303);
  }
}
