import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo Component - Venezuela Voyages
 * @param {string} className - Clases adicionales de Tailwind
 * @param {string} variant - "default" | "white" para fondos oscuros
 */
export function Logo({ className, variant = "default" }) {
  return (
    <Link aria-label={"Venezuela Voyages - Ir a inicio"} href={"/"}>
      <Image
        src="/images/venezuela-voyages-logo.png"
        alt="Venezuela Voyages Logo - Explore Now"
        width={180}
        height={60}
        className={cn(
          "h-[50px] w-auto object-contain transition-transform hover:scale-105",
          className
        )}
        priority
      />
    </Link>
  );
}
