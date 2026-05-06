"use client";
// use-client: usePathname() needs the client runtime to read the active URL
// and apply the `aria-current="page"` + visual underline.

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  label: string;
  variant?: "desktop" | "mobile";
}

// Editorial v3 — desktop: italique terracotta sur item actif (signature Anthropic).
// Mobile: bg sand sur item actif (full-width row).
export function NavLink({ href, label, variant = "desktop" }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (variant === "mobile") {
    return (
      <Link
        href={href as never}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "text-fg -mx-3 rounded-md px-3 py-3 font-medium",
          isActive ? "bg-sand text-terracotta italic" : "hover:bg-sand/60",
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href as never}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative text-sm font-medium tracking-tight transition-colors",
        isActive ? "text-terracotta italic" : "text-fg-soft hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}
