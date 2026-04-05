"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import routes from "@/data/routes.json";
export function ActiveNavLink({ className, ...props }) {
  const pathname = usePathname();

  const activeLink = (link) => {
    if (pathname.startsWith(link)) {
      return "border-b-4 border-primary";
    }
  };
  return (
    <div className={cn(className)} {...props}>
      <Button
        asChild
        variant="link"
        className={"h-[inherit] rounded-none text-inherit"}
      >
        <Link
          href={routes.packages.path}
          className={cn("inline-flex gap-2", activeLink(routes.packages.path))}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16.5 9.4 7.55 4.24"></path>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.29 7 12 12 20.71 7"></polyline>
            <line x1="12" x2="12" y1="22" y2="12"></line>
          </svg>
          <span>{routes.packages.title}</span>
        </Link>
      </Button>
      <Button
        asChild
        variant="link"
        className={"h-[inherit] rounded-none text-inherit"}
      >
        <Link
          href="/blog"
          className={cn("inline-flex gap-2", activeLink("/blog"))}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"></path>
            <path d="M18 2h4v4"></path>
            <path d="m21 3-9 9"></path>
            <path d="M7 16h6M7 8h6v4H7z"></path>
          </svg>
          <span>Blog</span>
        </Link>
      </Button>
    </div>
  );
}
