/**
 * Espace ressources — layout (noindex, FR, 2026-06-13).
 * Portail passwordless commerciaux + formateurs.
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
      <header className="border-border bg-sand border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href={RESSOURCES_BASE_PATH} className="text-mocha font-serif text-lg font-semibold">
            Espace ressources
          </Link>
          {session ? (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-fg-muted">{session.nom ?? session.email}</span>
              <RessourcesLogoutButton />
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
