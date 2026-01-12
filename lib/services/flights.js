import "server-only";
import { unstable_cache } from "next/cache";
import { getManyDocs, getOneDoc } from "../db/getOperationDB";
import { startOfDay, endOfDay, addYears } from "date-fns";
import { flightRatingCalculation } from "../helpers/flights/flightRatingCalculation";
import { updateOneDoc, updateManyDocs } from "../db/updateOperationDB";
import { getTimezoneOffset } from "date-fns-tz";
import { revalidateTag } from "next/cache";
import { multiSegmentCombinedFareBreakDown } from "../db/schema/flightItineraries";
import { getRefundList, requestRefund } from "../paymentIntegration/stripe";

export async function getFlights(
  {
    departureAirportCode,
    arrivalAirportCode,
    departureDate,
    returnDate,
    tripType,
    flightClass,
    passengersObj,
    filters = {},
  },
  bookmarkedFlights = [],
  metaData = {},
) {
  const zoneOffset = getTimezoneOffset(metaData.timeZone, departureDate);

  const filterAirlines = filters?.airlines || [];
  const filterRatings = filters?.rates || [];
  const filterPriceRange = filters?.priceRange || [];
  const filterDepartureTime = filters?.departureTime || [];

  const oneDayInMillis = 24 * 60 * 60 * 1000;

  let flightResults = await getManyDocs(
    "FlightItinerary",
    {
      departureAirportId: departureAirportCode,
      arrivalAirportId: arrivalAirportCode,
      ...(filterAirlines.length > 0 && {
        carrierInCharge: { $in: filterAirlines },
      }),
      date: {
        $gte:
          startOfDay(departureDate).getTime() -
          zoneOffset +
          (filterDepartureTime[0] || 0),
        $lte:
          endOfDay(departureDate).getTime() -
          zoneOffset -
          (oneDayInMillis - (filterDepartureTime[1] || oneDayInMillis)),
      },
      status: "scheduled",
      expireAt: { $gte: Date.now() },
    },
    ["flights"],
  );

  if (Object.keys(flightResults).length === 0) {
    return [];
  }

  //add price and rating reviews and other neccesary data
  // eslint-disable-next-line no-undef
  flightResults = await Promise.all(
    flightResults.map(async (flight) => {
      const fareBreakdown = multiSegmentCombinedFareBreakDown(
        flight.segmentIds,
        {
          adult: passengersObj.adults,
          child: passengersObj.children,
          infant: passengersObj.infants,
        },
        flightClass,
      );

      if (filterPriceRange[0] && filterPriceRange[1]) {
        if (
          fareBreakdown.total < filterPriceRange[0] ||
          fareBreakdown.total > filterPriceRange[1]
        ) {
          return null;
        }
      }

      let currentDepartureAirport = flight.departureAirportId?._id || flight.departureAirportId,
        currentArrivalAirport = flight.arrivalAirportId?._id || flight.arrivalAirportId,
        currentDepartureAirline = flight.carrierInCharge?._id || flight.carrierInCharge;

      const flightReviews = await getManyDocs(
        "FlightReview",
        {
          airlineId: currentDepartureAirline,
          departureAirportId: currentDepartureAirport,
          arrivalAirportId: currentArrivalAirport,
          airplaneModelName: flight.segmentIds?.[0]?.airplaneId?.model,
        },
        ["flightReviews"],
      );

      let ratingReviews = {
        totalReviews: 0,
        rating: 0.0,
      };

      const rating = flightRatingCalculation(flightReviews);

      if (filterRatings?.length > 0) {
        if (!filterRatings.includes(String(parseInt(rating)))) {
          return null;
        }
      }

      ratingReviews.rating = rating;
      ratingReviews.totalReviews = flightReviews.length;

      const isBookmarked = bookmarkedFlights.some((bFlight) => {
        return bFlight.flightId?._id === flight._id || bFlight.flightId === flight.id;
      });

      const availableSeats = (flight.segmentIds || []).map(async (segment) => {
        const segmentId = segment?._id || segment?.id || segment;
        const seats = await getAvailableSeats(segmentId, flightClass, 0);
        return {
          segmentId: segmentId,
          availableSeats: seats.length,
        };
      });

      return {
        ...flight,
        ratingReviews,
        isBookmarked,
        availableSeatsCount: await Promise.all(availableSeats),
        fareBreakdowns: fareBreakdown,
      };
    }),
  );

  flightResults = flightResults.filter((flight) => {
    //filter nulls
    if (!flight) {
      return false;
    }

    return flight.availableSeatsCount.every(
      (seat) =>
        seat.availableSeats >= +passengersObj.adults + +passengersObj.children,
    );
  });

  return flightResults;
}

