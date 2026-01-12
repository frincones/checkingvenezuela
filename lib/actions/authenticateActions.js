import { z } from "zod";
import { signIn } from "../auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function authenticateAction(prevState, formData) {
  const data = Object.fromEntries(formData);
  const loginSchema = z
    .object({
      email: z
        .string()
        .trim()
        .min(1, "Email is required")
        .email("Invalid email address"),
      password: z
        .string()
        // .regex(PASSWORD_REGEX, "Provide a stronger password")
        .min(1, "Password is required")
        .min(8, "Password must be at least 8 characters"),
    })
    .safeParse({ email: data.email, password: data.password });

  if (!loginSchema.success) {
    const errors = {};
    loginSchema.error.issues.forEach((issue) => {
      errors[issue.path[0]] = issue.message;
    });
    return { success: false, error: errors };
  }

  let isSignedIn = false;
  let redirectPath = "/dashboard";

  try {
    // Call signIn with email and password directly (Supabase format)
    const result = await signIn(loginSchema.data.email, loginSchema.data.password);

    if (result.error) {
      return {
        success: false,
        message: result.error.message || "Email or password is incorrect",
      };
    }

    isSignedIn = true;

    // Determine redirect path - always go to dashboard unless there's a specific callback
    const referer = headers().get("referer");
    if (referer) {
      const url = new URL(referer);
      const callbackPath = url.searchParams.get("callbackPath");
      // Only use callbackPath if explicitly provided and not a login/signup page
      if (callbackPath && !callbackPath.startsWith("/user/login") && !callbackPath.startsWith("/user/signup")) {
        redirectPath = callbackPath;
      }
    }

  } catch (error) {
    console.log("Login error:", error);
    isSignedIn = false;
    // Handle auth errors
    if (error?.message?.includes("Invalid") || error?.message?.includes("Credentials")) {
      return {
        success: false,
        message: "Email or password is incorrect",
      };
    }
    return { success: false, message: error?.message || "Something went wrong" };
  }

  // Redirect after successful login (outside try-catch because redirect throws)
  if (isSignedIn) {
    redirect(redirectPath);
  }

  return { success: false, message: "Something went wrong" };
}

export async function authenticateWithGoogle() {
  const { signInWithOAuth } = await import("../auth");
  const { url, error } = await signInWithOAuth("google", `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`);
  if (error || !url) {
    return { success: false, message: error?.message || "Failed to authenticate with Google" };
  }
  redirect(url);
}

export async function authenticateWithFacebook() {
  const { signInWithOAuth } = await import("../auth");
  const { url, error } = await signInWithOAuth("facebook", `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`);
  if (error || !url) {
    return { success: false, message: error?.message || "Failed to authenticate with Facebook" };
  }
  redirect(url);
}
