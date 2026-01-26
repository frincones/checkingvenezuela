"use client";

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { useState } from "react";

export function PackageActions({ packageName, whatsappUrl, shareUrl }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: packageName,
          text: `Mira este paquete turístico: ${packageName}`,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or error occurred
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  return (
    <div className="flex gap-3">
      <Button
        variant="outline"
        size="lg"
        className="flex-1"
        onClick={handleShare}
      >
        <Share2 className="mr-2 h-4 w-4" />
        {copied ? 'Copiado!' : 'Compartir'}
      </Button>
      <Button asChild size="lg" className="flex-1 lg:min-w-[200px]">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          Reservar Ahora
        </a>
      </Button>
    </div>
  );
}
