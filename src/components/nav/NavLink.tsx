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
  // Si vrai, le label peut s'étaler sur plusieurs lignes (utile pour les
  // intitulés longs qu'on veut compacter horizontalement dans le header).
  // Le label doit contenir `\n` aux endroits où on souhaite forcer un saut.
  multiline?: boolean;
}

// Editorial v3 — desktop on terracotta header (fixe, pas de scroll-aware) :
// italique mocha sur item actif, underline animée mocha-fg.
// Mobile (drawer ivoire): bg sand sur item actif.
export function NavLink({ href, label, variant = "desktop", multiline = false }: NavLinkProps) {
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
        "relative text-[17px] font-semibold tracking-tight transition-colors",
        // Underline animée 2px ivoire — couleur fixe sur fond terracotta
        "after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:transition-all after:duration-300",
        "[[data-tone=terracotta]_&]:after:bg-mocha-fg",
        // Mode multi-lignes : honore les `\n` dans le label, compacte la
        // hauteur de ligne et centre le texte pour un visuel équilibré.
        // Sinon, force le single-line pour éviter tout retour à la ligne
        // intempestif quand le container devient étroit (≤ ~1400px).
        multiline ? "text-center leading-[1.15] whitespace-pre-line" : "whitespace-nowrap",
        isActive
          ? "text-mocha italic after:w-full"
          : "text-mocha-fg hover:text-mocha [[data-tone=terracotta]_&]:after:w-0 [[data-tone=terracotta]_&]:hover:after:w-full",
      )}
    >
      {label}
    </Link>
  );
}
