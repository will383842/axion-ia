"use client";
// use-client: usePathname() needs the client runtime to read the active URL
// and apply the `aria-current="page"` + visual underline.

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  label: string;
  variant?: "desktop" | "mobile";
  // Si vrai, le label peut s'étaler sur plusieurs lignes (utile pour les
  // intitulés longs qu'on veut compacter horizontalement dans le header).
  // Le label doit contenir `\n` aux endroits où on souhaite forcer un saut.
  multiline?: boolean;
  // Emoji affiché dans une tuile à gauche du label — drawer mobile 2026
  // uniquement (ignoré en desktop). Ajoute un repère visuel par onglet.
  // `| undefined` explicite : la valeur vient d'un lookup Record (→ `string |
  // undefined` sous noUncheckedIndexedAccess) et doit passer exactOptionalPropertyTypes.
  icon?: string | undefined;
}

// Editorial v3 — desktop on terracotta header (fixe, pas de scroll-aware) :
// italique + underline pleine mocha-fg sur item actif (voir le garde-fou de
// contraste plus bas — l'actif était en mocha sombre, non conforme AA).
// Mobile (drawer 2026): rangée à tuile emoji + chevron, actif = terracotta.
export function NavLink({
  href,
  label,
  variant = "desktop",
  multiline = false,
  icon,
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (variant === "mobile") {
    return (
      <Link
        href={href as never}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-[15px] font-semibold tracking-tight transition-colors",
          isActive ? "bg-terracotta/10 text-terracotta" : "text-fg hover:bg-sand/70",
        )}
      >
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg transition-colors",
              isActive ? "bg-terracotta/15" : "bg-paper shadow-subtle",
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className="flex-1">{label}</span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 transition-all",
            isActive
              ? "text-terracotta"
              : "text-fg-muted/40 group-hover:text-terracotta group-hover:translate-x-0.5",
          )}
        />
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
        // ⚠️ NE PAS REMETTRE `text-mocha` ICI. Le mocha sombre sur l'en-tête
        // terracotta ne donne que 2,84:1, très en dessous du seuil AA de 4,5 —
        // relevé par axe-core en production sur /fr/audit, /fr/interventions et
        // /fr/implementation (nightly rouge six nuits d'affilée, 2026-07-31).
        // `text-mocha-fg` donne 4,82:1.
        //
        // Seules ces trois pages échouaient parce que ce sont les seules des 15
        // pages auditées à avoir une entrée de menu correspondante, donc un lien
        // ACTIF. /fr/appel n'en a pas.
        //
        // L'état actif reste parfaitement identifiable SANS la couleur : il
        // porte l'italique ET le soulignement plein (`after:w-full`), là où un
        // lien inactif n'a pas de soulignement. C'est d'ailleurs plus conforme
        // au critère WCAG 1.4.1 (ne pas véhiculer une information par la seule
        // couleur) que ne l'était la version précédente.
        //
        // `hover:text-mocha` a disparu de la ligne inactive pour la même raison
        // — c'était le même contraste de 2,84:1, simplement non testé par axe
        // qui n'évalue pas le survol. Le retour au survol reste assuré par le
        // soulignement qui se déploie (`hover:after:w-full`).
        isActive
          ? "text-mocha-fg italic after:w-full"
          : "text-mocha-fg [[data-tone=terracotta]_&]:after:w-0 [[data-tone=terracotta]_&]:hover:after:w-full",
      )}
    >
      {label}
    </Link>
  );
}
