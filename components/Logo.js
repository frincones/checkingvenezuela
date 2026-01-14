import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo Component - Venezuela Voyages
 * @param {string} className - Clases adicionales de Tailwind
 * @param {string} size - "sm" (78px) | "md" (117px) | "lg" (156px) | "xl" (195px)
 */
export function Logo({ className, size = "md" }) {
  // Tamaños aumentados 30% adicional: sm 60->78, md 90->117, lg 120->156, xl 150->195
  const sizeClasses = {
    sm: "h-[78px]",
    md: "h-[117px]",
    lg: "h-[156px]",
    xl: "h-[195px]",
  };

  return (
    <Link aria-label={"Venezuela Voyages - Ir a inicio"} href={"/"}>
      <Image
        src="/images/venezuela-voyages-logo.png"
        alt="Venezuela Voyages Logo - Explore Now"
        width={430}
        height={156}
        className={cn(
          "w-auto object-contain transition-transform hover:scale-105",
          sizeClasses[size] || sizeClasses.md,
          className
        )}
        priority
      />
    </Link>
  );
}
