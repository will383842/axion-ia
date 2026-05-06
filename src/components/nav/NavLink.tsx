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

// Editorial v3 — desktop on terracotta header (or mocha when scrolled):
// font-semibold base pour visibilité maximale, underline 2px animée mocha-fg,
// active = italique mocha + bold + underline pleine.
// Mobile (drawer ivoire): bg sand sur item actif (full-width row).
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
        "relative text-base font-semibold tracking-tight transition-colors",
        // Underline animée 2px (vs 1px précédent) — couleur adaptée au tone
        "after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:transition-all after:duration-300",
        // Header terracotta : underline ivoire / scrolled mocha : underline terracotta-soft
        "[[data-tone=terracotta]_&]:after:bg-mocha-fg",
        "[[data-tone=terracotta]_[data-scrolled=true]_&]:after:bg-terracotta-soft",
        isActive
          ? "text-mocha [[data-tone=terracotta]_[data-scrolled=true]_&]:text-terracotta-soft italic after:w-full [[data-tone=terracotta]_&]:after:w-full"
          : "text-mocha-fg hover:text-mocha [[data-tone=terracotta]_[data-scrolled=true]_&]:text-mocha-fg [[data-tone=terracotta]_[data-scrolled=true]_&]:hover:text-terracotta-soft [[data-tone=terracotta]_&]:after:w-0 [[data-tone=terracotta]_&]:hover:after:w-full",
      )}
    >
      {label}
    </Link>
  );
}
