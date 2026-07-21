"use client";
// use-client: détection de la route active (usePathname) pour marquer l'onglet courant + aria-current.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { FORMATEUR_SESSIONS_PATH } from "@/server/formateur/collectif-labels";

interface Entree {
  href: string;
  label: string;
  /** Actif si le pathname correspond exactement, ou commence par (sous-routes). */
  matchPrefix?: boolean;
}

const ENTREES: Entree[] = [
  { href: FORMATEUR_SESSIONS_PATH, label: "Mes formations", matchPrefix: true },
  { href: FORMATEUR_BASE_PATH, label: "Mes séances 1-to-1" },
];

export function FormateurNav(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation espace formateur"
      className="border-border mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-1 border-t px-4 py-2 font-serif text-sm"
    >
      {ENTREES.map((e) => {
        // « Mes séances 1-to-1 » (racine) ne doit pas s'activer sur /sessions.
        const actif = e.matchPrefix
          ? pathname.startsWith(e.href)
          : pathname === e.href || pathname === `${e.href}/`;
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={actif ? "page" : undefined}
            className={
              actif
                ? "text-mocha font-semibold underline underline-offset-4"
                : "text-fg-muted hover:text-terracotta"
            }
          >
            {e.label}
          </Link>
        );
      })}
    </nav>
  );
}
