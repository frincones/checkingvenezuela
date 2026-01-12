import { createAdminClient } from "./server";
import { unstable_cache } from "next/cache";

// Table name mapping from MongoDB model names to Supabase table names
const tableNameMap = {
  User: "profiles",
  Profile: "profiles",
  AnonymousUser: "anonymous_users",
  Account: "accounts", // Handled by Supabase Auth
  Session: "sessions", // Handled by Supabase Auth
  Verification_Token: "verification_tokens", // Handled by Supabase Auth
  Airport: "airports",
  Airline: "airlines",
  Airplane: "airplanes",
  FlightItinerary: "flight_itineraries",
  FlightSegment: "flight_segments",
  FlightSeat: "flight_seats",
  FlightBooking: "flight_bookings",
  FlightPayment: "flight_payments",
  FlightReview: "flight_reviews",
  Passenger: "passengers",
  Hotel: "hotels",
  HotelRoom: "hotel_rooms",
  HotelBooking: "hotel_bookings",
  HotelPayment: "hotel_payments",
  HotelGuest: "hotel_guests",
  HotelReview: "hotel_reviews",
  PromoCode: "promo_codes",
  Subscription: "subscriptions",
  SearchHistory: "search_history",
  WebsiteReview: "website_reviews",
  WebsiteConfig: "website_config",
  Analytic: "analytics",
  AirlineFlightPrice: "airline_flight_prices",
  Seat: "seats",
};

// Convert MongoDB-style field names to PostgreSQL snake_case
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Convert object keys from camelCase to snake_case
function convertKeysToSnakeCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToSnakeCase);
  if (typeof obj !== "object") return obj;

  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    converted[snakeKey] = typeof value === "object" ? convertKeysToSnakeCase(value) : value;
  }
  return converted;
}

// Convert object keys from snake_case to camelCase
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToCamelCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);
  if (typeof obj !== "object") return obj;

  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    converted[camelKey] = typeof value === "object" ? convertKeysToCamelCase(value) : value;
  }
  return converted;
}

// Get table name from model name
function getTableName(modelName) {
  const tableName = tableNameMap[modelName];
  if (!tableName) {
    throw new Error(`"${modelName}" is not a valid model`);
  }
  return tableName;
}

// Convert MongoDB filter to Supabase query
function applyFilters(query, filter) {
  for (const [key, value] of Object.entries(filter)) {
    // Skip keys starting with $ as they are operators not fields
    if (key.startsWith("$")) {
      // Handle $or operator at top level
      if (key === "$or") {
        // Note: Supabase doesn't directly support $or, we handle it differently
        // For now, skip it - complex queries should be done in application layer
        continue;
      }
      continue;
    }

    const snakeKey = toSnakeCase(key);

    if (value === null) {
      query = query.is(snakeKey, null);
    } else if (value === undefined) {
      // Skip undefined values
      continue;
    } else if (typeof value === "object" && !Array.isArray(value)) {
      // Handle MongoDB operators
      for (const [op, opValue] of Object.entries(value)) {
        if (opValue === undefined) continue;

        switch (op) {
          case "$eq":
            query = query.eq(snakeKey, opValue);
            break;
          case "$ne":
            query = query.neq(snakeKey, opValue);
            break;
          case "$gt":
            query = query.gt(snakeKey, opValue);
            break;
          case "$gte":
            query = query.gte(snakeKey, opValue);
            break;
          case "$lt":
            query = query.lt(snakeKey, opValue);
            break;
          case "$lte":
            query = query.lte(snakeKey, opValue);
            break;
          case "$in":
            query = query.in(snakeKey, opValue);
            break;
          case "$nin":
            query = query.not(snakeKey, "in", `(${opValue.join(",")})`);
            break;
          case "$regex":
            query = query.ilike(snakeKey, `%${opValue}%`);
            break;
          default:
            // If not a special operator, treat as nested object/equality
            if (!op.startsWith("$")) {
              query = query.eq(snakeKey, value);
            }
        }
      }
    } else if (Array.isArray(value)) {
      query = query.in(snakeKey, value);
    } else {
      query = query.eq(snakeKey, value);
    }
  }
  return query;
}

