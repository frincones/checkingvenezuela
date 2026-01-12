import { getManyDocs } from "@/lib/db/getOperationDB";
import { deleteManyDocs } from "@/lib/db/deleteOperationDB";
import { subDays } from "date-fns";

// cleanup unneeded data to save space

export async function GET(req) {
  const pre = performance.now();
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("401", { status: 401 });
  }

  try {
    await cleanupFlights();
    console.log("cleanupFlights done");

    const post = performance.now();
    console.log("time took:", post - pre + " ms");
    return new Response("OK");
  } catch (e) {
    console.log(e);
    return new Response(e.message, { status: 500 });
  }
}

async function cleanupFlights() {
  // Get all booked flight itinerary IDs
  const bookedFlights = await getManyDocs(
    "FlightBooking",
    {},
    ["userFlightBooking"],
    0,
  );
  const bookedFlightItinerarieIds = bookedFlights.map((b) => b.flightItineraryId);

  // Get old itineraries that are not booked
  const twoDaysAgo = subDays(new Date(), 2);
  const allOldItineraries = await getManyDocs(
    "FlightItinerary",
    {},
    ["flightItineraries"],
    0,
    { limit: 1000 },
  );

  const itinerariesToDelete = allOldItineraries.filter((itinerary) => {
    const itineraryDate = new Date(itinerary.date);
    const isOld = itineraryDate < twoDaysAgo;
    const isNotBooked = !bookedFlightItinerarieIds.includes(itinerary._id);
    return isOld && isNotBooked;
  });

  if (!itinerariesToDelete.length) {
    console.log("nothing to delete in flights");
    return;
  }

  const segmentIdsToDelete = itinerariesToDelete.flatMap(
    (itinerary) => itinerary.segmentIds || [],
  );

  const itineraryIdsToDelete = itinerariesToDelete.map(
    (itinerary) => itinerary._id,
  );

  console.log("bookedFlightItinerarieIds", bookedFlightItinerarieIds.length);
  console.log("itineraries to delete:", itinerariesToDelete.length);
  console.log("segments to delete:", segmentIdsToDelete.length);

  // Delete itineraries
  for (const id of itineraryIdsToDelete) {
    await deleteManyDocs("FlightItinerary", { _id: id });
  }

  // Delete segments
  for (const id of segmentIdsToDelete) {
    await deleteManyDocs("FlightSegment", { _id: id });
  }

  // Delete seats for those segments
  for (const segmentId of segmentIdsToDelete) {
    await deleteManyDocs("FlightSeat", { segmentId });
  }

  console.log("cleanup completed");
}
