"use client";
import { Button } from "@/components/ui/button";

export default function DownloadInvoiceButton({ documentId, bookingId }) {
  async function handleDownload(documentId, bookingId, e) {
    e.target.disabled = true;
    const element = document.getElementById(documentId);
    if (!element) {
      e.target.disabled = false;
      return;
    }

    // Dynamic imports to avoid SSR issues with canvas
    const html2canvas = (await import("html2canvas")).default;
    const { default: jsPDF } = await import("jspdf");

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      allowTaint: true,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
    pdf.save(`hotel_invoice_${bookingId}.pdf`);

    e.target.disabled = false;
  }

  return (
    <Button onClick={(e) => handleDownload(documentId, bookingId, e)}>
      Download Invoice
    </Button>
  );
}