/**
 * Get one document from the database
 * @param {string} modelName - Name of the model/table
 * @param {object} filter - Filter conditions
 * @param {array} tags - Cache tags for revalidation
 * @param {number|boolean} revalidationTime - Cache revalidation time in seconds
 * @param {object} options - Additional options (select, etc.)
 */
export async function getOneDoc(
  modelName,
  filter = {},
  tags = [],
  revalidationTime,
  options = {}
) {
  const revalidate =
    revalidationTime > 0 || revalidationTime === false
      ? revalidationTime
      : +process.env.NEXT_PUBLIC_REVALIDATION_TIME || 600;

  async function getData(mdlName, fltr, opt) {
    try {
      const tableName = getTableName(mdlName);
      // Use admin client which doesn't require cookies
      const supabase = createAdminClient();

      let query = supabase.from(tableName).select(opt?.select || "*");
      query = applyFilters(query, fltr);
      query = query.limit(1).maybeSingle();

      const { data, error } = await query;

      if (error) {
        console.error("Supabase getOneDoc error:", error);
        throw error;
      }

      return convertKeysToCamelCase(data) || {};
    } catch (error) {
      console.error("getOneDoc error:", error);
      throw error;
    }
  }

  if (
    process.env.NODE_ENV === "production" &&
    (revalidationTime !== false || revalidationTime > 0)
  ) {
    return unstable_cache(
      async () => getData(modelName, filter, options),
      ["getOneDoc", modelName, JSON.stringify(filter), JSON.stringify(options)],
      {
        revalidate,
        tags: ["getOneDoc", ...tags],
      }
    )();
  } else {
    return getData(modelName, filter, options);
  }
}

/**
 * Get many documents from the database
 * @param {string} modelName - Name of the model/table
 * @param {object} filter - Filter conditions
 * @param {array} tags - Cache tags for revalidation
 * @param {number|boolean} revalidationTime - Cache revalidation time in seconds
 * @param {object} options - Additional options (select, limit, offset, order)
 */
export async function getManyDocs(
  modelName,
  filter = {},
  tags = [],
  revalidationTime,
  options = {}
) {
  const revalidate =
    revalidationTime > 0 || revalidationTime === false
      ? revalidationTime
      : +process.env.NEXT_PUBLIC_REVALIDATION_TIME || 600;

  async function getData(mdlName, fltr, opt) {
    try {
      const tableName = getTableName(mdlName);
      // Use admin client which doesn't require cookies
      const supabase = createAdminClient();

      let query = supabase.from(tableName).select(opt?.select || "*");
      query = applyFilters(query, fltr);

      if (opt?.limit) {
        query = query.limit(opt.limit);
      }
      if (opt?.offset) {
        query = query.range(opt.offset, opt.offset + (opt.limit || 100) - 1);
      }
      if (opt?.order) {
        const [column, direction] = Object.entries(opt.order)[0];
        query = query.order(toSnakeCase(column), { ascending: direction === 1 || direction === "asc" });
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase getManyDocs error:", error);
        throw error;
      }

      return (data || []).map(convertKeysToCamelCase);
    } catch (error) {
      console.error("getManyDocs error:", error);
      throw error;
    }
  }

  if (
    process.env.NODE_ENV === "production" &&
    (revalidationTime !== false || revalidationTime > 0)
  ) {
    return unstable_cache(
      async () => getData(modelName, filter, options),
      ["getManyDocs", modelName, JSON.stringify(filter)],
      {
        revalidate,
        tags: ["getManyDocs", ...tags],
      }
    )();
  } else {
    return getData(modelName, filter, options);
  }
}

/**
 * Create one document in the database
 * @param {string} modelName - Name of the model/table
 * @param {object} data - Data to insert
 * @param {object} options - Additional options
 */
