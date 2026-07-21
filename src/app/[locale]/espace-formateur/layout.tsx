/**
 * Espace formateur — layout (noindex, FR uniquement, 2026-06-13).
 *
 * Outil interne : jamais indexé. La barre supérieure affiche le nom du
 * formateur + déconnexion quand une session est active (lecture seule du
 * cookie, autorisée en Server Component).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getFormateurSession } from "@/server/formateur/guard";
import { FormateurLogoutButton } from "@/components/espace-formateur/FormateurLogoutButton";
import { FormateurNav } from "@/components/espace-formateur/FormateurNav";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";

export const metadata: Metadata = {
  title: "Espace formateur — Axion-IA",
  robots: { index: false, follow: false },
};

export default async function EspaceFormateurLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await getFormateurSession();
  return (
    <div className="bg-bg min-h-screen">
      <header className="border-border bg-sand border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href={FORMATEUR_BASE_PATH} className="text-mocha font-serif text-lg font-semibold">
            Espace formateur
          </Link>
          {session ? (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-fg-muted">
                {session.prenom} {session.nom}
              </span>
              <FormateurLogoutButton />
            </div>
          ) : null}
        </div>
        <FormateurNav />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
