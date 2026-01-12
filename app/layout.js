import { Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import NextTopLoader from "nextjs-toploader";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/app/StoreProvider";

import dynamic from "next/dynamic";

import openGraph from "./opengraph-image.jpg";
import MaintenancePage from "./MaintenancePage";
import { MaintenanceNotice } from "./MaintenanceNotice";
import SetNecessaryCookies from "./SetNecessaryCookies";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { getOneDoc } from "@/lib/db/getOperationDB";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";

const monse = Montserrat({
  subsets: ["latin"],
  variable: "--font-monserrat",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});
const tradegothic = localFont({
  src: "../public/fonts/gothic_extended.otf",
  variable: "--font-tradegothic",
  display: "swap",
});

export const metadata = {
  title: "CHECK-IN VENEZUELA | Tu Agencia de Viajes 24/7",
  description:
    "CHECK-IN VENEZUELA es tu agencia de viajes en Caracas. Reserva vuelos, hoteles y paquetes turísticos con atención 24/7. Tu aventura comienza aquí.",
  keywords: [
    "viajes",
    "agencia de viajes",
    "check-in venezuela",
    "vuelos",
    "hoteles",
    "caracas",
    "venezuela",
    "turismo",
    "reservas",
    "paquetes turísticos",
    "travel agency",
    "24/7",
  ],
  metadataBase: new URL("https://checkinvenezuela.com"),
  openGraph: {
    title: "CHECK-IN VENEZUELA | Tu Agencia de Viajes 24/7",
    description:
      "Tu agencia de viajes en Caracas, Venezuela. Reserva vuelos, hoteles y paquetes turísticos con atención personalizada 24/7.",
    siteName: "CHECK-IN VENEZUELA",
    images: [
      {
        url: openGraph.src,
        width: openGraph.width,
        height: openGraph.height,
      },
    ],
    locale: "es_VE",
    type: "website",
  },
};

export default async function RootLayout({ children }) {
  const Notice = dynamic(
    () => import("@/app/_notice").then((mod) => mod.Notice),
    {
      ssr: false,
    },
  );

  const websiteConfig = await getOneDoc(
    "WebsiteConfig",
    {},
    ["websiteConfig"],
    60,
  );

  const maintenanceMode = websiteConfig?.maintenanceMode ?? { enabled: false };

  const alloweRoutesWhileMaintenance = maintenanceMode?.allowlistedRoutes ?? [];
  const currentPathname = headers().get("x-pathname");

  return (
    <html lang="en" className={`${tradegothic.variable} ${monse.variable}`}>
      <body className={monse.className}>
        {maintenanceMode.enabled === true &&
        !alloweRoutesWhileMaintenance.some(
          (path) =>
            path === currentPathname ||
            (path !== "/" && currentPathname.startsWith(path)),
        ) ? (
          <MaintenancePage
            message={maintenanceMode.message}
            startsAt={maintenanceMode.startsAt || 0}
            endsAt={maintenanceMode.endsAt || 0}
          />
        ) : (
          <StoreProvider>
            <div className="mx-auto max-w-[1440px]">
              <Notice />
              <MaintenanceNotice maintenanceMode={maintenanceMode} />
              {children}
            </div>
          </StoreProvider>
        )}
        <NextTopLoader showSpinner={false} color="#004077" />
        <Toaster richColors closeButton expand position="top-right" />
        <SetNecessaryCookies />
        <WhatsAppButton />
        <Analytics />
      </body>
    </html>
  );
}
