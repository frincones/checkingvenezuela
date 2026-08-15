"use client";

import { useState } from "react";
import {
  MessageCircle,
  Facebook,
  Link2,
  Check,
  MoreHorizontal,
  Twitter,
  Send,
  Mail,
  Linkedin,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function trackShare(method, url) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  try {
    window.gtag("event", "share", {
      method,
      content_url: url,
    });
  } catch {
    /* GA4 not ready — silently skip */
  }
}

export default function ShareButtons({ title, url, className = "" }) {
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const encodedTitle = encodeURIComponent(title || "");
  const encodedUrl = encodeURIComponent(url || "");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackShare("copy", url);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  async function handleMore() {
    // Web Share API (mobile OS sheet: Instagram, TikTok, Telegram, AirDrop, etc.)
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: title, url });
        trackShare("native", url);
        return;
      } catch {
        /* user cancelled — fall through to modal */
      }
    }
    // Desktop / unsupported browser fallback → open modal
    setMoreOpen(true);
  }

  const fixedButtons = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      icon: <MessageCircle className="h-5 w-5" />,
      className: "bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20",
      method: "whatsapp",
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer.php?u=${encodedUrl}`,
      icon: <Facebook className="h-5 w-5" />,
      className: "bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20",
      method: "facebook",
    },
  ];

  const moreButtons = [
    {
      label: "Twitter / X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: <Twitter className="h-5 w-5" />,
      className: "bg-black/5 text-black hover:bg-black/10",
      method: "twitter",
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      icon: <Send className="h-5 w-5" />,
      className: "bg-[#0088cc]/10 text-[#0088cc] hover:bg-[#0088cc]/20",
      method: "telegram",
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: <Linkedin className="h-5 w-5" />,
      className: "bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20",
      method: "linkedin",
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodedTitle}&body=${encodedTitle}%20${encodedUrl}`,
      icon: <Mail className="h-5 w-5" />,
      className: "bg-gray-100 text-gray-700 hover:bg-gray-200",
      method: "email",
    },
  ];

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 sm:gap-3 ${className}`}>
        {fixedButtons.map((btn) => (
          <a
            key={btn.label}
            href={btn.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackShare(btn.method, url)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${btn.className}`}
            title={`Compartir en ${btn.label}`}
            aria-label={`Compartir en ${btn.label}`}
          >
            {btn.icon}
            <span className="hidden sm:inline">{btn.label}</span>
          </a>
        ))}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 sm:px-4"
          title="Copy link"
          aria-label="Copy link"
        >
          {copied ? (
            <Check className="h-5 w-5 text-green-500" />
          ) : (
            <Link2 className="h-5 w-5" />
          )}
          <span className="hidden sm:inline">
            {copied ? "Copied" : "Copy link"}
          </span>
        </button>
        <button
          type="button"
          onClick={handleMore}
          className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 sm:px-4"
          title="More options"
          aria-label="More sharing options"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="hidden sm:inline">More</span>
        </button>
      </div>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share</DialogTitle>
            <DialogDescription>
              Choose where you want to share this content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {moreButtons.map((btn) => (
              <a
                key={btn.label}
                href={btn.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackShare(btn.method, url);
                  setMoreOpen(false);
                }}
                className={`inline-flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${btn.className}`}
              >
                {btn.icon}
                <span>{btn.label}</span>
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