export async function getFlight(flightNumber, date) {
  const flight = await getOneDoc(
    "FlightItinerary",
    { flightCode: flightNumber, date: new Date(date) },
    ["flight"],
  );
  return flight;
}

export async function getAvailableFlightDateRange() {
  try {
    // Get the first flight (earliest expireAt)
    const firstFlights = await getManyDocs(
      "FlightItinerary",
      {
        expireAt: { $gte: Date.now() },
      },
      ["flightDateRange"],
      false,
      { order: { expireAt: "asc" }, limit: 1 }
    );

    // Get the last flight (latest expireAt)
    const lastFlights = await getManyDocs(
      "FlightItinerary",
      {
        expireAt: { $gte: Date.now() },
      },
      ["flightDateRange"],
      false,
      { order: { expireAt: "desc" }, limit: 1 }
    );

    const firstFlight = firstFlights[0];
    const lastFlight = lastFlights[0];

    return {
      success: true,
      message: "Success",
      data: {
        from:
          new Date(firstFlight?.expireAt)?.getTime() ||
          addYears(new Date(), 100).getTime(),
        to: new Date(lastFlight?.expireAt)?.getTime() || -1,
      },
    };
  } catch (e) {
    console.log(e);
    return {
      success: false,
      message: "Failed to get flight date range",
    };
  }
}