export async function createOneDoc(modelName, data, options = {}) {
  try {
    const tableName = getTableName(modelName);
    const supabase = createAdminClient(); // Use admin client for inserts

    const snakeCaseData = convertKeysToSnakeCase(data);

    const { data: result, error } = await supabase
      .from(tableName)
      .insert(snakeCaseData)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      throw error;
    }

    return convertKeysToCamelCase(result);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * Create many documents in the database
 * @param {string} modelName - Name of the model/table
 * @param {array} dataArr - Array of data to insert
 * @param {object} options - Additional options
 */
export async function createManyDocs(modelName, dataArr, options = {}) {
  try {
    const tableName = getTableName(modelName);
    const supabase = createAdminClient();

    const snakeCaseDataArr = dataArr.map(convertKeysToSnakeCase);

    const { data: result, error } = await supabase
      .from(tableName)
      .insert(snakeCaseDataArr)
      .select();

    if (error) {
      console.error("Supabase bulk insert error:", error);
      throw error;
    }

    return result.map((doc) => doc.id);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * Update one document in the database
 * @param {string} modelName - Name of the model/table
 * @param {object} filter - Filter conditions
 * @param {object} updateDataObj - Data to update
 * @param {object} options - Additional options
 */
export async function updateOneDoc(modelName, filter, updateDataObj, options = {}) {
  try {
    const tableName = getTableName(modelName);
    const supabase = createAdminClient();

    // Handle MongoDB $set operator
    const updateData = updateDataObj.$set || updateDataObj;
    const snakeCaseData = convertKeysToSnakeCase(updateData);

    let query = supabase.from(tableName).update(snakeCaseData);
    query = applyFilters(query, filter);

    const { data, error, count } = await query.select();

    if (error) {
      throw error;
    }

    return {
      modifiedCount: data?.length || 0,
      matchedCount: data?.length || 0,
      acknowledged: true,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Update many documents in the database
 * @param {string} modelName - Name of the model/table
 * @param {object} filter - Filter conditions
 * @param {object} updateDataObj - Data to update
 * @param {object} options - Additional options
 */
export async function updateManyDocs(modelName, filter, updateDataObj, options = {}) {
  try {
    const tableName = getTableName(modelName);
    const supabase = createAdminClient();

    const updateData = updateDataObj.$set || updateDataObj;
    const snakeCaseData = convertKeysToSnakeCase(updateData);

    let query = supabase.from(tableName).update(snakeCaseData);
    query = applyFilters(query, filter);

    const { data, error } = await query.select();

    if (error) {
      throw error;
    }

    return {
      modifiedCount: data?.length || 0,
      matchedCount: data?.length || 0,
      acknowledged: true,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Delete one document from the database
 * @param {string} modelName - Name of the model/table
 * @param {object} filter - Filter conditions
 * @param {object} options - Additional options
 */
export async function deleteOneDoc(modelName, filter, options = {}) {
  try {
    const tableName = getTableName(modelName);
    const supabase = createAdminClient();

    let query = supabase.from(tableName).delete();
    query = applyFilters(query, filter);
    query = query.limit(1);

    const { data, error } = await query.select();

    if (error) {
      throw error;
    }

    return {
      deletedCount: data?.length || 0,
      acknowledged: true,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Delete many documents from the database
 * @param {string} modelName - Name of the model/table
 * @param {object} filter - Filter conditions
 * @param {object} options - Additional options
 */
export async function deleteManyDocs(modelName, filter = {}, options = {}) {
  try {
    const tableName = getTableName(modelName);
    const supabase = createAdminClient();

    let query = supabase.from(tableName).delete();
    query = applyFilters(query, filter);

    const { data, error } = await query.select();

    if (error) {
      throw error;
    }

    return {
      deletedCount: data?.length || 0,
      acknowledged: true,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Count documents in the database
 * @param {string} modelName - Name of the model/table
 * @param {object} filter - Filter conditions
 */
export async function countDocs(modelName, filter = {}) {
  try {
    const tableName = getTableName(modelName);
    const supabase = createAdminClient();

    let query = supabase.from(tableName).select("*", { count: "exact", head: true });
    query = applyFilters(query, filter);

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    throw error;
  }
}

// Export table name map for reference
export { tableNameMap };
