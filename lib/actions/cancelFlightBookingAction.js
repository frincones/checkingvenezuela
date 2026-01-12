"use server";
import { auth } from "../auth";
import { getOneDoc } from "../db/getOperationDB";
import { strToObjectId } from "../db/utilsDB";
import isFlightCancellable from "../helpers/flights/isFlightCancellable";
import {
  cancelBooking,
  getBookingStatusWithCancellationPolicy,
} from "../services/flights";
import { createTicketFromCancellationAction } from "./crm/supportActions";

export default async function cancelFlightBookingAction(pnrCode, reason = null) {
  const session = await auth();
  if (!session.user) return { success: false, message: "Unauthenticated" };
  const userId = session.user.id;

  try {
    const bookingStatuses = await getBookingStatusWithCancellationPolicy(
      pnrCode,
      userId,
    );

    if (!bookingStatuses)
      return { success: false, message: "Flight booking not found" };

    const paymentStatus = bookingStatuses.paymentStatus;
    const ticketStatus = bookingStatuses.ticketStatus;
    const cancellationPolicy = bookingStatuses.cancellationPolicy;
    const departureDate = bookingStatuses.departureDate;

    const isCancellable = isFlightCancellable(
      {
        paymentStatus,
        ticketStatus,
        departureTime: departureDate,
        fareType: "refundable",
      },
      cancellationPolicy,
    );

    if (!isCancellable)
      return { success: false, message: "Flight booking is not cancellable" };

    const cancellationData = {
      canceledBy: "user",
      canceledAt: new Date(),
      reason: reason || "other",
    };
    await cancelBooking(pnrCode, cancellationData);

    // Crear ticket de soporte automáticamente
    try {
      await createTicketFromCancellationAction(
        "flight",
        bookingStatuses.bookingId || pnrCode,
        userId,
        reason
      );
    } catch (ticketError) {
      console.error("Error creating cancellation ticket:", ticketError);
      // No fallar la cancelación si el ticket no se crea
    }

    return { success: true, message: "Flight booking cancelled successfully" };
  } catch (error) {
    console.log(error);
    return { success: false, message: "Something went wrong" };
  }
}
