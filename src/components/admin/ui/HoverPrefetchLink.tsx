"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * Lien de navigation qui ne précharge sa destination qu'au SURVOL.
 *
 * 🔴 2026-09-02 — audit UI de la console. La barre latérale rend jusqu'à
 * ~150 liens, tous dans la fenêtre d'affichage. Avec le `<Link>` de base, Next
 * précharge chaque lien visible dès l'ouverture de la page : 16 à 30 requêtes
 * `?_rsc=` par page admin, dont 20 à 60 % en 503 ou en attente > 10 s, et la
 * première page restée 40 s sur « Chargement de la page admin ». Les routes
 * admin sont dynamiques (`force-dynamic`) avec un `loading.tsx` : chaque
 * préchargement coûte un rendu serveur partiel, pour des pages que
 * l'exploitant n'ouvrira pas.
 *
 * Motif recommandé par la documentation Next livrée avec la version installée
 * (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`,
 * « Disabling prefetching ») : `prefetch={false}` tant que la souris n'est pas
 * passée dessus, puis `null` (comportement par défaut) au premier survol. Le
 * clic sur un lien jamais survolé (clavier, tactile) reste une navigation
 * normale : la route est rendue à la demande.
 */
export function HoverPrefetchLink({
  onMouseEnter,
  onFocus,
  ...props
}: ComponentProps<typeof Link>) {
  const [armed, setArmed] = useState(false);
  return (
    <Link
      {...props}
      prefetch={armed ? null : false}
      onMouseEnter={(e) => {
        setArmed(true);
        onMouseEnter?.(e);
      }}
      // Navigation clavier : le focus vaut survol, sinon l'utilisateur au
      // clavier paierait le rendu complet là où la souris aurait préchargé.
      onFocus={(e) => {
        setArmed(true);
        onFocus?.(e);
      }}
    />
  );
}
