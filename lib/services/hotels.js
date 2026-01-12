import "server-only";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { getManyDocs, getOneDoc } from "../db/getOperationDB";
import { updateOneDoc } from "../db/updateOperationDB";
import { getRefundList, requestRefund } from "../paymentIntegration/stripe";
import { singleRoomFareBreakdown } from "../helpers/hotels/priceCalculation";

export async function getHotels(searchState, options = {}) {
  const city = searchState.city;
  const country = searchState.country;
  const checkIn = searchState.checkIn;
  const checkOut = searchState.checkOut;
  const rooms = searchState.rooms;
  const guests = searchState.guests;

  const filtersPriceRange = options?.filters?.priceRange || [
    -Infinity,
    Infinity,
  ];
  const filtersRates = options?.filters?.rates || [];
  const filtersFeatures = options?.filters?.features || [];
  const filtersAmenities = options?.filters?.amenities || [];

  try {
    // Get all hotels (filtering by city/country will be done in app layer due to Supabase limitations with JSONB)
    let hotels = await getManyDocs(
      "Hotel",
      {},
      ["hotels"],
    );

    // Filter by city and country (case-insensitive fuzzy match)
    const cityRegex = new RegExp(city.match(/.{1,2}/g).join("+?.*"), "i");
    const countryRegex = new RegExp(country.match(/.{1,2}/g).join("+?.*"), "i");

    hotels = hotels.filter(hotel => {
      const hotelCity = hotel.address?.city || "";
      const hotelCountry = hotel.address?.country || "";
      return cityRegex.test(hotelCity) && countryRegex.test(hotelCountry);
    });

    // Filter by features
    if (filtersFeatures.length > 0) {
      hotels = hotels.filter(hotel => {
        const hotelFeatures = hotel.features || [];
        return filtersFeatures.every(f => hotelFeatures.includes(f));
      });
    }

    // Filter by amenities
    if (filtersAmenities.length > 0) {
      hotels = hotels.filter(hotel => {
        const hotelAmenities = hotel.amenities || [];
        return filtersAmenities.every(a => hotelAmenities.includes(a));
      });
    }

    const reservedRoomsResult = await getManyDocs(
      "HotelBooking",
      {
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn },
      },
      ["hotelBookings"],
    );

    // Filter for valid bookings (pending with valid reservation or confirmed)
    const validReservations = reservedRoomsResult.filter(booking => {
      if (booking.bookingStatus === "confirmed") return true;
      if (booking.bookingStatus === "pending" &&
          new Date(booking.guaranteedReservationUntil) > new Date()) {
        return true;
      }
      return false;
    });

    const reservedRoomsIds = validReservations
      .map((booking) => booking.rooms)
      .flat();

    const hotelsWithAvailableRooms = hotels.map((hotel) => {
      const availableRooms = (hotel.rooms || []).filter(
        (room) => !reservedRoomsIds.includes(room._id || room.id),
      );

      const isAvailableRoomsInPriceRange = availableRooms.some((room) => {
        const price = singleRoomFareBreakdown(room, 1).total;
        return price >= filtersPriceRange[0] && price <= filtersPriceRange[1];
      });

      if (!isAvailableRoomsInPriceRange) return null;

      return { ...hotel, rooms: availableRooms };
    });

    hotels = hotelsWithAvailableRooms.filter((hotel) => {
      if (!hotel) return false;

      const totalCapacity = hotel.rooms.reduce(
        (acc, room) => acc + +(room.sleepsCount || 0),
        0,
      );
      return guests <= totalCapacity;
    });
    return hotels;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export async function getHotel(slug, searchState) {
  try {
    const hotelDetails = await getOneDoc("Hotel", { slug }, ["hotel"]);
    if (Object.keys(hotelDetails).length === 0) return null;

    const checkIn = searchState.checkIn;
    const checkOut = searchState.checkOut;

    const reservedRoomsResult = await getManyDocs(
      "HotelBooking",
      {
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn },
      },
      ["hotelBookings"],
    );

    // Filter for valid bookings
    const validReservations = reservedRoomsResult.filter(booking => {
      if (booking.bookingStatus === "confirmed") return true;
      if (booking.bookingStatus === "pending" &&
          new Date(booking.guaranteedReservationUntil) > new Date()) {
        return true;
      }
      return false;
    });

    const reservedRoomsIds = validReservations.map((room) => room.rooms).flat();

    const availableRooms = (hotelDetails.rooms || []).filter(
      (room) => !reservedRoomsIds.includes(room._id || room.id),
    );
    const hotelsWithAvailableRooms = {
      ...hotelDetails,
      rooms: availableRooms,
    };

    return hotelsWithAvailableRooms;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export async function getHotelDefaultFilterValues() {
  try {
    // Get all hotels to extract filter values
    const hotels = await getManyDocs("Hotel", {}, ["hotels"]);

    // Extract unique amenities
    const amenitiesSet = new Set();
    hotels.forEach(hotel => {
      (hotel.amenities || []).forEach(amenity => amenitiesSet.add(amenity));
    });

    // Extract unique features
    const featuresSet = new Set();
    hotels.forEach(hotel => {
      (hotel.features || []).forEach(feature => featuresSet.add(feature));
    });

    // Calculate price range from rooms
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    hotels.forEach(hotel => {
      (hotel.rooms || []).forEach(room => {
        const price = room.price || {};
        const base = price.base || 0;
        const tax = price.tax || 0;
        const serviceFee = price.serviceFee || 0;
        const discount = price.discount || {};

        let discountAmount = 0;
        if (discount.type === "percentage") {
          discountAmount = base * (discount.amount / 100);
        } else if (discount.type === "fixed") {
          discountAmount = discount.amount || 0;
        }

        const calculatedPrice = base + tax + serviceFee - discountAmount;

        if (calculatedPrice < minPrice) minPrice = calculatedPrice;
        if (calculatedPrice > maxPrice) maxPrice = calculatedPrice;
      });
    });

    const filterValues = {
      amenities: Array.from(amenitiesSet).sort(),
      features: Array.from(featuresSet).sort(),
      priceRange:
        minPrice !== Infinity && maxPrice !== -Infinity
          ? [Math.floor(minPrice), Math.ceil(maxPrice)]
          : [0, 2000],
    };

    return filterValues;
  } catch (error) {
    console.log(error);
    return {
      amenities: [],
      features: [],
      priceRange: [0, 2000],
    };
  }
}

export async function getAllHotelBookings(userId, revalidate = 600) {
  if (!userId) throw new Error("User id is required");
  try {
    const hotelBookings = await getManyDocs(
      "HotelBooking",
      {
        userId: userId,
      },
      ["hotelBookings"],
      revalidate,
    );
    return hotelBookings;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export async function isRoomAvailable(roomId, checkInDate, checkOutDate) {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  try {
    const bookings = await getManyDocs(
      "HotelBooking",
      {
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn },
      },
      ["hotelBookings", "hotelBooking"],
    );

    // Check if any booking has this room and is valid
    const existingBooking = bookings.find(booking => {
      const rooms = booking.rooms || [];
      if (!rooms.includes(roomId)) return false;

      if (booking.bookingStatus === "confirmed") return true;
      if (booking.bookingStatus === "pending" &&
          new Date(booking.guaranteedReservationUntil) > new Date()) {
        return true;
      }
      return false;
    });

    return !existingBooking;
  } catch (e) {
    console.error("Error checking room availability:", e);
    throw e;
  }
}

export async function isRoomTakenByElse(
  roomId,
  checkInDate,
  checkOutDate,
  currentUserId,
) {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  try {
    const bookings = await getManyDocs(
      "HotelBooking",
      {
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn },
      },
      ["hotelBookings", "hotelBooking"],
    );

    // Check if any booking by another user has this room and is valid
    const existingBooking = bookings.find(booking => {
      if (booking.userId === currentUserId) return false;

      const rooms = booking.rooms || [];
      if (!rooms.includes(roomId)) return false;

      if (booking.bookingStatus === "confirmed") return true;
      if (booking.bookingStatus === "pending" &&
          new Date(booking.guaranteedReservationUntil) > new Date()) {
        return true;
      }
      return false;
    });

    return !!existingBooking;
  } catch (e) {
    console.error("Error checking room availability:", e);
    throw e;
  }
}

export async function confirmHotelBookingCash(bookingId, userId, options = {}) {
  try {
    await updateOneDoc(
      "HotelBooking",
      { id: bookingId, userId: userId },
      {
        bookingStatus: "confirmed",
        paymentStatus: "pending",
        paymentMethod: "cash",
        bookedAt: new Date(),
      },
      options,
    );
    revalidateTag("hotelBookings");
  } catch (error) {
    throw error;
  }
}

export async function cancelBooking(bookingId, userId, options = {}) {
  try {
    const result = await updateOneDoc(
      "HotelBooking",
      { id: bookingId, userId: userId },
      {
        bookingStatus: "cancelled",
      },
      options,
    );

    revalidateTag("hotelBookings");
    return result;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export async function refundPaymentHotelBooking(bookingId, userId) {
  let chargeId = null;
  try {
    const booking = await getOneDoc(
      "HotelBooking",
      { id: bookingId, userId: userId },
      ["hotelBookings"],
    );
    chargeId = booking.paymentId?.stripe_chargeId;

    const refund = await requestRefund({
      charge: chargeId,
      reason: "requested_by_customer",
      metadata: { type: "hotelBooking", hotelBookingId: bookingId, userId },
    });

    // webhook will update the refund info in the booking

    return refund;
  } catch (e) {
    console.log(e);
    if (e.raw?.code === "charge_already_refunded") {
      try {
        const refund = (await getRefundList(chargeId))[0];

        const refundInfoObj = {
          stripeRefundId: refund.id,
          status: "refunded",
          reason: refund.reason,
          currency: refund.currency,
          amount: refund.amount / 100,
          refundedAt: new Date(refund.created * 1000),
        };
        await updateOneDoc(
          "HotelBooking",
          { id: bookingId },
          {
            paymentStatus: "refunded",
            bookingStatus: "cancelled",
            refundInfo: refundInfoObj,
          },
        );
        revalidateTag("hotelBookings");
      } catch (e) {}
    }
    throw e;
  }
}

/**
 * @typedef {Object} CancellationPolicy
 * @property {boolean} cancellable
 * @property {CancellableUntil} cancellableUntil
 * @property {number} cancellationFee
 * @property {string} cancellationDeadline
 */

/**
 * @typedef {Object} CancellableUntil
 * @property {"days" | "hours" | "minutes" | "seconds"} unit
 * @property {number} value
 */

/**
 * @typedef {Object} RefundPolicy
 * @property {boolean} refundable
 * @property {number} refundFee
 */

/**
 * @typedef {Object} Policies
 * @property {CancellationPolicy} cancellationPolicy
 * @property {RefundPolicy} refundPolicy
 */

/**
 * @typedef {Object} BookingStatusesWithHotelPolicies
 * @property {string} bookingStatus - the status of the booking
 * @property {string} paymentStatus - the status of the payment
 * @property {Date} checkInDate - the check-in date of the booking
 * @property {Object} policies - the policies of the hotel
 */

/**
 * Given a bookingId and a userId, returns an object with the booking status, payment status, check-in date, and hotel policies
 * @param {string} bookingId - the booking id
 * @param {string} userId - the user id that made the booking
 * @throws {Error} if the booking is not found
 * @returns {Promise<BookingStatusesWithHotelPolicies>} - an object with the booking status, payment status, check-in date, and hotel policies
 */
export async function getBookingStatusesWithHotelPolicies(bookingId, userId) {
  if (!bookingId || !userId) throw new Error("Missing parameters.");

  try {
    // Get the booking
    const booking = await getOneDoc(
      "HotelBooking",
      { id: bookingId, userId },
      ["hotelBookings"],
      0
    );

    if (!booking || Object.keys(booking).length === 0) return null;

    // Get the hotel for policies
    const hotel = await getOneDoc(
      "Hotel",
      { id: booking.hotelId },
      ["hotel"],
      0
    );

    return {
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      checkInDate: booking.checkInDate,
      policies: hotel?.policies || null,
    };
  } catch (e) {
    console.log(e);
    throw e;
  }
}

/**
 * @function getPopularHotelDestinaiton
 * @description Retrieves a list of popular hotel destinations (city-country) along with a random hotel in each destination.
 * @param {number} [limit=10] - The maximum number of records to return
 * @returns {Promise<Object[]>} - A list of hotel documents with a subset of fields (streetAddress, city, stateProvince, postalCode, country)
 */

// can be replaced with real popular destinations logic
export async function getPopularHotelDestinaiton(limit = 10) {
  const randomHotelAddresses = unstable_cache(
    async () => {
      // Get hotels that are open and not deleted
      const hotels = await getManyDocs(
        "Hotel",
        {
          status: "Opened",
        },
        ["hotels"],
      );

      // Filter out deleted hotels
      const activeHotels = hotels.filter(h => !h.isDeleted);

      // Group by city-country to get unique destinations
      const destinationMap = new Map();
      activeHotels.forEach(hotel => {
        const key = `${hotel.address?.city}-${hotel.address?.country}`;
        if (!destinationMap.has(key)) {
          destinationMap.set(key, hotel);
        }
      });

      // Get unique destinations
      const uniqueDestinations = Array.from(destinationMap.values());

      // Shuffle and take the limit
      const shuffled = uniqueDestinations.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, limit);

      // Return only needed fields
      return selected.map(hotel => ({
        category: hotel.category,
        image: hotel.images?.[0] || null,
        address: {
          streetAddress: hotel.address?.streetAddress,
          city: hotel.address?.city,
          stateProvince: hotel.address?.stateProvince,
          postalCode: hotel.address?.postalCode,
          country: hotel.address?.country,
        },
      }));
    },
    ["popularHotelDestinations"],
    { tags: ["popularHotelDestinations"], revalidate: 24 * 60 * 60 }, // 1 day
  );

  return await randomHotelAddresses();
}
