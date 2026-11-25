// Le règlement d'un challenge publié, tel qu'il a été publié (texte figé, rendu en texte brut).
// Réservé à un apporteur SIGNÉ avec un lien personnel valide, hors mode restreint. Tout autre cas
// (jeton faux, ancien jeton, fiche non signée, mode restreint, lien d'exemple, interrupteur
// éteint, aucun challenge publié) : 404 neutre. Aucune donnée d'apporteur n'est lue.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { jourParis } from "@/features/apporteurs-reseau/autofacture-donnees";
import { lireReglementChallenge } from "@/features/apporteurs-reseau/challenge-donnees";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { challengesEspaceActifs } from "@/features/apporteurs-reseau/interrupteur-challenges-espace";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature";

import { Coquille } from "../../Coquille";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Règlement — Axion-IA" },
  robots: { index: false, follow: false, nocache: true },
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
}

export default async function ReglementChallengePage({ params }: PageProps) {
  const { id, jeton } = await params;
  if (!challengesEspaceActifs()) notFound();
  if (id.toLowerCase() === ID_DOSSIER_EXEMPLE) notFound();
  const dossier = await lireDossierParLien(id, jeton);
  if (!dossier || dossier.restreint || etatDeLaPage(dossier.statut) !== "signe") notFound();
  let vue = null;
  try {
    vue = await lireReglementChallenge(jourParis(new Date()));
  } catch {
    notFound();
  }
  if (!vue) notFound();
  return (
    <Coquille titre={vue.titre}>
      <div className="border-border bg-paper mt-5 rounded-2xl border p-5 text-[17px] leading-relaxed whitespace-pre-line">
        {vue.reglement}
      </div>
      <a
        href={`/apporteur/dossier/${id}/${jeton}`}
        className="text-terracotta-deep mt-5 inline-flex min-h-[48px] items-center gap-2 font-bold underline underline-offset-4"
      >
        ← Retour à mon espace
      </a>
    </Coquille>
  );
}
