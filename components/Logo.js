import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, variant = "default" }) {
  return (
    <Link aria-label={"Check-in Venezuela - Ir a inicio"} href={"/"}>
      <Image
        src="/images/checkin-venezuela-logo.png"
        alt="Check-in Venezuela Logo"
        width={150}
        height={50}
        className={cn("h-[40px] w-auto object-contain", className)}
        priority
      />
    </Link>
  );
}
