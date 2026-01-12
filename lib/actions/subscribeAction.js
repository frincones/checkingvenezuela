import { getOneDoc } from "../db/getOperationDB";
import { createOneDoc } from "../db/createOperationDB";

export default async function subscribeAction(prevState, formData) {
  if (formData instanceof FormData === false)
    throw new Error("2nd argument have to be instance of FormData object");

  const email = formData.get("subscribe-email");
  if (email.trim() === "") return { success: false, error: "Provide Email" };

  const existingSubscription = await getOneDoc(
    "Subscription",
    { email },
    ["subscriptions"],
    0,
  );

  if (existingSubscription && Object.keys(existingSubscription).length > 0) {
    return { success: false, error: "You already subscribed" };
  }

  const subcriptionData = {
    email,
    userId: null,
    emailVerified: null,
  };

  const hasUserAccount = await getOneDoc(
    "User",
    {
      email: subcriptionData.email,
    },
    ["userDetails"]
  );
  if (hasUserAccount) {
    subcriptionData.userId = hasUserAccount.id;
    subcriptionData.emailVerified = hasUserAccount.emailVerified;
  }

  try {
    await createOneDoc("Subscription", subcriptionData);
    return { success: true, message: "Subscribed!! Thank you." };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
