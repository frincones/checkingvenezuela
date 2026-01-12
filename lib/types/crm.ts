/**
 * CRM Types - CHECK-IN VENEZUELA
 *
 * Tipos TypeScript para el sistema CRM:
 * - Leads y pipeline de ventas
 * - Asesores
 * - Cotizaciones
 * - Tickets de soporte
 */

// =============================================
// ENUMS
// =============================================

export type LeadStatus =
  | "new"
  | "contacted"
  | "quoting"
  | "quote_sent"
  | "awaiting_payment"
  | "paid"
  | "fulfilled"
  | "won"
  | "lost";

export type LeadSource =
  | "web_form"
  | "whatsapp"
  | "chatbot"
  | "registration"
  | "booking_intent"
  | "referral"
  | "social_media"
  | "phone"
  | "email"
  | "other";

export type LeadInterestType =
  | "flight"
  | "hotel"
  | "package"
  | "transfer"
  | "insurance"
  | "other";

export type QuotationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted";

export type InteractionType =
  | "note"
  | "call"
  | "email"
  | "whatsapp"
  | "status_change"
  | "quote_sent"
  | "system";

export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_customer"
  | "waiting_provider"
  | "resolved"
  | "closed";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketCategory =
  | "booking_change"
  | "cancellation"
  | "refund"
  | "complaint"
  | "inquiry"
  | "technical"
  | "other";

// =============================================
// ADVISOR (Asesor)
// =============================================

