"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const TICKET_STATUS_LABELS = {
  open: { label: "Abierto", color: "bg-blue-100 text-blue-800" },
  in_progress: { label: "En Progreso", color: "bg-yellow-100 text-yellow-800" },
  waiting_customer: { label: "Esperando Cliente", color: "bg-orange-100 text-orange-800" },
  resolved: { label: "Resuelto", color: "bg-green-100 text-green-800" },
  closed: { label: "Cerrado", color: "bg-gray-100 text-gray-800" },
};

const TICKET_TYPE_LABELS = {
  cancellation: "Cancelacion",
  refund: "Reembolso",
  modification: "Modificacion",
  complaint: "Queja",
  inquiry: "Consulta",
  other: "Otro",
};

const TICKET_PRIORITY_LABELS = {
  low: { label: "Baja", color: "bg-gray-100 text-gray-600" },
  medium: { label: "Media", color: "bg-yellow-100 text-yellow-600" },
  high: { label: "Alta", color: "bg-orange-100 text-orange-600" },
  urgent: { label: "Urgente", color: "bg-red-100 text-red-600" },
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const messagesEndRef = useRef(null);

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    fetchTicket();
    fetchMessages();
  }, [params.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function fetchTicket() {
    try {
      const response = await fetch(`/api/crm/support/${params.id}`);
      const data = await response.json();
      if (data.data) {
        setTicket(data.data);
      }
    } catch (err) {
      console.error("Error fetching ticket:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages() {
    try {
      const response = await fetch(`/api/crm/support/${params.id}/messages`);
      const data = await response.json();
      if (data.data) {
        setMessages(data.data);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }

  async function updateTicket(updates) {
    setSaving(true);
    try {
      const response = await fetch(`/api/crm/support/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setTicket(data.data);
      }
    } catch (err) {
      console.error("Error updating ticket:", err);
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/crm/support/${params.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: newMessage,
          sender_type: "agent",
        }),
      });

      if (response.ok) {
        setNewMessage("");
        fetchMessages();
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSendingMessage(false);
    }
  }

  async function deleteTicket() {
    if (!confirm("Estas seguro de eliminar este ticket?")) return;

    try {
      const response = await fetch(`/api/crm/support/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/dashboard/support");
      }
    } catch (err) {
      console.error("Error deleting ticket:", err);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  }

  if (!ticket) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Ticket no encontrado</p>
        <Link href="/dashboard/support" className="text-primary hover:underline">
          Volver a soporte
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/support" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver a soporte
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Ticket {ticket.ticket_number}
          </h1>
          <p className="text-gray-600">{ticket.subject}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={deleteTicket}
            className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Original Description */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Descripcion Original</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Messages */}
          <div className="rounded-lg bg-white shadow-md">
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold text-gray-900">Conversacion</h2>
            </div>
            <div className="h-[400px] overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500">No hay mensajes aun</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_type === "agent" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.sender_type === "agent"
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.sender_type === "agent" ? "text-white/70" : "text-gray-500"}`}>
                        {new Date(msg.created_at).toLocaleString("es-VE")}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="border-t p-4">
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  rows={2}
                  className="flex-1 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !newMessage.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {sendingMessage ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Estado</h2>
            <select
              value={ticket.status}
              onChange={(e) => updateTicket({ status: e.target.value })}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {Object.entries(TICKET_STATUS_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <div className="mt-4">
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${TICKET_STATUS_LABELS[ticket.status]?.color}`}>
                {TICKET_STATUS_LABELS[ticket.status]?.label}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Cliente</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nombre</dt>
                <dd className="mt-1 text-sm text-gray-900">{ticket.customer_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{ticket.customer_email || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Telefono</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {ticket.customer_phone ? (
                    <a
                      href={`https://wa.me/${ticket.customer_phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline"
                    >
                      {ticket.customer_phone}
                    </a>
                  ) : (
                    "N/A"
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Details */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Detalles</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Tipo</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {TICKET_TYPE_LABELS[ticket.ticket_type] || ticket.ticket_type}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Prioridad</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${TICKET_PRIORITY_LABELS[ticket.priority]?.color}`}>
                    {TICKET_PRIORITY_LABELS[ticket.priority]?.label || ticket.priority}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Creado</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(ticket.created_at).toLocaleString("es-VE")}
                </dd>
              </div>
              {ticket.resolved_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Resuelto</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(ticket.resolved_at).toLocaleString("es-VE")}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Acciones</h2>
            <div className="space-y-2">
              {ticket.customer_phone && (
                <a
                  href={`https://wa.me/${ticket.customer_phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2 rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>
              )}
              {ticket.customer_email && (
                <a
                  href={`mailto:${ticket.customer_email}?subject=Re: Ticket ${ticket.ticket_number}`}
                  className="flex w-full items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Enviar Email
                </a>
              )}
              {ticket.status !== "resolved" && ticket.status !== "closed" && (
                <button
                  onClick={() => updateTicket({ status: "resolved", resolved_at: new Date().toISOString() })}
                  className="flex w-full items-center gap-2 rounded-md bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-200"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Marcar Resuelto
                </button>
              )}
            </div>
          </div>

          {/* Booking Reference */}
          {ticket.booking_reference && (
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Reserva Asociada</h2>
              <p className="font-mono text-sm text-gray-900">{ticket.booking_reference}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
