/**
 * Database Utilities - Redirected to Supabase
 *
 * This file provides backwards compatibility with the MongoDB API.
 * Original MongoDB implementation has been replaced.
 */

import "server-only";

// Re-export countDocs from Supabase operations
export { countDocs } from "./supabase/operations";

// No-op function for backwards compatibility
export async function connectToDB() {
  // Supabase doesn't require explicit connection - this is a no-op
  return Promise.resolve();
}

// Utility function for backwards compatibility
// In Supabase/PostgreSQL, IDs are UUIDs (strings) so this is simpler
function stringifyObjectIdFromObj(object) {
  // With Supabase, IDs are already strings (UUIDs), so we just return the object
  return object;
}

// Utility function for backwards compatibility
// In PostgreSQL/Supabase, we use UUIDs as strings
function strToObjectId(str) {
  // UUIDs are already strings, just validate format
  if (typeof str === "string" && str.length > 0) {
    return str;
  }
  return null;
}

export { stringifyObjectIdFromObj, strToObjectId };
