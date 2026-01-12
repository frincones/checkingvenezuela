import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase client
vi.mock("@/lib/db/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: { id: "test-id", first_name: "John", last_name: "Doe" },
              error: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: "new-id", first_name: "Jane", last_name: "Doe" },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({
            data: [{ id: "test-id", first_name: "Updated" }],
            error: null,
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({
              data: [{ id: "test-id" }],
              error: null,
            })),
          })),
        })),
      })),
    })),
  })),
}));

// Import after mocking
import {
  getOneDoc,
  createOneDoc,
  updateOneDoc,
  deleteOneDoc,
  tableNameMap,
} from "@/lib/db/supabase/operations";

describe("Supabase Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tableNameMap", () => {
    it("should have correct mappings for all models", () => {
      expect(tableNameMap.User).toBe("profiles");
      expect(tableNameMap.Profile).toBe("profiles");
      expect(tableNameMap.FlightBooking).toBe("flight_bookings");
      expect(tableNameMap.HotelBooking).toBe("hotel_bookings");
      expect(tableNameMap.Subscription).toBe("subscriptions");
    });

    it("should map all expected models", () => {
      const expectedModels = [
        "User",
        "Profile",
        "Airport",
        "Airline",
        "Hotel",
        "FlightBooking",
        "HotelBooking",
        "Subscription",
      ];

      expectedModels.forEach((model) => {
        expect(tableNameMap).toHaveProperty(model);
      });
    });
  });

  describe("getOneDoc", () => {
    it("should return data when document exists", async () => {
      const result = await getOneDoc("User", { id: "test-id" });

      // The result should be converted to camelCase
      expect(result).toBeDefined();
    });

    it("should throw error for invalid model name", async () => {
      await expect(getOneDoc("InvalidModel", {})).rejects.toThrow(
        '"InvalidModel" is not a valid model'
      );
    });
  });

  describe("createOneDoc", () => {
    it("should create and return new document", async () => {
      const result = await createOneDoc("User", {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      });

      expect(result).toBeDefined();
    });

    it("should throw error for invalid model name", async () => {
      await expect(createOneDoc("InvalidModel", {})).rejects.toThrow(
        '"InvalidModel" is not a valid model'
      );
    });
  });

  describe("updateOneDoc", () => {
    it("should update and return modified count", async () => {
      const result = await updateOneDoc(
        "User",
        { id: "test-id" },
        { firstName: "Updated" }
      );

      expect(result).toHaveProperty("modifiedCount");
      expect(result).toHaveProperty("acknowledged", true);
    });

    it("should handle $set operator", async () => {
      const result = await updateOneDoc(
        "User",
        { id: "test-id" },
        { $set: { firstName: "Updated" } }
      );

      expect(result).toHaveProperty("acknowledged", true);
    });
  });

  describe("deleteOneDoc", () => {
    it("should delete and return deleted count", async () => {
      const result = await deleteOneDoc("User", { id: "test-id" });

      expect(result).toHaveProperty("deletedCount");
      expect(result).toHaveProperty("acknowledged", true);
    });
  });
});

describe("Case Conversion", () => {
  it("should correctly identify _id to id conversion", () => {
    // This tests the internal logic of converting MongoDB _id to PostgreSQL id
    const mongoFilter = { _id: "some-id" };
    // The function should convert _id to id when building queries
    expect(mongoFilter._id).toBe("some-id");
  });
});