export async function getAllFlightBookings(userId, revalidate = 600) {
  if (!userId) throw new Error("User id is required");
  try {
    const flightBookings = await getManyDocs(
      "FlightBooking",
      {
        userId: userId,
      },
      ["userFlightBooking"],
      revalidate,
    );
    return flightBookings;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export async function getReservedSeats(segmentId, seatClass, revalidate = 600) {
  try {
    // For Supabase, we need to handle the complex OR query differently
    // Get all seats and filter in application
    const allSeats = await getManyDocs(
      "FlightSeat",
      {
        segmentId: segmentId,
        ...(seatClass && { class: seatClass }),
      },
      ["flightSeat"],
      revalidate,
    );

    // Filter for reserved seats (permanent or valid temporary)
    const flightSeats = allSeats.filter(seat => {
      if (seat.reservation?.type === "permanent") return true;
      if (seat.reservation?.type === "temporary" &&
          new Date(seat.reservation?.expiresAt).getTime() > Date.now()) {
        return true;
      }
      return false;
    });

    return flightSeats;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export async function getAvailableSeats(
  segmentId,
  seatClass,
  revalidate = 600,
) {
  try {
    // Get all seats for the segment
    const allSeats = await getManyDocs(
      "FlightSeat",
      {
        segmentId: segmentId?.toString(),
        ...(seatClass && { class: seatClass }),
      },
      ["flightSeat"],
      revalidate,
    );

    // Filter for available seats (no reservation or expired temporary)
    const flightSeats = allSeats.filter(seat => {
      if (!seat.reservation?.type) return true;
      if (seat.reservation?.type === "temporary" &&
          new Date(seat.reservation?.expiresAt).getTime() < Date.now()) {
        return true;
      }
      return false;
    });

    return flightSeats;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export async function getExpiredTemporarylyReservedSeats(
  segmentId,
  seatClass,
  revalidate = 600,
) {
  if (segmentId === undefined) throw Error("FlightNumber is required");

  try {
    const allSeats = await getManyDocs(
      "FlightSeat",
      {
        segmentId: segmentId,
        ...(seatClass && { class: seatClass }),
      },
      ["flightSeat"],
      revalidate,
    );

    // Filter for expired temporary reservations
    const reservedSeats = allSeats.filter(seat => {
      return seat.reservation?.type === "temporary" &&
             new Date(seat.reservation?.expiresAt).getTime() < Date.now();
    });

    return reservedSeats;
  } catch (e) {
    console.log(e);
  }
}

export async function isSeatTakenByElse(seatId, currentPassengerId) {
  const seat = await getOneDoc(
    "FlightSeat",
    {
      id: seatId,
    },
    ["flightSeat"],
    0,
  );

  // Check if seat is available for this passenger
  if (!seat || Object.keys(seat).length === 0) return true;
  if (!seat.reservation?.for) return false;
  if (seat.reservation?.for === currentPassengerId) return false;

  return true;
}

export async function cancelBooking(
  pnrCode,
  cancellationData = {},
  options = {},
) {
  try {
    await updateOneDoc(
      "FlightBooking",
      { pnrCode: pnrCode },
      {
        cancellationInfo: { ...cancellationData },
        ticketStatus: "cancelled",
      },
      options,
    );
  } catch (e) {
    console.log(e);
    throw e;
  } finally {
    revalidateTag("userFlightBooking");
  }
}

export async function assignSeatsToFlightBooking(
  bookingDbDoc,
  reservationType,
  reservationExpiresAt = null,
  session = null,
) {
  const flightBooking = bookingDbDoc;
  const pnrCode = flightBooking.pnrCode;

  if (Object.keys(flightBooking).length === 0) {
    throw new Error("Flight booking not found");
  }

  if (flightBooking.selectedSeats.length && reservationType === "permanent") {
    try {
      const updatedSeats = flightBooking.selectedSeats.map(
        async ({ passengerId, seatId }) => {
          const seatIdValue = seatId?._id || seatId?.id || seatId;
          await updateOneDoc(
            "FlightSeat",
            { id: seatIdValue },
            {
              reservation: {
                type: "permanent",
                for: passengerId,
                expiresAt: null,
              },
            },
            { session: session },
          );
          return seatId;
        },
      );

      const seatIds = await Promise.all(updatedSeats);

      return seatIds;
    } catch (e) {
      throw e;
    } finally {
      revalidateTag("userFlightBooking");
      revalidateTag("flightSeat");
    }
  }

  const passengers = flightBooking.passengers;
  const segments = flightBooking.segmentIds;

  const selectedSeats = [];
  const bookingsToCancel = [];

  for (const segment of segments) {
    const segmentId = segment?._id || segment?.id || segment;
    const seats = [];
    const availableSeats = await getAvailableSeats(segmentId, null, 0);
    if (!availableSeats.length) throw new Error("No available seats");

    let unreservedSeats = availableSeats.filter((seat) => {
      return seat.reservation?.type === null || !seat.reservation?.type;
    });
    let expiredReservedSeats = availableSeats.filter((seat) => {
      return (
        seat.reservation?.type === "temporary" &&
        new Date(seat.reservation?.expiresAt).getTime() < Date.now()
      );
    });

    for (const passenger of passengers.filter(
      (p) => p.passengerType !== "infant",
    )) {
      const seat =
        unreservedSeats?.find(
          (s) =>
            s.class === passenger.seatClass &&
            seats.every((seat) => (seat._id || seat.id)?.toString() !== (s._id || s.id)?.toString()),
        ) ??
        expiredReservedSeats?.find(
          (s) =>
            s.class === passenger.seatClass &&
            seats.every((p) => (p._id || p.id)?.toString() !== (s._id || s.id)?.toString()),
        );

      if (!seat) throw new Error("No available seats");
      if (seat.reservation?.type === "temporary") {
        bookingsToCancel.push(seat.reservation.pnrCode);
      }

      seat.reservation = {
        pnrCode: flightBooking.pnrCode,
        for: passenger._id || passenger.id,
        type: reservationType,
        expiresAt: reservationExpiresAt,
      };

      seats.push(seat);
    }
    selectedSeats.push(...seats);
  }
  try {
    const flightBookingSelectedSeats = selectedSeats.map((s) => {
      return {
        passengerId: s.reservation.for,
        seatId: s._id || s.id,
      };
    });
    await updateOneDoc(
      "FlightBooking",
      { pnrCode: pnrCode },
      {
        selectedSeats: flightBookingSelectedSeats,
        guaranteedReservationUntil: new Date(reservationExpiresAt),
      },
      { session: session },
    );

    // Update seats one by one (Supabase doesn't have bulkWrite)
    for (const seat of selectedSeats) {
      await updateOneDoc(
        "FlightSeat",
        { id: seat._id || seat.id },
        { reservation: seat.reservation },
        { session: session }
      );
    }

    const bookingCancellation = bookingsToCancel.map(async (pnrCode) => {
      await cancelBooking(
        pnrCode,
        {
          canceledBy: "system",
          canceledAt: new Date(),
          reason:
            "Temporary reservation expired, thus taken by other passenger",
        },
        { session: session },
      );
    });

    await Promise.all(bookingCancellation);

    return selectedSeats.map((s) => s._id || s.id);
  } catch (e) {
    throw e;
  } finally {
    revalidateTag("userFlightBooking");
    revalidateTag("flightSeat");
  }
}

export const getRandomAirports = unstable_cache(
  async (sampleFlightCount = 10) => {
    //TODO: get popular route flights from GDS API
    // Using Supabase - get random airports
    const airports = await getManyDocs(
      "Airport",
      {},
      ["airports"],
      false,
      { limit: sampleFlightCount * 3 } // Get more to have variety
    );

    // Shuffle and take the requested amount
    const shuffled = airports.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sampleFlightCount);
  },
  ["popularFlightDestinations"],
  {
    revalidate: false, // 1 day
    tags: ["popularFlightDestinations"],
  },
);

export async function getPopularFlightDestinations(flightsCount = 10) {
  const flights = await getRandomAirports(flightsCount);

  return flights;
}

export async function getBookingStatusWithCancellationPolicy(pnrCode, userId) {
  try {
    // Get the booking
    const booking = await getOneDoc(
      "FlightBooking",
      { pnrCode, userId },
      ["userFlightBooking"],
      0
    );

    if (!booking || Object.keys(booking).length === 0) return null;

    // Get the itinerary
    const itinerary = await getOneDoc(
      "FlightItinerary",
      { id: booking.flightItineraryId },
      ["flightItinerary"],
      0
    );

    if (!itinerary || Object.keys(itinerary).length === 0) return null;

    // Get the airline
    const airlineId = itinerary.carrierInCharge?._id || itinerary.carrierInCharge;
    const airline = await getOneDoc(
      "Airline",
      { id: airlineId },
      ["airline"],
      0
    );

    return {
      pnrCode: booking.pnrCode,
      userId: booking.userId,
      paymentStatus: booking.paymentStatus,
      ticketStatus: booking.ticketStatus,
      departureDate: itinerary.date,
      cancellationPolicy: airline?.airlinePolicy?.cancellationPolicy || null,
    };
  } catch (e) {
    console.log(e);
    return null;
  }
}

export async function refundPaymentFlightBooking(pnrCode, userId) {
  let chargeId = null;
  try {
    const booking = await getOneDoc(
      "FlightBooking",
      { pnrCode: pnrCode, userId: userId },
      ["userFlightBooking"],
    );
    chargeId = booking.paymentId?.stripe_chargeId;

    const refund = await requestRefund({
      charge: chargeId,
      reason: "requested_by_customer",
      metadata: {
        type: "flightBooking",
        flightBookingId: booking._id || booking.id,
        pnrCode: booking.pnrCode,
        userId,
      },
    });

    // webhook will update the refund info in the booking

    return refund;
  } catch (e) {
    console.log(e);
    if (e.raw?.code === "charge_already_refunded") {
      try {
        const refund = (await getRefundList(chargeId))[0];
        const bookingId = booking?._id || booking?.id;

        const refundInfoObj = {
          stripeRefundId: refund.id,
          status: "refunded",
          reason: refund.reason,
          currency: refund.currency,
          amount: refund.amount / 100,
          refundedAt: new Date(refund.created * 1000),
        };
        await updateOneDoc(
          "FlightBooking",
          { id: bookingId },
          {
            paymentStatus: "refunded",
            bookingStatus: "cancelled",
            refundInfo: refundInfoObj,
          },
        );
        revalidateTag("userFlightBooking");
      } catch (e) {}
    }
    throw e;
  }
}
