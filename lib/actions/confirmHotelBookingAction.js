"use server";
import { auth } from "../auth";
import { confirmHotelBookingCash } from "../services/hotels";
import { getOneDoc } from "../db/getOperationDB";
import { strToObjectId } from "../db/utilsDB";

export async function confirmHotelBookingCashAction(bookingId) {
  const session = await auth();
  if (!session.user) return { success: false, message: "Unauthenticated" };
  const userId = session.user.id;
  try {
    const booking = await getOneDoc(
      "HotelBooking",
      {
        _id: strToObjectId(bookingId),
        userId: strToObjectId(userId),
      },
      ["hotelBookings"],
      0,
    );

    if (!booking || Object.keys(booking).length === 0)
      return { success: false, message: "Booking not found" };

    await confirmHotelBookingCash(bookingId, userId);

    return { success: true, message: "Hotel booking confirmed successfully" };
  } catch (error) {
    return { success: false, message: "Something went wrong" };
  }
}
