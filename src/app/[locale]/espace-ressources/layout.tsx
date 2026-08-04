/**
 * Espace ressources — layout (noindex, FR).
 * Portail sans mot de passe, pour les commerciaux et les formateurs.
 *
 * ## Pourquoi PAS de barre latérale ici
 *
 * Cet espace n'a qu'UNE destination : ses documents. Une barre de navigation à
 * une seule entrée n'oriente personne — elle occupe de la place et laisse croire
 * qu'il existe ailleurs où aller. Il reprend donc le langage visuel des deux
 * autres espaces (mêmes surfaces, même typographie, même en-tête) sans leur
 * navigation, qui n'aurait rien à porter.
 *
 * Le jour où une seconde section apparaît, `EspaceShell` est là pour ça.
 *
 * 🔴 L'en-tête portait `bg-cream` — une classe MORTE : aucune règle CSS ne la
 * définit côté site public. Le fond n'a donc jamais été appliqué, et la barre se
 * confondait avec la page. Remplacée par `bg-paper`, qui existe.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { getRecipientSession } from "@/server/ressources/guard";
import { RessourcesLogoutButton } from "@/components/espace-ressources/RessourcesLogoutButton";
import { RESSOURCES_BASE_PATH } from "@/server/ressources/routes";

export const metadata: Metadata = {
  title: "Espace ressources — Axion-IA",
  robots: { index: false, follow: false },
};

export default async function EspaceRessourcesLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await getRecipientSession();

  return (
    <div className="bg-bg min-h-screen">
      {/*
        En-tête SOMBRE comme la barre latérale des deux autres espaces
        (2026-08-04). Cet espace n'a qu'une section, donc pas de navigation à
        montrer et pas d'`EspaceShell` — mais un en-tête clair face à deux
        espaces désormais sombres aurait donné trois interfaces au lieu d'une.
        La cohérence prime ici sur la mutualisation du composant.
      */}
      <header className="bg-mocha">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href={RESSOURCES_BASE_PATH}
            className="text-mocha-fg font-serif text-lg font-semibold"
          >
            Espace ressources
          </Link>
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-mocha-fg-muted hidden text-sm sm:inline">
                {session.nom ?? session.email}
              </span>
              <RessourcesLogoutButton />
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">{children}</main>
    </div>
  );
}
