"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, Users, Mail, Phone, MessageSquare } from "lucide-react";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/data/countryCodes";
import Link from "next/link";

export function PackageBookingForm({ packageData, userEmail, userId }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    numberOfPeople: 1,
    travelDate: "",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: userEmail || "",
    dialCode: DEFAULT_COUNTRY_CODE,
    contactPhone: "",
    specialRequests: "",
    habeasData: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.habeasData) {
      toast({
        title: "Authorization required",
        description: "You must authorize the processing of personal data to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const contactName = `${formData.contactFirstName} ${formData.contactLastName}`.trim();

      // Create lead in CRM
      await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: contactName,
          contact_email: formData.contactEmail,
          contact_phone: formData.contactPhone,
          contact_phone_dial_code: formData.dialCode,
          source: "web_form",
          interest_type: "package",
          interest_details: {
            package_id: packageData.id,
            package_name: packageData.name,
            number_of_people: formData.numberOfPeople,
            travel_date: formData.travelDate,
            special_requests: formData.specialRequests,
            origin: "booking_form",
          },
          preferred_contact_method: "whatsapp",
          landing_page: typeof window !== "undefined" ? window.location.pathname : null,
        }),
      });

      toast({
        title: "Request sent!",
        description: "We have received your request. We will contact you shortly with your package details.",
      });

      setFormData({
        numberOfPeople: 1,
        travelDate: "",
        contactFirstName: "",
        contactLastName: "",
        contactEmail: userEmail || "",
        dialCode: DEFAULT_COUNTRY_CODE,
        contactPhone: "",
        specialRequests: "",
        habeasData: false,
      });
    } catch (error) {
      console.error("Error submitting booking:", error);
      toast({
        title: "Error",
        description: "There was a problem sending your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-2xl font-bold">Request a quote</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Number of People */}
        <div>
          <Label htmlFor="numberOfPeople" className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Number of travellers *
          </Label>
          <Input
            id="numberOfPeople"
            name="numberOfPeople"
            type="number"
            min="1"
            max="50"
            required
            value={formData.numberOfPeople}
            onChange={handleChange}
            placeholder="How many people are travelling?"
          />
        </div>

        {/* Travel Date */}
        <div>
          <Label htmlFor="travelDate" className="mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Preferred travel date *
          </Label>
          <Input
            id="travelDate"
            name="travelDate"
            type="date"
            required
            min={new Date().toISOString().split("T")[0]}
            value={formData.travelDate}
            onChange={handleChange}
          />
        </div>

        {/* Contact Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="contactFirstName">First name *</Label>
            <Input
              id="contactFirstName"
              name="contactFirstName"
              type="text"
              required
              value={formData.contactFirstName}
              onChange={handleChange}
              placeholder="Juan"
            />
          </div>
          <div>
            <Label htmlFor="contactLastName">Last name *</Label>
            <Input
              id="contactLastName"
              name="contactLastName"
              type="text"
              required
              value={formData.contactLastName}
              onChange={handleChange}
              placeholder="Smith"
            />
          </div>
        </div>

        {/* Contact Email */}
        <div>
          <Label htmlFor="contactEmail" className="mb-2 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email *
          </Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            value={formData.contactEmail}
            onChange={handleChange}
            placeholder="you@email.com"
          />
        </div>

        {/* Contact Phone with Country Code */}
        <div>
          <Label htmlFor="contactPhone" className="mb-2 flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone *
          </Label>
          <div className="flex gap-2">
            <select
              name="dialCode"
              value={formData.dialCode}
              onChange={handleChange}
              className="h-10 w-[130px] shrink-0 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              required
              value={formData.contactPhone}
              onChange={handleChange}
              placeholder="4241234567"
            />
          </div>
        </div>

        {/* Special Requests */}
        <div>
          <Label htmlFor="specialRequests" className="mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Special requests
          </Label>
          <Textarea
            id="specialRequests"
            name="specialRequests"
            rows={4}
            value={formData.specialRequests}
            onChange={handleChange}
            placeholder="Any special requests? (optional)"
          />
          <p className="mt-1 text-xs text-gray-500">
            For example: dietary preferences, accessibility needs, etc.
          </p>
        </div>

        {/* Habeas Data */}
        <div className="flex items-start gap-2.5">
          <input
            id="habeasData"
            name="habeasData"
            type="checkbox"
            checked={formData.habeasData}
            onChange={handleChange}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="habeasData" className="text-xs text-gray-600 leading-relaxed">
            Autorizo el tratamiento de mis datos personales de acuerdo con la{" "}
            <Link
              href="/privacy-policy"
              target="_blank"
              className="font-medium text-primary underline hover:text-primary/80"
            >
              Privacy Policy
            </Link>
            . *
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending..." : "Request a quote"}
        </Button>
      </form>
    </div>
  );
}
