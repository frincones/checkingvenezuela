/**
 * Tests de conexión con Supabase
 *
 * Verifica que la conexión con Supabase funciona correctamente
 * y que los datos seed están disponibles.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para tests
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

describe("Supabase Connection Tests", () => {
  beforeAll(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment variables not configured");
    }
  });

  describe("Database Connection", () => {
    it("should connect to Supabase successfully", async () => {
      const { data, error } = await supabase.from("airports").select("id").limit(1);
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it("should have airports data seeded", async () => {
      const { data, error, count } = await supabase
        .from("airports")
        .select("*", { count: "exact" });

      expect(error).toBeNull();
      expect(count).toBeGreaterThan(0);
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
    });

    it("should have airlines data seeded", async () => {
      const { data, error, count } = await supabase
        .from("airlines")
        .select("*", { count: "exact" });

      expect(error).toBeNull();
      expect(count).toBeGreaterThan(0);
    });

    it("should have hotels data seeded", async () => {
      const { data, error, count } = await supabase
        .from("hotels")
        .select("*", { count: "exact" });

      expect(error).toBeNull();
      expect(count).toBeGreaterThan(0);
    });

    it("should have hotel_rooms data seeded", async () => {
      const { data, error, count } = await supabase
        .from("hotel_rooms")
        .select("*", { count: "exact" });

      expect(error).toBeNull();
      expect(count).toBeGreaterThan(0);
    });

    it("should have promo_codes data seeded", async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("is_active", true);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
    });

    it("should have website_config data seeded", async () => {
      const { data, error } = await supabase
        .from("website_config")
        .select("*")
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.site_name).toBe("Check-in Venezuela");
    });
  });

  describe("Data Structure Validation", () => {
    it("should have valid airport structure", async () => {
      const { data, error } = await supabase
        .from("airports")
        .select("*")
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("city");
      expect(data).toHaveProperty("country");
      expect(data).toHaveProperty("latitude");
      expect(data).toHaveProperty("longitude");
    });

    it("should have valid hotel structure with rooms", async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select(
          `
          *,
          hotel_rooms(*)
        `
        )
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("slug");
      expect(data).toHaveProperty("hotel_rooms");
      expect(data.hotel_rooms.length).toBeGreaterThan(0);
    });

    it("should have valid promo code structure", async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", "BIENVENIDO10")
        .single();

      expect(error).toBeNull();
      expect(data).toHaveProperty("code");
      expect(data).toHaveProperty("discount_type");
      expect(data).toHaveProperty("value");
      expect(data.discount_type).toBe("percentage");
      expect(data.value).toBe(10);
    });
  });

  describe("Query Tests", () => {
    it("should filter airports by country", async () => {
      const { data, error } = await supabase
        .from("airports")
        .select("*")
        .eq("country", "Venezuela");

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.every((airport) => airport.country === "Venezuela")).toBe(true);
    });

    it("should filter hotels by status", async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("*")
        .eq("status", "Opened");

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.every((hotel) => hotel.status === "Opened")).toBe(true);
    });

    it("should search hotels by city", async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("*")
        .ilike("address_city", "%cancun%");

      expect(error).toBeNull();
      // May or may not have results depending on data
    });
  });
});
