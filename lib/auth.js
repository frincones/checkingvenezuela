/**
 * Authentication Module
 *
 * This file exports authentication functions using Supabase Auth.
 * Provides backwards compatibility with the previous NextAuth API.
 */

import {
  auth as supabaseAuth,
  isLoggedIn as supabaseIsLoggedIn,
  signInWithEmail,
  signUpWithEmail,
  signInWithOAuth,
  signOut as supabaseSignOut,
  getCurrentUserProfile,
  updateProfile,
  resetPassword,
  updatePassword,
  deleteAccount,
  requireAuth,
  handlers as supabaseHandlers,
} from "./auth-supabase";

// Re-export with compatible names
export const auth = supabaseAuth;
export const isLoggedIn = supabaseIsLoggedIn;
export const signIn = signInWithEmail;
export const signOut = supabaseSignOut;
export const handlers = supabaseHandlers;

// Additional exports for Supabase-specific functionality
export {
  signUpWithEmail,
  signInWithOAuth,
  getCurrentUserProfile,
  updateProfile,
  resetPassword,
  updatePassword,
  deleteAccount,
  requireAuth,
};
