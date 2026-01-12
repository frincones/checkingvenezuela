import { getManyDocs } from "@/lib/db/getOperationDB";

export async function GET(req) {
  const searchParams = Object.fromEntries(new URL(req.url).searchParams);
  const limit = parseInt(searchParams?.limit) || 10;
  const searchQuery = searchParams?.searchQuery;

  try {
    const airports = await getManyDocs(
      "Airport",
      {},
      ["airports"],
      0,
      { limit, select: "iata_code,name,city" },
    );

    if (!searchQuery || searchQuery.trim() === "") {
      return Response.json({
        success: true,
        message: "Available airports fetched successfully",
        data: airports.map(a => ({
          iataCode: a.iataCode,
          name: a.name,
          city: a.city,
        })),
      });
    }

    const searchLower = searchQuery.toLowerCase().trim();

    const filteredAirports = airports.filter((airport) => {
      return (
        airport.iataCode?.toLowerCase().includes(searchLower) ||
        airport.name?.toLowerCase().includes(searchLower) ||
        airport.city?.toLowerCase().includes(searchLower)
      );
    });

    return Response.json({
      success: true,
      message: "Available airports fetched successfully",
      data: filteredAirports.map(a => ({
        iataCode: a.iataCode,
        name: a.name,
        city: a.city,
      })),
    });
  } catch (error) {
    return Response.json(
      { success: false, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
