"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { BookingRequestModal } from "@/components/ui/BookingRequestModal";

export function PackageBottomCTA({ packageName, displayPrice, packageSlug }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="lg" className="min-w-[200px]" onClick={() => setOpen(true)}>
        Book {packageName}
      </Button>

      <BookingRequestModal
        open={open}
        onOpenChange={setOpen}
        productType="package"
        productName={packageName}
        productSlug={packageSlug}
        productPrice={displayPrice}
        origin="bottom_cta"
        whatsappMessage={`Hi! I'm interested in the "${packageName}" package.`}
      />
    </>
  );
}
