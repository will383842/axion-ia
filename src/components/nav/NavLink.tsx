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
   * une autre couleur ». Rendu en pastille MOKA cerclée d'ivoire sur la barre
   * terracotta (jamais orange sur orange), précédée d'un point terracotta clair.
   */
  phare?: boolean;
  /** Sous-ligne du tiroir mobile (ex. « Une journée chez vous · 1 490 € HT »). */
  sub?: string | undefined;
}

/**
 * Onglets de la barre TERRACOTTA (correctif du 2026-11-11 : l'en-tête reste orange,
 * demande de Williams). Contrastes, mesurés par `scripts/check-contrast.ts` :
 *   - onglet : `mocha-fg` sur terracotta = 5,24:1 (4,78:1 au pire sous le voile
 *     `bg-terracotta/95` posé sur une page blanche) ;
 *   - « La Journée IA » : `mocha-fg` sur `mocha` = 13,70:1 (survol `mocha-soft` :
 *     10,73:1), contour ivoire pour que la pastille se détache franchement.
 *
 * ⚠️ NE PAS REMETTRE `text-mocha` ni `text-fg` sur la barre : 2,61:1 sur terracotta.
 *
 * Le soulignement ivoire ne porte jamais SEUL l'information : l'onglet actif a
 * `aria-current="page"` et un soulignement plein, un onglet inactif n'en a pas
 * (WCAG 1.4.1). Le tiroir mobile (`variant="mobile"`) reste sur fond clair.
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
          "border-mocha-fg bg-mocha text-mocha-fg hover:bg-mocha-soft focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base font-semibold tracking-tight whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          isActive && "underline decoration-2 underline-offset-4",
        )}
      >
        <span
          aria-hidden="true"
          className="bg-terracotta-on-mocha inline-block h-2 w-2 rounded-full"
        />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href as never}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "text-mocha-fg focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta relative inline-flex min-h-11 items-center rounded-lg px-3 text-base font-semibold tracking-tight whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "after:bg-mocha-fg after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:origin-left after:transition-transform motion-reduce:after:transition-none",
        isActive ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
      )}
    >
      {label}
    </Link>
  );
}
