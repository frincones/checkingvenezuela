import { createManyDocs } from "@/lib/db/createOperationDB";
import generateOneDayFlight from "@/lib/db/generateForDB/flights/generateOneDayFlight";
import { getManyDocs, getOneDoc } from "@/lib/db/getOperationDB";

export async function GET(req) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("401", { status: 401 });
  }

  const pre = performance.now();

  const [airports, airlines, airplanes, airlineFlightPrices] =
    await Promise.all([
      getManyDocs("Airport", {}),
      getManyDocs("Airline", {}),
      getManyDocs("Airplane", {}),
      getManyDocs("AirlineFlightPrice", {}),
    ]);

  // Get the last flight to determine the next date
  const lastFlights = await getManyDocs(
    "FlightItinerary",
    {},
    ["flightItineraries"],
    0,
    { order: { date: "desc" }, limit: 1 }
  );

  const lastFlight = lastFlights[0];
  const lastFlightDate = new Date(lastFlight?.date || new Date());
  console.log("generating flight for the day after:", lastFlightDate);

  const flights = generateOneDayFlight(
    airlines,
    airlineFlightPrices,
    airports,
    airplanes,
    lastFlightDate,
  );

  const data = {
    FlightItinerary: flights.flightItinerary,
    FlightSegment: flights.flightSegments,
    FlightSeat: flights.flightSeats,
  };

  try {
    await Promise.all(
      Object.entries(data).map(([key, value]) =>
        createManyDocs(key, value, { ordered: false }),
      ),
    );

    const post = performance.now();
    console.log(`Execution time: ${post - pre} ms`);
    return new Response(JSON.stringify({ success: true, message: "Success" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ success: false, message: "Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
