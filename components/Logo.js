import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo Component - Venezuela Voyages
 * @param {string} className - Clases adicionales de Tailwind
 * @param {string} size - "sm" (40px) | "md" (60px) | "lg" (80px) | "xl" (100px)
 */
export function Logo({ className, size = "md" }) {
  const sizeClasses = {
    sm: "h-[40px]",
    md: "h-[60px]",
    lg: "h-[80px]",
    xl: "h-[100px]",
  };

  return (
    <Link aria-label={"Venezuela Voyages - Ir a inicio"} href={"/"}>
      <Image
        src="/images/venezuela-voyages-logo.png"
        alt="Venezuela Voyages Logo - Explore Now"
        width={220}
        height={80}
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
