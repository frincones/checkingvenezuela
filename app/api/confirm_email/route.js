import { revalidateTag } from "next/cache";
import { updateOneDoc } from "@/lib/db/updateOperationDB";
import { getOneDoc } from "@/lib/db/getOperationDB";
import { deleteOneDoc } from "@/lib/db/deleteOperationDB";
import { auth } from "@/lib/auth";
import routes from "@/data/routes.json";
import { getUserDetails } from "@/lib/services/user";

export async function GET(req) {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const searchParams = Object.fromEntries(req.nextUrl.searchParams);

  if (!isLoggedIn) {
    return new Response(
      JSON.stringify({
        redirectURL:
          req.nextUrl.origin +
          `${routes.login.path}?callbackPath=${encodeURIComponent(
            routes.profile.path,
          )}`,
      }),
      {
        status: 307,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (!Boolean(searchParams?.token)) {
    return new Response(
      JSON.stringify({
        redirectURL: req.nextUrl.origin + routes.profile.path,
      }),
      {
        status: 307,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const token = searchParams?.token;

  const user = await getUserDetails(session?.user?.id, 0);

  if (!user || !user.emails) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "User not found",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const inVerificationEmail = user.emails.filter(
    (e) => e.inVerification === true,
  );

  for (const email of inVerificationEmail) {
    // Check if verification token exists and is valid
    const verificationToken = await getOneDoc(
      "Verification_Token",
      {
        identifier: email.email,
        token: token,
      },
      ["verificationToken"],
      0
    );

    if (verificationToken && Object.keys(verificationToken).length > 0) {
      // Check if token is not expired
      const isExpired = verificationToken.expires && new Date(verificationToken.expires) < new Date();

      if (!isExpired) {
        // Delete the used token
        await deleteOneDoc("Verification_Token", {
          identifier: email.email,
          token: token,
        });

        // Update user's email verification status
        await updateOneDoc(
          "User",
          { id: session?.user?.id },
          {
            emailVerifiedAt: new Date(),
          },
        );

        revalidateTag("userDetails");

        return new Response(
          JSON.stringify({
            success: true,
            message: "Email verified",
            verifiedEmail: email.email,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: false,
      message: "Email wasn't verified",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
