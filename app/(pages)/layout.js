import { Nav } from "@/components/sections/Nav";
import { Footer } from "@/components/sections/Footer";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import routes from "@/data/routes.json";
export default async function PagesLayout({ children }) {
  const navNotAllowedPaths = [
    routes.login.path,
    routes.signup.path,
    routes["forgot-password"].path,
    routes["verify-password-reset-code"].path,
    routes["set-new-password"].path,
  ];

  // Dashboard has its own layout, so don't show nav/footer
  const dashboardPaths = ["/dashboard"];

  const session = await auth();
  const currentPathname = headers().get("x-pathname") || "";

  const isDashboard = dashboardPaths.some((path) =>
    currentPathname.startsWith(path)
  );

  const isNavAllowed = !isDashboard && !navNotAllowedPaths.some((path) =>
    path.startsWith(currentPathname)
  );

  return (
    <>
      {isNavAllowed && <Nav session={session} type="default" />}
      {children}
      {isNavAllowed && <Footer />}
    </>
  );
}
