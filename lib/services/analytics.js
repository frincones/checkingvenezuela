import "server-only";
import { getOneDoc } from "../db/getOperationDB";
import { createOneDoc } from "../db/createOperationDB";
import { updateOneDoc } from "../db/updateOperationDB";
import { countDocs } from "../db/utilsDB";

export async function createAnalytics() {
  const existingAnalytics = await getOneDoc(
    "Analytic",
    { _id: "analytics" },
    ["analytics"],
    0,
  );

  if (!existingAnalytics || Object.keys(existingAnalytics).length === 0) {
    const totalUsers = await countDocs("User", {});
    await createOneDoc("Analytic", {
      _id: "analytics",
      totalUsersSignedUp: totalUsers,
    });
  }
}

export async function incOrDecrementAnalytics(data) {
  // Get current analytics
  const analytics = await getOneDoc(
    "Analytic",
    { _id: "analytics" },
    ["analytics"],
    0,
  );

  if (!analytics) return null;

  // Calculate new values by incrementing/decrementing
  const updateData = {};
  for (const [key, value] of Object.entries(data)) {
    updateData[key] = (analytics[key] || 0) + value;
  }

  return await updateOneDoc("Analytic", { _id: "analytics" }, updateData);
}
