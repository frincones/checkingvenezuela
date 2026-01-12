import { getManyDocs } from "@/lib/db/getOperationDB";

export async function GET(req) {
  const searchParams = Object.fromEntries(new URL(req.url).searchParams);
  const limit = parseInt(searchParams?.limit) || 10;
  const searchQuery = searchParams?.searchQuery;

  try {
    if (!searchQuery || searchQuery.trim() === "") {
      const hotels = await getManyDocs(
        "Hotel",
        {},
        ["hotels"],
        0,
        { limit, select: "address" },
      );

      return Response.json({
        success: true,
        message: "Available places fetched successfully",
        data: hotels.map((hotel) => {
          return {
            city: hotel.address?.city,
            country: hotel.address?.country,
            type: "place",
          };
        }),
      });
    }

    const searchLower = searchQuery.toLowerCase().trim();

    // Get all hotels and filter in application layer since Supabase
    // doesn't support OR across nested JSONB fields the same way MongoDB does
    const hotels = await getManyDocs(
      "Hotel",
      {},
      ["hotels"],
      0,
      { select: "address" },
    );

    // Filter hotels where city or country matches the search query
    const filteredHotels = hotels.filter((hotel) => {
      const city = hotel.address?.city?.toLowerCase() || "";
      const country = hotel.address?.country?.toLowerCase() || "";
      return city.includes(searchLower) || country.includes(searchLower);
    }).slice(0, limit);

    const stringified = filteredHotels.map((hotel) => {
      return JSON.stringify({
        city: hotel.address?.city,
        country: hotel.address?.country,
        type: "place",
      }); // stringified to later remove duplicates and one in array is type place and another is type hotel
    });

    // eslint-disable-next-line no-undef
    const filterDuplicates = Array.from(new Set(stringified), (x) =>
      JSON.parse(x),
    );

    return Response.json({
      success: true,
      message: "Available places fetched successfully",
      data: filterDuplicates,
    });
  } catch (e) {
    console.log(e);
    return Response.json(
      {
        success: false,
        message: "Error getting available places",
      },
      { status: 500 },
    );
  }
}
