import "server-only";
import { SubscribeNewsletter } from "@/components/SubscribeNewsletter";
import { QuickLinks } from "@/components/sections/QuickLinks";
import { getOneDoc } from "@/lib/db/getOperationDB";
import { auth } from "@/lib/auth";
import Link from "next/link";
export async function Footer() {
  const user = (await auth())?.user;
  let isSubscribed = false;
  if (user) {
    const subscription = await getOneDoc(
      "Subscription",
      { userId: user.id },
      ["subscriptions"],
      0,
    );
    isSubscribed = subscription?.subscribed || false;
  }
  return (
    <footer className="relative pb-5">
      <SubscribeNewsletter isSubscribed={isSubscribed} />
      <QuickLinks />
      <div className="relative z-10 text-center text-sm font-medium">
        Developed by{" "}
        <Link
          aria-label={"Link to Github of the developer"}
          className="inline text-white"
          href="https://github.com/mojahidhasan"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mojahid Hasan
        </Link>
      </div>
      <div className="relative z-10 text-center text-sm font-medium">
        UI design taken from &nbsp;
        <Link
          aria-label={"Link to Figma Community"}
          className="inline text-white"
          href="https://www.figma.com/community/file/1182308758714734501/golobe-travel-agency-website"
          target="_blank"
          rel="noopener noreferrer"
        >
          Figma Community
        </Link>
      </div>
    </footer>
  );
}