export interface Advisor {
  id: string;
  profile_id: string;
  employee_code: string | null;
  department: string;
  whatsapp_number: string | null;
  is_active: boolean;
  specializations: string[];
  max_concurrent_leads: number;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

export interface AdvisorWithProfile extends Advisor {
  profile: {
    first_name: string;
    last_name: string;
    email: string;
    profile_image: string | null;
  };
}

export interface CreateAdvisorInput {
  profile_id: string;
  employee_code?: string;
  department?: string;
  whatsapp_number?: string;
  specializations?: string[];
  max_concurrent_leads?: number;
  commission_rate?: number;
}

export interface UpdateAdvisorInput {
  employee_code?: string;
  department?: string;
  whatsapp_number?: string;
  is_active?: boolean;
  specializations?: string[];
  max_concurrent_leads?: number;
  commission_rate?: number;
}

// =============================================
// LEAD
// =============================================

export interface LeadInterestDetails {
  destination?: string;
  origin?: string;
  departure_date?: string;
  return_date?: string;
  passengers?: {
    adults?: number;
    children?: number;
    infants?: number;
  };
  rooms?: number;
  check_in_date?: string;
  check_out_date?: string;
  budget?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface Lead {
  id: string;
  source: LeadSource;
  status: LeadStatus;
  profile_id: string | null;
  anonymous_user_id: string | null;
  advisor_id: string | null;
  assigned_at: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_phone_dial_code: string;
  preferred_contact_method: string;
  interest_type: LeadInterestType;
  interest_details: LeadInterestDetails;
  converted_at: string | null;
  conversion_booking_type: string | null;
  conversion_booking_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_url: string | null;
  landing_page: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadWithRelations extends Lead {
  advisor?: AdvisorWithProfile | null;
  profile?: {
    first_name: string;
    last_name: string;
    email: string;
    profile_image: string | null;
  } | null;
  interactions?: LeadInteraction[];
  quotations?: Quotation[];
}

export interface CreateLeadInput {
  source: LeadSource;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  contact_phone_dial_code?: string;
  preferred_contact_method?: string;
  interest_type: LeadInterestType;
  interest_details?: LeadInterestDetails;
  profile_id?: string;
  anonymous_user_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer_url?: string;
  landing_page?: string;
}

export interface UpdateLeadInput {
  status?: LeadStatus;
  advisor_id?: string | null;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_phone_dial_code?: string;
  preferred_contact_method?: string;
  interest_type?: LeadInterestType;
  interest_details?: LeadInterestDetails;
  last_contacted_at?: string;
  next_follow_up_at?: string | null;
}

export interface LeadFilters {
  status?: LeadStatus | LeadStatus[];
  source?: LeadSource | LeadSource[];
  interest_type?: LeadInterestType | LeadInterestType[];
  advisor_id?: string | null;
  created_from?: string;
  created_to?: string;
  search?: string;
}

// =============================================
// LEAD INTERACTION
// =============================================

export interface InteractionMetadata {
  previous_status?: LeadStatus;
  new_status?: LeadStatus;
  duration_minutes?: number;
  outcome?: string;
  [key: string]: unknown;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  advisor_id: string | null;
  type: InteractionType;
  content: string | null;
  metadata: InteractionMetadata;
  created_at: string;
}

export interface LeadInteractionWithAdvisor extends LeadInteraction {
  advisor?: AdvisorWithProfile | null;
}

export interface CreateInteractionInput {
  lead_id: string;
  advisor_id?: string;
  type: InteractionType;
  content?: string;
  metadata?: InteractionMetadata;
}

// =============================================
// QUOTATION (Cotización)
// =============================================

export interface QuotationItem {
  type: "flight" | "hotel" | "transfer" | "insurance" | "other";
  description: string;
  details?: Record<string, unknown>;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  lead_id: string;
  advisor_id: string;
  items: QuotationItem[];
  subtotal: number;
  taxes: number;
  fees: number;
  discount_amount: number;
  discount_reason: string | null;
  total: number;
  currency: string;
  status: QuotationStatus;
  valid_until: string | null;
  sent_at: string | null;
  sent_via: string | null;
  viewed_at: string | null;
  converted_at: string | null;
  converted_booking_type: string | null;
  converted_booking_id: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  terms_and_conditions: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationWithRelations extends Quotation {
  lead?: LeadWithRelations;
  advisor?: AdvisorWithProfile;
}

export interface CreateQuotationInput {
  lead_id: string;
  advisor_id: string;
  items: QuotationItem[];
  taxes?: number;
  fees?: number;
  discount_amount?: number;
  discount_reason?: string;
  currency?: string;
  valid_until?: string;
  internal_notes?: string;
  customer_notes?: string;
  terms_and_conditions?: string;
}

export interface UpdateQuotationInput {
  items?: QuotationItem[];
  taxes?: number;
  fees?: number;
  discount_amount?: number;
  discount_reason?: string;
  valid_until?: string;
  internal_notes?: string;
  customer_notes?: string;
  terms_and_conditions?: string;
}

export interface QuotationFilters {
  status?: QuotationStatus | QuotationStatus[];
  advisor_id?: string;
  lead_id?: string;
  created_from?: string;
  created_to?: string;
  valid_until_from?: string;
  valid_until_to?: string;
}

// =============================================
// SUPPORT TICKET
// =============================================

export interface TicketMetadata {
  booking_pnr?: string;
  original_amount?: number;
  refund_amount?: number;
  [key: string]: unknown;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  booking_type: "flight" | "hotel";
  booking_id: string;
  profile_id: string;
  assigned_advisor_id: string | null;
  subject: string;
  description: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  resolved_at: string | null;
  resolution_notes: string | null;
  satisfaction_rating: number | null;
  metadata: TicketMetadata;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketWithRelations extends SupportTicket {
  profile?: {
    first_name: string;
    last_name: string;
    email: string;
    profile_image: string | null;
  };
  assigned_advisor?: AdvisorWithProfile | null;
  messages?: TicketMessage[];
}

export interface CreateTicketInput {
  booking_type: "flight" | "hotel";
  booking_id: string;
  profile_id: string;
  subject: string;
  description?: string;
  category: TicketCategory;
  priority?: TicketPriority;
  metadata?: TicketMetadata;
}

export interface UpdateTicketInput {
  assigned_advisor_id?: string | null;
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  resolution_notes?: string;
  satisfaction_rating?: number;
}

export interface TicketFilters {
  status?: TicketStatus | TicketStatus[];
  priority?: TicketPriority | TicketPriority[];
  category?: TicketCategory | TicketCategory[];
  assigned_advisor_id?: string | null;
  profile_id?: string;
  booking_type?: "flight" | "hotel";
  created_from?: string;
  created_to?: string;
}

// =============================================
// TICKET MESSAGE
// =============================================

export interface MessageAttachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_type: "customer" | "advisor" | "system";
  author_id: string | null;
  content: string;
  attachments: MessageAttachment[];
  is_internal: boolean;
  created_at: string;
}

export interface TicketMessageWithAuthor extends TicketMessage {
  author?: {
    first_name: string;
    last_name: string;
    profile_image: string | null;
  } | null;
}

export interface CreateMessageInput {
  ticket_id: string;
  author_type: "customer" | "advisor" | "system";
  author_id?: string;
  content: string;
  attachments?: MessageAttachment[];
  is_internal?: boolean;
}

// =============================================
// API RESPONSES
// =============================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface CRMStats {
  leads: {
    total: number;
    by_status: Record<LeadStatus, number>;
    by_source: Record<LeadSource, number>;
    new_today: number;
    conversion_rate: number;
  };
  quotations: {
    total: number;
    by_status: Record<QuotationStatus, number>;
    total_value: number;
    average_value: number;
  };
  tickets: {
    total: number;
    by_status: Record<TicketStatus, number>;
    by_priority: Record<TicketPriority, number>;
    average_resolution_time_hours: number;
  };
}

export interface AdvisorStats {
  advisor_id: string;
  leads_assigned: number;
  leads_converted: number;
  conversion_rate: number;
  quotations_sent: number;
  quotations_accepted: number;
  total_sales: number;
  tickets_resolved: number;
  average_resolution_time_hours: number;
  satisfaction_rating: number;
}

// =============================================
// CONSTANTS
// =============================================

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  quoting: "En cotización",
  quote_sent: "Cotización enviada",
  awaiting_payment: "Esperando pago",
  paid: "Pagado",
  fulfilled: "Completado",
  won: "Ganado",
  lost: "Perdido",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  quoting: "bg-purple-100 text-purple-800",
  quote_sent: "bg-indigo-100 text-indigo-800",
  awaiting_payment: "bg-orange-100 text-orange-800",
  paid: "bg-green-100 text-green-800",
  fulfilled: "bg-teal-100 text-teal-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  web_form: "Formulario Web",
  whatsapp: "WhatsApp",
  chatbot: "Chatbot",
  registration: "Registro",
  booking_intent: "Intención de reserva",
  referral: "Referido",
  social_media: "Redes Sociales",
  phone: "Teléfono",
  email: "Email",
  other: "Otro",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Abierto",
  in_progress: "En progreso",
  waiting_customer: "Esperando cliente",
  waiting_provider: "Esperando proveedor",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  booking_change: "Cambio de reserva",
  cancellation: "Cancelación",
  refund: "Reembolso",
  complaint: "Queja",
  inquiry: "Consulta",
  technical: "Problema técnico",
  other: "Otro",
};

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  viewed: "Vista",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Expirada",
  converted: "Convertida",
};
