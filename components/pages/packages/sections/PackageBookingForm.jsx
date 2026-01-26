"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, Users, Mail, Phone, MessageSquare } from "lucide-react";

export function PackageBookingForm({ packageData, userEmail, userId }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    numberOfPeople: 1,
    travelDate: "",
    contactName: "",
    contactEmail: userEmail || "",
    contactPhone: "",
    specialRequests: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Aquí puedes integrar con tu sistema de cotizaciones/leads del dashboard
      const requestData = {
        packageId: packageData.id,
        packageName: packageData.name,
        userId,
        ...formData,
        requestedAt: new Date().toISOString(),
      };

      // Simulación de envío - Reemplazar con API call real
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast({
        title: "¡Solicitud Enviada!",
        description: "Hemos recibido tu solicitud. Te contactaremos pronto con los detalles de tu paquete.",
      });

      // Resetear formulario
      setFormData({
        numberOfPeople: 1,
        travelDate: "",
        contactName: "",
        contactEmail: userEmail || "",
        contactPhone: "",
        specialRequests: "",
      });
    } catch (error) {
      console.error("Error submitting booking:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al enviar tu solicitud. Por favor intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-2xl font-bold">Solicitar Cotización</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Number of People */}
        <div>
          <Label htmlFor="numberOfPeople" className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Número de Personas *
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
            placeholder="¿Cuántas personas viajarán?"
          />
        </div>

        {/* Travel Date */}
        <div>
          <Label htmlFor="travelDate" className="mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Fecha de Viaje Deseada *
          </Label>
          <Input
            id="travelDate"
            name="travelDate"
            type="date"
            required
            min={new Date().toISOString().split('T')[0]}
            value={formData.travelDate}
            onChange={handleChange}
          />
        </div>

        {/* Contact Name */}
        <div>
          <Label htmlFor="contactName">
            Nombre Completo *
          </Label>
          <Input
            id="contactName"
            name="contactName"
            type="text"
            required
            value={formData.contactName}
            onChange={handleChange}
            placeholder="Tu nombre completo"
          />
        </div>

        {/* Contact Email */}
        <div>
          <Label htmlFor="contactEmail" className="mb-2 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Correo Electrónico *
          </Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            value={formData.contactEmail}
            onChange={handleChange}
            placeholder="tu@email.com"
          />
        </div>

        {/* Contact Phone */}
        <div>
          <Label htmlFor="contactPhone" className="mb-2 flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Teléfono *
          </Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            required
            value={formData.contactPhone}
            onChange={handleChange}
            placeholder="+58 424 1234567"
          />
        </div>

        {/* Special Requests */}
        <div>
          <Label htmlFor="specialRequests" className="mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Solicitudes Especiales
          </Label>
          <Textarea
            id="specialRequests"
            name="specialRequests"
            rows={4}
            value={formData.specialRequests}
            onChange={handleChange}
            placeholder="¿Tienes alguna solicitud especial? (opcional)"
          />
          <p className="mt-1 text-xs text-gray-500">
            Ejemplo: Preferencias alimentarias, necesidades especiales, etc.
          </p>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Enviando..." : "Solicitar Cotización"}
        </Button>

        <p className="text-center text-xs text-gray-500">
          Al enviar esta solicitud, recibirás una cotización personalizada vía email
        </p>
      </form>
    </div>
  );
}
