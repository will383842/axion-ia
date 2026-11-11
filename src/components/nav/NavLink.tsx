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
  /**
   * Onglet « phare » : la Journée IA, notre offre essentielle. Décision de Williams
   * (08/11/2026) : « il faudrait qu'il soit bien visible, qu'il ressorte, entouré,
   * une autre couleur ». Rendu en pastille entourée, précédée d'un point terracotta.
   */
  phare?: boolean;
  /** Sous-ligne du tiroir mobile (ex. « Une journée chez vous · 1 490 € HT »). */
  sub?: string | undefined;
}

/**
 * Refonte en-tête/pied du 2026-11-11 — en-tête IVOIRE (il était terracotta).
 *
 * Contraste : texte `fg` sur `bg` ivoire ≈ 16:1 ; soulignement et point en
 * terracotta (5,5:1 sur ivoire), qui ne portent jamais SEULS l'information : l'onglet
 * actif a `aria-current="page"` et un soulignement plein, un onglet inactif n'en a
 * pas (WCAG 1.4.1).
 */
export function NavLink({ href, label, variant = "desktop", phare = false, sub }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (variant === "mobile") {
    return (
      <Link
        href={href as never}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "border-border text-fg hover:bg-sand/70 focus-visible:ring-terracotta flex min-h-12 flex-col justify-center border-b px-2 py-3 text-[17px] font-semibold tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none",
          isActive && "text-terracotta",
        )}
      >
        <span className="inline-flex items-center gap-2">
          {phare ? (
            <span aria-hidden="true" className="bg-terracotta inline-block h-2 w-2 rounded-full" />
          ) : null}
          {label}
        </span>
        {sub ? <small className="text-fg-muted text-[13px] font-medium">{sub}</small> : null}
      </Link>
    );
  }

  if (phare) {
    return (
      <Link
        href={href as never}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "border-terracotta bg-terracotta-soft text-fg hover:bg-paper focus-visible:ring-terracotta focus-visible:ring-offset-bg inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base font-semibold tracking-tight whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          isActive && "underline decoration-2 underline-offset-4",
        )}
      >
        <span aria-hidden="true" className="bg-terracotta inline-block h-2 w-2 rounded-full" />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href as never}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "text-fg focus-visible:ring-terracotta focus-visible:ring-offset-bg relative inline-flex min-h-11 items-center rounded-lg px-3 text-base font-semibold tracking-tight whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "after:bg-terracotta after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:origin-left after:transition-transform motion-reduce:after:transition-none",
        isActive ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
      )}
    >
      {label}
    </Link>
  );
}
