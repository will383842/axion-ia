"use client";
// use-client: lit l'identifiant et le jeton dans l'adresse (useParams) pour bâtir le lien d'aide.

// Le lien « Besoin d'aide ? » de la coquille. La coquille ne reçoit ni l'identifiant ni le
// jeton : ils sont lus dans l'adresse de la page. Rendu côté serveur comme un lien ordinaire
// (il marche sans JavaScript) ; rien n'est affiché hors d'un espace personnel.

import { useParams } from "next/navigation";

import { TEXTES_AIDE } from "@/features/apporteurs-reseau/demande-aide-textes";

export function LienAide() {
  const { id, jeton } = useParams<{ id?: string; jeton?: string }>() ?? {};
  if (typeof id !== "string" || typeof jeton !== "string") return null;
  return (
    <p className="mt-8">
      <a
        href={`/apporteur/dossier/${encodeURIComponent(id)}/${encodeURIComponent(jeton)}/aide`}
        className="text-terracotta-deep focus-visible:outline-terracotta inline-flex min-h-[48px] items-center text-[17px] font-bold underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid"
      >
        {TEXTES_AIDE.lien}
      </a>
    </p>
  );
}
