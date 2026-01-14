import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo Component - Venezuela Voyages
 * @param {string} className - Clases adicionales de Tailwind
 * @param {string} size - "sm" (60px) | "md" (90px) | "lg" (120px) | "xl" (150px)
 */
export function Logo({ className, size = "md" }) {
  // Tamaños aumentados 50%: sm 40->60, md 60->90, lg 80->120, xl 100->150
  const sizeClasses = {
    sm: "h-[60px]",
    md: "h-[90px]",
    lg: "h-[120px]",
    xl: "h-[150px]",
  };

  return (
    <Link aria-label={"Venezuela Voyages - Ir a inicio"} href={"/"}>
      <Image
        src="/images/venezuela-voyages-logo.png"
        alt="Venezuela Voyages Logo - Explore Now"
        width={330}
        height={120}
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
