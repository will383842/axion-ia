// MES OUTILS DE COMMUNICATION (décision de Will, 2026-10-09).
//
// `/apporteur/dossier/<apporteurId>/<jeton>/outils` : des pièces prêtes à l'emploi pour parler
// d'Axion-IA — bannière LinkedIn et couverture Facebook à son nom, signature d'e-mail, visuels de
// publication, story, textes, logo. Le contrat (art. 22 bis) autorise la communication de
// l'apporteur dans le respect de la charte : ces pièces la respectent d'office.
//
// Réservé à un apporteur SOUS CONTRAT SIGNÉ, par son lien personnel (même contrôle que son
// espace). Sinon — lien invalide, dossier pas encore signé, fiche retirée, lien d'exemple — un
// message sobre, sans 404 brutal, comme la grille de référence.

import type { Metadata } from "next";

import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { OUTILS_RESERVES } from "@/features/apporteurs-reseau/outils-communication";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature-regles";

import { Coquille, EcranEtat } from "../Coquille";

import { OutilsCommunication } from "./OutilsCommunication";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Mes outils de communication — Axion-IA" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
}

export default async function OutilsCommunicationPage({ params }: PageProps) {
  const { id, jeton } = await params;
  const dossier =
    id.toLowerCase() === ID_DOSSIER_EXEMPLE ? null : await lireDossierParLien(id, jeton);
  if (!dossier || dossier.restreint || etatDeLaPage(dossier.statut) !== "signe") {
    return (
      <Coquille>
        <EcranEtat
          pastilleTexte="Réservé"
          titre={OUTILS_RESERVES.titre}
          ligne={OUTILS_RESERVES.texte}
        />
      </Coquille>
    );
  }
  const nomComplet = `${dossier.prenom} ${dossier.nom}`.trim();

  return (
    <Coquille titre="Mes outils de communication">
      <p className="text-fg-soft mt-5 text-[16px] leading-relaxed">
        Des pièces prêtes à l&apos;emploi, conformes à la charte de marque : téléchargez-les ou
        copiez-les, sans rien retoucher. La mention « apporteur d&apos;affaires indépendant » y
        figure déjà.
      </p>
      <OutilsCommunication nomComplet={nomComplet} />
      <a
        href={`/apporteur/dossier/${dossier.id}/${jeton}`}
        className="text-terracotta-deep mt-8 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4"
      >
        ← Retour à mon espace
      </a>
    </Coquille>
  );
}
