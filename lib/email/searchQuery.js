/**
 * Parse Gmail / Outlook-style search syntax into structured filters that
 * the email list endpoint can apply.
 *
 * Supported operators:
 *   from:foo@bar.com   (substring match against from_email)
 *   to:foo@bar.com     (substring match against any to_emails[].email)
 *   subject:texto      (substring match against subject)
 *   has:attachment     (boolean filter)
 *   is:unread          (boolean filter)
 *   is:starred         (boolean filter)
 *   before:2026-06-01  (created_at <)
 *   after:2026-06-01   (created_at >)
 *
 * Anything not matching an operator becomes a free-text term applied to
 * subject + body_text + from_email.
 */

const OPERATOR_RE = /(from|to|subject|has|is|before|after):("(?:[^"\\]|\\.)*"|\S+)/gi;

export function parseSearchQuery(input) {
  const filters = {
    from: [],
    to: [],
    subjectContains: [],
    free: [],
    hasAttachment: undefined,
    isUnread: undefined,
    isStarred: undefined,
    before: undefined,
    after: undefined,
  };

  if (!input || !input.trim()) return filters;

  let consumed = "";
  let m;
  OPERATOR_RE.lastIndex = 0;
  while ((m = OPERATOR_RE.exec(input)) !== null) {
    consumed += input.slice(consumed.length, m.index);
    const [, key, rawValue] = m;
    const value = rawValue.replace(/^"|"$/g, "");
    switch (key.toLowerCase()) {
      case "from":
        filters.from.push(value);
        break;
      case "to":
        filters.to.push(value);
        break;
      case "subject":
        filters.subjectContains.push(value);
        break;
      case "has":
        if (value.toLowerCase() === "attachment") filters.hasAttachment = true;
        break;
      case "is":
        if (value.toLowerCase() === "unread") filters.isUnread = true;
        else if (value.toLowerCase() === "read") filters.isUnread = false;
        else if (value.toLowerCase() === "starred") filters.isStarred = true;
        break;
      case "before": {
        const d = new Date(value);
        if (!isNaN(d.getTime())) filters.before = d.toISOString();
        break;
      }
      case "after": {
        const d = new Date(value);
        if (!isNaN(d.getTime())) filters.after = d.toISOString();
        break;
      }
      default:
        break;
    }
    consumed += m[0];
  }
  // Remaining unconsumed text → free-text terms
  consumed += input.slice(consumed.length);
  // Actually, consumed at this point is the same as input; rebuild from the
  // matches the user actually wrote.
  const free = input
    .replace(OPERATOR_RE, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  filters.free = free;
  return filters;
}

/** Apply parsed filters to a Supabase query builder. Returns the builder. */
export function applyFiltersToQuery(query, filters) {
  for (const f of filters.from || []) {
    query = query.ilike("from_email", `%${f}%`);
  }
  for (const s of filters.subjectContains || []) {
    query = query.ilike("subject", `%${s}%`);
  }
  if (filters.hasAttachment === true) {
    // attachments JSONB column. We approximate "has at least 1 attachment"
    // by checking the text representation contains a filename marker.
    query = query.not("attachments", "eq", "[]");
  }
  if (filters.isUnread === true) {
    query = query.eq("is_read", false);
  } else if (filters.isUnread === false) {
    query = query.eq("is_read", true);
  }
  if (filters.isStarred === true) {
    query = query.eq("is_starred", true);
  }
  if (filters.before) {
    query = query.lt("created_at", filters.before);
  }
  if (filters.after) {
    query = query.gte("created_at", filters.after);
  }
  // free-text → OR across subject, body_text, from_email
  if (filters.free?.length) {
    const term = filters.free.join(" ").replace(/[,()]/g, "");
    query = query.or(
      `subject.ilike.%${term}%,from_email.ilike.%${term}%,body_text.ilike.%${term}%`
    );
  }
  // `to:` filter: search through JSONB to_emails array. PostgREST doesn't
  // expose a clean operator for "contains object where email matches", so
  // we cast the JSONB to text and ilike against it. Acceptable for the
  // table size; would replace with a generated column if scale demanded.
  for (const t of filters.to || []) {
    query = query.ilike("to_emails::text", `%${t}%`);
  }
  return query;
}
