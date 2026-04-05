"use client";

import { useState } from "react";
import { MessageCircle, Twitter, Facebook, Link2, Check } from "lucide-react";

export default function ShareButtons({ title, url }) {
  const [copied, setCopied] = useState(false);

  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  }

  const buttons = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      icon: <MessageCircle className="h-5 w-5" />,
      className: "bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20",
    },
    {
      label: "Twitter",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: <Twitter className="h-5 w-5" />,
      className: "bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/20",
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer.php?u=${encodedUrl}`,
      icon: <Facebook className="h-5 w-5" />,
      className: "bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {buttons.map((btn) => (
        <a
          key={btn.label}
          href={btn.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${btn.className}`}
          title={`Compartir en ${btn.label}`}
        >
          {btn.icon}
          <span className="hidden sm:inline">{btn.label}</span>
        </a>
      ))}
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        title="Copiar enlace"
      >
        {copied ? <Check className="h-5 w-5 text-green-500" /> : <Link2 className="h-5 w-5" />}
        <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar link"}</span>
      </button>
    </div>
  );
}
