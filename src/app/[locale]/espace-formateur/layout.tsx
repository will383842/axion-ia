/**
 * Espace formateur — métadonnées et `noindex`.
 *
 * ## Ce que ce layout ne fait plus
 *
 * Il portait une barre supérieure et une barre d'onglets (`FormateurNav`), un
 * composant CLIENT qui résolvait la section active avec `usePathname()`. La
 * navigation coûtait donc du JavaScript sur chaque page de l'espace, pour une
 * information que le serveur connaît déjà.
 *
 * 🔴 Un layout ne peut PAS connaître le chemin courant côté serveur — c'est
 * précisément pourquoi l'ancienne barre était cliente. La coquille (barre
 * latérale + barre du bas) est donc composée par CHAQUE page, qui déclare sa
 * propre section. Voir `_coquille.tsx`.
 *
 * ⚠️ La page de connexion n'a ni session ni navigation : elle rend son propre
 * cadre et ne passe volontairement pas par la coquille.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Espace formateur — Axion-IA",
  robots: { index: false, follow: false },
};

export default function EspaceFormateurLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
