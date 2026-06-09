"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Recipient input with autocompletion against /api/email/contacts.
 *
 * Renders a free-form text input (comma-separated emails — backward compatible
 * with how the composer already parses recipients). As the user types the
 * last token, suggests matching contacts. Keyboard: ↓↑ navigate, Enter or
 * Tab to accept, Esc to dismiss.
 *
 * Doesn't manage the parent state — exposes value/onChange just like a
 * native input. Drop-in replacement for the previous <input>.
 */
export default function RecipientInput({ value, onChange, placeholder, onFocus, onBlur }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Derive the "current token" — the substring the user is editing after
  // the last comma — and trigger a lookup for it.
  useEffect(() => {
    const lastComma = value.lastIndexOf(",");
    const token = (lastComma >= 0 ? value.slice(lastComma + 1) : value).trim();
    if (token.length < 1) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const tid = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/email/contacts?q=${encodeURIComponent(token)}&limit=8`
        );
        const data = await res.json();
        if (!cancelled) {
          // Filter out anything already in `value` to avoid suggesting dups
          const already = new Set(
            value
              .split(",")
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean)
          );
          const filtered = (data.contacts || []).filter(
            (c) => !already.has(c.email)
          );
          setSuggestions(filtered);
          setHighlighted(0);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [value]);

  // Click outside closes the dropdown
  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function applySuggestion(s) {
    const lastComma = value.lastIndexOf(",");
    const prefix = lastComma >= 0 ? value.slice(0, lastComma + 1) + " " : "";
    onChange(`${prefix}${s.email}, `);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      applySuggestion(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          onFocus?.();
        }}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "email@ejemplo.com"}
        className="w-full outline-none text-sm bg-transparent"
        autoComplete="off"
      />
      {showDropdown && (
        <ul
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.email}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => {
                e.preventDefault();
                applySuggestion(s);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between gap-3 ${
                i === highlighted ? "bg-[#0A1A44]/10" : "hover:bg-gray-50"
              }`}
            >
              <div className="min-w-0">
                {s.name && (
                  <div className="font-medium text-gray-800 truncate">{s.name}</div>
                )}
                <div className={`truncate ${s.name ? "text-xs text-gray-500" : "text-gray-700"}`}>
                  {s.email}
                </div>
              </div>
              <span
                className={`text-[10px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded ${
                  s.source === "mailbox"
                    ? "bg-purple-100 text-purple-700"
                    : s.source === "lead"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {s.source === "mailbox" ? "Buzón" : s.source === "lead" ? "Lead" : "Reciente"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
