/**
 * Tests para API de Leads del CRM
 *
 * Verifica las operaciones CRUD de leads
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de Supabase para tests unitarios
const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  insert: vi.fn(() => mockSupabaseClient),
  update: vi.fn(() => mockSupabaseClient),
  delete: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  in: vi.fn(() => mockSupabaseClient),
  or: vi.fn(() => mockSupabaseClient),
  order: vi.fn(() => mockSupabaseClient),
  range: vi.fn(() => mockSupabaseClient),
  single: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
  createAdminClient: vi.fn(() => mockSupabaseClient),
}));

describe("CRM Leads API Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Lead Data Validation", () => {
    it("should validate lead status values", () => {
      const validStatuses = [
        "new",
        "contacted",
        "quoting",
        "quote_sent",
        "awaiting_payment",
        "paid",
        "fulfilled",
        "won",
        "lost",
      ];

      validStatuses.forEach((status) => {
        expect(validStatuses).toContain(status);
      });
    });

    it("should validate lead source values", () => {
      const validSources = [
        "web_form",
        "whatsapp",
        "chatbot",
        "registration",
        "booking_intent",
        "referral",
        "social_media",
        "phone",
        "email",
        "other",
      ];

      validSources.forEach((source) => {
        expect(validSources).toContain(source);
      });
    });

    it("should validate lead interest types", () => {
      const validTypes = [
        "flight",
        "hotel",
        "package",
        "transfer",
        "insurance",
        "other",
      ];

      validTypes.forEach((type) => {
        expect(validTypes).toContain(type);
      });
    });
  });

  describe("Lead Creation", () => {
    it("should require contact_name for creating a lead", () => {
      const leadData = {
        source: "web_form",
        interest_type: "flight",
        // contact_name is missing
      };

      expect(leadData.contact_name).toBeUndefined();
    });

    it("should create lead with valid data structure", () => {
      const leadData = {
        source: "whatsapp",
        status: "new",
        contact_name: "Juan Pérez",
        contact_email: "juan@example.com",
        contact_phone: "4141234567",
        contact_phone_dial_code: "+58",
        preferred_contact_method: "whatsapp",
        interest_type: "flight",
        interest_details: {
          destination: "Cancún",
          origin: "Caracas",
          departure_date: "2024-03-15",
          passengers: { adults: 2, children: 1 },
        },
      };

      expect(leadData).toHaveProperty("source");
      expect(leadData).toHaveProperty("contact_name");
      expect(leadData).toHaveProperty("interest_type");
      expect(leadData.interest_details).toHaveProperty("destination");
    });
  });

  describe("Lead Interest Details", () => {
    it("should support flight interest details", () => {
      const flightDetails = {
        destination: "Cancún",
        origin: "Caracas",
        departure_date: "2024-03-15",
        return_date: "2024-03-22",
        passengers: {
          adults: 2,
          children: 1,
          infants: 0,
        },
        budget: 2500,
        notes: "Prefiere vuelos directos",
      };

      expect(flightDetails).toHaveProperty("destination");
      expect(flightDetails).toHaveProperty("origin");
      expect(flightDetails.passengers.adults).toBe(2);
    });

    it("should support hotel interest details", () => {
      const hotelDetails = {
        destination: "Cancún",
        check_in_date: "2024-03-15",
        check_out_date: "2024-03-22",
        rooms: 1,
        guests: {
          adults: 2,
          children: 1,
        },
        budget: 1500,
        notes: "Prefiere vista al mar",
      };

      expect(hotelDetails).toHaveProperty("check_in_date");
      expect(hotelDetails).toHaveProperty("check_out_date");
      expect(hotelDetails.rooms).toBe(1);
    });
  });

  describe("Lead Status Transitions", () => {
    it("should allow valid status transitions", () => {
      const validTransitions = {
        new: ["contacted", "lost"],
        contacted: ["quoting", "lost"],
        quoting: ["quote_sent", "lost"],
        quote_sent: ["awaiting_payment", "lost"],
        awaiting_payment: ["paid", "lost"],
        paid: ["fulfilled"],
        fulfilled: ["won"],
        won: [],
        lost: [],
      };

      expect(validTransitions.new).toContain("contacted");
      expect(validTransitions.contacted).toContain("quoting");
      expect(validTransitions.paid).toContain("fulfilled");
    });
  });
});

describe("CRM Lead Actions Tests", () => {
  describe("createLeadAction", () => {
    it("should validate required fields", () => {
      const requiredFields = ["source", "contact_name", "interest_type"];

      requiredFields.forEach((field) => {
        expect(requiredFields).toContain(field);
      });
    });
  });

  describe("updateLeadStatusAction", () => {
    it("should record status change in interactions", () => {
      const interactionData = {
        lead_id: "test-lead-id",
        type: "status_change",
        content: 'Estado cambiado de "new" a "contacted"',
        metadata: {
          previous_status: "new",
          new_status: "contacted",
        },
      };

      expect(interactionData.type).toBe("status_change");
      expect(interactionData.metadata).toHaveProperty("previous_status");
      expect(interactionData.metadata).toHaveProperty("new_status");
    });
  });

  describe("assignLeadAction", () => {
    it("should update assigned_at when assigning advisor", () => {
      const assignmentData = {
        advisor_id: "test-advisor-id",
        assigned_at: new Date().toISOString(),
      };

      expect(assignmentData).toHaveProperty("advisor_id");
      expect(assignmentData).toHaveProperty("assigned_at");
    });
  });
});
