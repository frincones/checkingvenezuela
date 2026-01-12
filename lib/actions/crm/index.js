/**
 * CRM Actions - CHECK-IN VENEZUELA
 *
 * Exportaciones centralizadas de todas las acciones del CRM
 */

// Lead Actions
export {
  createLeadAction,
  updateLeadStatusAction,
  assignLeadAction,
  addLeadInteractionAction,
  updateLeadFollowUpAction,
  convertLeadAction,
  createLeadFromQuoteIntentAction,
} from "./leadActions";

// Quotation Actions
export {
  createQuotationAction,
  sendQuotationAction,
  markQuotationViewedAction,
  acceptQuotationAction,
  rejectQuotationAction,
  convertQuotationToBookingAction,
  updateQuotationItemsAction,
} from "./quotationActions";

// Support Actions
export {
  createSupportTicketAction,
  addTicketMessageAction,
  updateTicketStatusAction,
  assignTicketAction,
  rateTicketSatisfactionAction,
  createTicketFromCancellationAction,
  createTicketFromRefundRequestAction,
} from "./supportActions";
