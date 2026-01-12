import { createClient as createServerSupabaseClient, createAdminClient } from "./db/supabase/server";
import { createClient as createBrowserSupabaseClient } from "./db/supabase/client";
import { redirect } from "next/navigation";
import routes from "@/data/routes.json";

/**
 * Get the current authenticated user (server-side)
 * Returns a session object compatible with NextAuth format for backwards compatibility
 * @returns {Promise<{user: object|null}|null>}
 */
export async function auth() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Return in NextAuth-compatible format: session.user.id, session.user.email, etc.
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.first_name
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
          : user.email,
        image: user.user_metadata?.avatar_url || null,
        emailVerified: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
        ...user.user_metadata,
      },
      expires: user.updated_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
}

/**
 * Check if user is logged in (server-side)
 * @returns {Promise<boolean>}
 */
export async function isLoggedIn() {
  const session = await auth();
  return !!session?.user;
}

/**
 * Get the current user's profile (server-side)
 * @returns {Promise<object|null>}
 */
export async function getCurrentUserProfile() {
  const session = await auth();
  if (!session?.user) return null;

  const supabase = await createServerSupabaseClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return profile;
}

/**
 * Sign in with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object|null, error: object|null}>}
 */
export async function signInWithEmail(email, password) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, session: data.session, error: null };
}

/**
 * Sign up with email and password
 * @param {object} userData - { email, password, firstName, lastName }
 * @returns {Promise<{user: object|null, error: object|null}>}
 */
export async function signUpWithEmail({ email, password, firstName, lastName }) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, session: data.session, error: null };
}

/**
 * Sign in with OAuth provider (Google, Facebook, Apple)
 * @param {string} provider - 'google' | 'facebook' | 'apple'
 * @param {string} redirectTo - URL to redirect after auth
 * @returns {Promise<{url: string|null, error: object|null}>}
 */
export async function signInWithOAuth(provider, redirectTo) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { url: null, error };
  }

  return { url: data.url, error: null };
}

/**
 * Sign out the current user
 * @returns {Promise<{error: object|null}>}
 */
export async function signOut() {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Send password reset email
 * @param {string} email
 * @returns {Promise<{error: object|null}>}
 */
export async function resetPassword(email) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/reset-password`,
  });

  return { error };
}

/**
 * Update user password
 * @param {string} newPassword
 * @returns {Promise<{error: object|null}>}
 */
export async function updatePassword(newPassword) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  return { error };
}

/**
 * Update user profile
 * @param {object} profileData
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function updateProfile(profileData) {
  const session = await auth();
  if (!session?.user) {
    return { data: null, error: { message: "Not authenticated" } };
  }

  const supabase = await createServerSupabaseClient();
  const user = session.user;

  // Convert camelCase to snake_case for database
  const snakeCaseData = {};
  for (const [key, value] of Object.entries(profileData)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    snakeCaseData[snakeKey] = value;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(snakeCaseData)
    .eq("id", user.id)
    .select()
    .single();

  return { data, error };
}

/**
 * Delete user account
 * @returns {Promise<{error: object|null}>}
 */
export async function deleteAccount() {
  const session = await auth();
  if (!session?.user) {
    return { error: { message: "Not authenticated" } };
  }

  const supabase = createAdminClient();

  // Delete user from auth (this will cascade delete profile due to RLS)
  const { error } = await supabase.auth.admin.deleteUser(session.user.id);

  return { error };
}

/**
 * Verify email with token
 * @param {string} token
 * @param {string} type - 'signup' | 'email_change'
 * @returns {Promise<{error: object|null}>}
 */
export async function verifyEmail(token, type = "signup") {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: type === "signup" ? "signup" : "email_change",
  });

  return { error };
}

/**
 * Get user by ID (admin only)
 * @param {string} userId
 * @returns {Promise<{user: object|null, error: object|null}>}
 */
export async function getUserById(userId) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use in server components/actions
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect(routes.login.path);
  }

  return session.user;
}

/**
 * Get auth handlers for API routes
 */
export const handlers = {
  GET: async (request) => {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    return Response.json({ session });
  },
  POST: async (request) => {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case "signIn":
        return Response.json(await signInWithEmail(params.email, params.password));
      case "signUp":
        return Response.json(await signUpWithEmail(params));
      case "signOut":
        return Response.json(await signOut());
      case "resetPassword":
        return Response.json(await resetPassword(params.email));
      default:
        return Response.json({ error: { message: "Invalid action" } }, { status: 400 });
    }
  },
};

// Re-export for compatibility
export { signInWithEmail as signIn };
