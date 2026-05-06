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

// Editorial v3 — desktop on mocha header: italique terracotta-soft sur item
// actif. Underline animée terracotta. Mobile (drawer ivoire): bg sand sur item
// actif (full-width row).
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
        // Underline animée terracotta sur hover/active
        "after:bg-terracotta-soft after:absolute after:-bottom-1.5 after:left-0 after:h-px after:transition-all after:duration-300",
        isActive
          ? "text-terracotta-soft italic after:w-full"
          : "text-mocha-fg/75 hover:text-mocha-fg after:w-0 hover:after:w-full",
      )}
    >
      {label}
    </Link>
  );
}
