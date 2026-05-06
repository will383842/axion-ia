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

// Desktop: subtle underline indicator. Mobile: bg tint (full-width row).
// Active match = pathname starts with href (so /interventions/essentielle
// also marks /interventions as the parent module).
export function NavLink({ href, label, variant = "desktop" }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (variant === "mobile") {
    return (
      <Link
        href={href as never}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "text-fg -mx-3 rounded-sm px-3 py-3 font-medium",
          isActive ? "bg-primary/10 text-primary" : "hover:bg-border/40",
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
        isActive
          ? "text-primary after:bg-primary after:absolute after:inset-x-0 after:-bottom-1.5 after:h-0.5"
          : "text-fg hover:text-primary",
      )}
    >
      {label}
    </Link>
  );
}
