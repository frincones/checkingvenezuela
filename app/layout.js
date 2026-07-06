import { Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import NextTopLoader from "nextjs-toploader";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/app/StoreProvider";

import dynamic from "next/dynamic";

import openGraph from "./opengraph-image.jpg";
import MaintenancePage from "./MaintenancePage";
import { MaintenanceNotice } from "./MaintenanceNotice";
import SetNecessaryCookies from "./SetNecessaryCookies";
import { BannersSidebar } from "@/components/pages/home/sections/BannersSection";
import { AnnouncementBar } from "@/components/sections/AnnouncementBar";
import { ChatWidget } from "@/components/ChatWidget/ChatWidget";
import { getOneDoc } from "@/lib/db/getOperationDB";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-ZP34JNKX19";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || "xiaowbmnuh";

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
  title: "VENEZUELA VOYAGES | Signature Travel Experiences",
  description:
    "Signature travel experiences in Venezuela. We design exclusive itineraries to the country's most extraordinary destinations — flights, hotels and curated packages with 24/7 personalized service.",
  keywords: [
    "signature travel",
    "exclusive experiences",
    "luxury travel venezuela",
    "venezuela voyages",
    "exclusive destinations",
    "private itineraries",
    "venezuela travel agency",
    "flights",
    "hotels",
    "venezuela",
    "tourism",
    "24/7",
  ],
  metadataBase: new URL("https://venezuelavoyages.com"),
  openGraph: {
    title: "VENEZUELA VOYAGES | Signature Travel Experiences",
    description:
      "Signature travel experiences in Venezuela. We design exclusive itineraries to the country's most extraordinary destinations. Available 24/7.",
    siteName: "VENEZUELA VOYAGES",
    images: [
      {
        url: openGraph.src,
        width: openGraph.width,
        height: openGraph.height,
      },
    ],
    locale: "en_VE",
    type: "website",
  },
  other: {
    "yandex-verification": "cdd9a3992d76e5b0",
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

  // Soporte para variable de entorno MAINTENANCE_MODE (más simple que DB)
  // Configurar en Vercel: MAINTENANCE_MODE=true
  // Opcionalmente: MAINTENANCE_MESSAGE="Tu mensaje personalizado"
  // Opcionalmente: MAINTENANCE_ENDS_AT="2025-01-20T18:00:00Z"
  const envMaintenanceEnabled = process.env.MAINTENANCE_MODE === "true";

  const maintenanceMode = envMaintenanceEnabled
    ? {
        enabled: true,
        message: process.env.MAINTENANCE_MESSAGE || "Estamos realizando mejoras para brindarte una mejor experiencia. Volvemos pronto.",
        endsAt: process.env.MAINTENANCE_ENDS_AT || null,
        allowlistedRoutes: ["/support", "/api"],
      }
    : (websiteConfig?.maintenanceMode ?? { enabled: false });

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
              <AnnouncementBar />
              <Notice />
              <MaintenanceNotice maintenanceMode={maintenanceMode} />
              {children}
            </div>
          </StoreProvider>
        )}
        <NextTopLoader showSpinner={false} color="#F2A93B" />
        <Toaster richColors closeButton expand position="top-right" />
        <SetNecessaryCookies />
        {!currentPathname?.startsWith("/dashboard") && <BannersSidebar />}
        {!currentPathname?.startsWith("/dashboard") && <ChatWidget />}
        <Analytics />
        {/* Google Analytics 4 — beforeInteractive lands the tag in the
            server-rendered <head>, which is what the GA setup wizard
            (a JS-less scraper) requires to detect the tag. Real users
            still get the same behaviour; TTI impact is negligible
            because both scripts are async. */}
        {GA_ID && (
          <>
            <Script
              id="ga4-loader"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="beforeInteractive"
            />
            <Script id="ga4-init" strategy="beforeInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
        {/* Microsoft Clarity — session recordings + heatmaps. Same
            beforeInteractive placement as GA4 so Microsoft's install
            wizard picks it up from the raw HTML. */}
        {CLARITY_ID && (
          <Script id="clarity-init" strategy="beforeInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${CLARITY_ID}");
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
