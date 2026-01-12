import { auth } from "@/lib/auth";
import { cancelBooking, isRoomTakenByElse } from "@/lib/services/hotels";
import { getOneDoc, getManyDocs } from "@/lib/db/getOperationDB";
import { strToObjectId } from "@/lib/db/utilsDB";

export async function POST(req) {
  const body = await req.json();
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { success: false, message: "Unauthenticated" },
      { status: 401 },
    );
  }

  try {
    const hotel = await getOneDoc("Hotel", { slug: body.slug }, ["hotels"], 0);

    // Get pending bookings
    const pendingBookings = await getManyDocs(
      "HotelBooking",
      {
        hotelId: strToObjectId(hotel._id),
        checkInDate: new Date(body.checkInDate),
        checkOutDate: new Date(body.checkOutDate),
        userId: strToObjectId(session.user.id),
        bookingStatus: "pending",
        paymentStatus: "pending",
      },
      ["hotelBookings"],
      0,
      { order: { createdAt: -1 }, limit: 1 },
    );

    // Get confirmed bookings with cash payment pending
    const confirmedCashBookings = await getManyDocs(
      "HotelBooking",
      {
        hotelId: strToObjectId(hotel._id),
        checkInDate: new Date(body.checkInDate),
        checkOutDate: new Date(body.checkOutDate),
        userId: strToObjectId(session.user.id),
        bookingStatus: "confirmed",
        paymentStatus: "pending",
        paymentMethod: "cash",
      },
      ["hotelBookings"],
      0,
      { order: { createdAt: -1 }, limit: 1 },
    );

    // Combine and sort by createdAt to get the most recent
    const allBookings = [...pendingBookings, ...confirmedCashBookings];
    allBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const reservedHotelBooking = allBookings[0];

    if (!reservedHotelBooking) {
      return Response.json(
        { success: false, message: "No reserved hotel booking found" },
        { status: 404 },
      );
    }

    const isTakenPromise = reservedHotelBooking.rooms.map(async (room) => {
      return await isRoomTakenByElse(
        room,
        body.checkInDate,
        body.checkOutDate,
        session.user.id,
      );
    });

    const isTaken = (await Promise.all(isTakenPromise)).some(Boolean);

    if (isTaken) {
      const cancelled = await cancelBooking(
        reservedHotelBooking._id.toString(),
        session.user.id,
      );
      if (cancelled.modifiedCount === 0) {
        throw new Error("Failed to cancel booking");
      }
      return Response.json(
        {
          success: false,
          message:
            "Room is already taken by another person, thus booking is cancelled",
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        success: true,
        message: "Reserved hotel booking found",
        data: reservedHotelBooking,
      },
      { status: 200 },
    );
  } catch (error) {
    return Response.json(
      { success: false, message: "Error getting reserved hotel booking" },
      { status: 500 },
    );
  }
}
