"use client";
import { Button } from "@/components/ui/button";

export default function DownloadInvoiceButton({ documentId, bookingId }) {
  async function handleDownload(documentId, bookingId, e) {
    e.target.disabled = true;
    const element = document.getElementById(documentId);
    const opt = {
      margin: 0,
      filename: `hotel_invoice_${bookingId}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    // Dynamic import to avoid SSR issues with canvas
    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf().set(opt).from(element).save();
    e.target.disabled = false;
  }

  return (
    <Button onClick={(e) => handleDownload(documentId, bookingId, e)}>
      Download Invoice
    </Button>
  );
}
