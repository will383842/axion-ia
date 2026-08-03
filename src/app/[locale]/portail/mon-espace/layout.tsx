/**
 * Espace stagiaire — métadonnées et rendu dynamique.
 *
 * 🔴 Ce layout ne porte PAS la barre latérale, et c'est délibéré. Un layout ne
 * connaît pas le chemin courant côté serveur : `usePathname()` est réservé au
 * client, et `headers()` rendrait l'arbre dynamique pour une information dont
 * seule la surbrillance de la barre a besoin. Une première version calculait la
 * section « depuis l'enfant » — elle renvoyait en réalité toujours la même, et
 * aucune entrée n'aurait jamais été surlignée.
 *
 * La coquille est donc composée par CHAQUE page, qui déclare sa propre section
 * (cf. `_coquille.tsx`). Les données ne sont pas chargées deux fois : le
 * chargement passe par `cache()` de React.
 */

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mon espace",
  robots: { index: false, follow: false },
};

export default function MonEspaceLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
