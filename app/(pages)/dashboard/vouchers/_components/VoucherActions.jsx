"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelVoucherAction,
  reactivateVoucherAction,
  deleteVoucherAction,
} from "@/lib/vouchers/actions";

export default function VoucherActions({ voucher }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState(null); // "cancel" | "delete" | "send" | null
  const [cancelReason, setCancelReason] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [msg, setMsg] = useState(null);

  function handleDownloadPDF() {
    window.open(`/api/vouchers/${voucher.id}/pdf`, "_blank");
  }

  function handleCancel() {
    if (!cancelReason.trim()) return;
    startTransition(async () => {
      const res = await cancelVoucherAction(voucher.id, { reason: cancelReason });
      if (res.success) {
        setModal(null);
        router.refresh();
      } else {
        setMsg(res.error);
      }
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const res = await reactivateVoucherAction(voucher.id);
      if (res.success) {
        router.refresh();
      } else {
        setMsg(res.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteVoucherAction(voucher.id);
      if (res.success) {
        router.push("/dashboard/vouchers");
        router.refresh();
      } else {
        setMsg(res.error);
      }
    });
  }

  async function handleSendEmail() {
    if (!sendEmail.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/vouchers/${voucher.id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient_email: sendEmail }),
        });
        const data = await res.json();
        if (data.success) {
          setModal(null);
          setMsg("Email enviado correctamente");
          router.refresh();
        } else {
          setMsg(data.error || "Error al enviar");
        }
      } catch (err) {
        setMsg(err.message);
      }
    });
  }

  const isCancelled = voucher.status === "cancelled";

  return (
    <div className="space-y-4">
      {/* Status message */}
      {msg && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {msg}
          <button onClick={() => setMsg(null)} className="ml-2 font-bold">
            x
          </button>
        </div>
      )}

      {/* PDF stale warning */}
      {voucher.pdf_stale && voucher.pdf_url && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          El PDF está desactualizado. Descárgalo de nuevo para obtener la versión más reciente.
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {!isCancelled && (
          <>
            <button
              onClick={handleDownloadPDF}
              disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Descargar PDF
            </button>
            <button
              onClick={() => {
                setSendEmail(
                  voucher.lead?.contact_email ||
                    voucher.sent_to_email ||
                    "",
                );
                setModal("send");
              }}
              disabled={isPending}
              className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              Enviar por email
            </button>
            <a
              href={`/dashboard/vouchers/${voucher.id}/edit`}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Editar
            </a>
            <button
              onClick={() => setModal("cancel")}
              disabled={isPending}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Cancelar voucher
            </button>
          </>
        )}

        {isCancelled && (
          <button
            onClick={handleReactivate}
            disabled={isPending}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Reactivar
          </button>
        )}

        {voucher.status === "draft" && (
          <button
            onClick={() => setModal("delete")}
            disabled={isPending}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
      </div>

      {/* Cancel Modal */}
      {modal === "cancel" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Cancelar Voucher</h3>
            <p className="mt-1 text-sm text-gray-500">
              Esta acción marcará el voucher como cancelado. Podrás reactivarlo después.
            </p>
            <textarea
              rows={3}
              placeholder="Razón de la cancelación..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Volver
              </button>
              <button
                onClick={handleCancel}
                disabled={isPending || !cancelReason.trim()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modal === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-red-600">Eliminar Voucher</h3>
            <p className="mt-1 text-sm text-gray-500">
              Esta acción eliminará permanentemente el voucher borrador. No se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Volver
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Eliminar permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {modal === "send" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Enviar Voucher por Email</h3>
            <p className="mt-1 text-sm text-gray-500">
              El voucher PDF se adjuntará al email.
            </p>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Email del destinatario
              </label>
              <input
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="cliente@email.com"
              />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Volver
              </button>
              <button
                onClick={handleSendEmail}
                disabled={isPending || !sendEmail.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
