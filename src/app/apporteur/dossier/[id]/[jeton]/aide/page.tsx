// BESOIN D'AIDE ? — la demande d'aide de l'espace de l'apporteur.
//
// `/apporteur/dossier/<apporteurId>/<jeton>/aide` : un sujet, un message, et l'équipe est
// prévenue par une alerte interne. Même contrôle que les pages sœurs (`lireDossierParLien` :
// jeton et version du lien) ; l'action le refait côté serveur. Lien invalide, dossier refusé ou
// résilié, lien d'exemple de l'aperçu : la page neutre, sans 404 brutal.
//
// Ouverte aussi en MODE RESTREINT (retiré du réseau, argent encore en jeu) : c'est là qu'une
// question sur ses commissions a le plus de chances de se poser.

import type { Metadata } from "next";

import { envoyerDemandeAide } from "@/features/apporteurs-reseau/demande-aide";
import { TEXTES_AIDE } from "@/features/apporteurs-reseau/demande-aide-textes";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature-regles";

import { Coquille, EcranInvalide } from "../Coquille";

import { FormulaireAide } from "./FormulaireAide";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Besoin d'aide ? — Axion-IA" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
}

export default async function AideApporteurPage({ params }: PageProps) {
  const { id, jeton } = await params;
  const dossier =
    id.toLowerCase() === ID_DOSSIER_EXEMPLE ? null : await lireDossierParLien(id, jeton);
  if (!dossier || etatDeLaPage(dossier.statut) === "neutre") {
    return (
      <Coquille>
        <EcranInvalide />
      </Coquille>
    );
  }

  return (
    <Coquille titre={TEXTES_AIDE.titre} sansAide>
      <p className="text-fg-soft mt-5 text-[16px] leading-relaxed">{TEXTES_AIDE.intro}</p>
      <FormulaireAide envoyerAction={envoyerDemandeAide.bind(null, dossier.id, jeton)} />
      <a
        href={`/apporteur/dossier/${dossier.id}/${jeton}`}
        className="text-terracotta-deep focus-visible:outline-terracotta mt-8 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid"
      >
        {TEXTES_AIDE.retour}
      </a>
    </Coquille>
  );
}
