import "server-only";
import { SubscribeNewsletter } from "@/components/SubscribeNewsletter";
import { QuickLinks } from "@/components/sections/QuickLinks";
import { getOneDoc } from "@/lib/db/getOperationDB";
import { auth } from "@/lib/auth";

export async function Footer() {
  const user = (await auth())?.user;
  let isSubscribed = false;
  if (user?.email) {
    try {
      const subscription = await getOneDoc(
        "Subscription",
        { email: user.email },
        ["subscriptions"],
        0,
      );
      isSubscribed = subscription?.isActive || false;
    } catch (error) {
      // Subscription check failed, default to not subscribed
      isSubscribed = false;
    }
  }
  return (
    <footer className="relative pb-5">
      <SubscribeNewsletter isSubscribed={isSubscribed} />
      <QuickLinks />
      <div className="relative z-10 text-center text-sm font-medium text-secondary/70">
        © {new Date().getFullYear()} CHECK-IN VENEZUELA. Todos los derechos reservados.
      </div>
      <div className="relative z-10 mt-2 text-center text-xs font-medium text-secondary/50">
        Caracas, Venezuela | Atención 24/7
      </div>
    </footer>
  );
}
