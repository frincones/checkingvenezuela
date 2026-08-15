"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/data/countryCodes";
import Link from "next/link";

const STORAGE_KEY = "leadCaptureData";

function getSavedData() {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveData(data) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function LeadCaptureModal({
  open,
  onOpenChange,
  onSubmit,
  trackingData = {},
  triggerLabel = "Continue",
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    dialCode: DEFAULT_COUNTRY_CODE,
    phone: "",
    habeasData: false,
  });

  // Pre-fill from session storage when modal opens
  useEffect(() => {
    if (open) {
      const saved = getSavedData();
      if (saved) {
        setFormData((prev) => ({
          ...prev,
          firstName: saved.firstName || "",
          lastName: saved.lastName || "",
          email: saved.email || "",
          dialCode: saved.dialCode || DEFAULT_COUNTRY_CODE,
          phone: saved.phone || "",
          habeasData: false, // Always require re-consent
        }));
      }
      setError("");
    }
  }, [open]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (error) setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.habeasData) {
      setError("You must authorize data processing to continue");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const contactName = `${formData.firstName} ${formData.lastName}`.trim();
      const fullPhone = `${formData.dialCode}${formData.phone}`;

      // Create lead via API
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: contactName,
          contact_email: formData.email,
          contact_phone: formData.phone,
          contact_phone_dial_code: formData.dialCode,
          source: trackingData.source || "web_form",
          interest_type: trackingData.interest_type || "other",
          interest_details: trackingData.interest_details || {},
          preferred_contact_method: "whatsapp",
          landing_page:
            trackingData.landing_page ||
            (typeof window !== "undefined" ? window.location.pathname : null),
          utm_source: trackingData.utm_source || null,
          utm_medium: trackingData.utm_medium || null,
          utm_campaign: trackingData.utm_campaign || null,
        }),
      });

      let leadId = null;
      if (res.ok) {
        const json = await res.json();
        leadId = json.data?.id || null;
      }

      // Save to session for future use
      saveData({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        dialCode: formData.dialCode,
        phone: formData.phone,
      });

      // Close modal and execute callback
      onOpenChange(false);
      onSubmit({
        leadId,
        contactName,
        email: formData.email,
        phone: fullPhone,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
    } catch (err) {
      console.error("Error creating lead:", err);
      // Don't block the user on error - still execute the action
      saveData({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        dialCode: formData.dialCode,
        phone: formData.phone,
      });
      onOpenChange(false);
      onSubmit({
        leadId: null,
        contactName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: `${formData.dialCode}${formData.phone}`,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] p-0">
        <DialogHeader className="border-b border-border px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-bold text-foreground">
            Contact details
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Fill in your details so an advisor can assist you
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="lc-firstName"
                className="mb-1 block text-xs font-medium text-foreground"
              >
                First name *
              </label>
              <input
                id="lc-firstName"
                name="firstName"
                type="text"
                required
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label
                htmlFor="lc-lastName"
                className="mb-1 block text-xs font-medium text-foreground"
              >
                Last name *
              </label>
              <input
                id="lc-lastName"
                name="lastName"
                type="text"
                required
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Smith"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="lc-email"
              className="mb-1 block text-xs font-medium text-foreground"
            >
              Email *
            </label>
            <input
              id="lc-email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="john@email.com"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Phone with country code */}
          <div>
            <label
              htmlFor="lc-phone"
              className="mb-1 block text-xs font-medium text-foreground"
            >
              Phone *
            </label>
            <div className="flex gap-2">
              <select
                name="dialCode"
                value={formData.dialCode}
                onChange={handleChange}
                className="h-9 w-[140px] shrink-0 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <input
                id="lc-phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="4241234567"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Habeas Data */}
          <div className="flex items-start gap-2.5">
            <input
              id="lc-habeasData"
              name="habeasData"
              type="checkbox"
              checked={formData.habeasData}
              onChange={handleChange}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="lc-habeasData" className="text-xs text-muted-foreground leading-relaxed">
              I authorize the processing of my personal data in accordance with the{" "}
              <Link
                href="/privacy-policy"
                target="_blank"
                className="font-medium text-primary underline hover:text-primary/80"
              >
                Privacy Policy
              </Link>
              . *
            </label>
          </div>

          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Procesando...
              </>
            ) : (
              triggerLabel
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Checks if lead data already exists in session storage
 */
export function hasLeadData() {
  const saved = getSavedData();
  return !!(saved?.firstName && saved?.email && saved?.phone);
}

/**
 * Gets saved lead data from session storage
 */
export function getLeadData() {
  return getSavedData();
}
