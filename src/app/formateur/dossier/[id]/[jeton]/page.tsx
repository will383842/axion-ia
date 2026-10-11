// Le DOSSIER EN LIGNE d'un formateur indépendant (lot L5, ADR 0066 étape 5).
//
// `/formateur/dossier/<trainerId>/<jeton>` : le lien personnel envoyé par e-mail. Page
// racine hors `[locale]`, comme le dossier des apporteurs.
//
//   · interrupteur `dossier_en_ligne` éteint (ou absent), lien faux, échu ou révoqué,
//     fiche inconnue, fermée ou d'un autre statut → la MÊME page neutre, statut 404
//     (`not-found.tsx`) : rien ne dit lequel ;
//   · dossier en cours ou à compléter → le parcours en 4 étapes (`DossierFormateur`) ;
//   · à vérifier → « Dossier reçu », plus rien ne se modifie.
//
// Rendu à la demande (`force-dynamic`), jamais au build : `lireDossierParLien` refuse
// lui-même la base factice (contrat `stub.invalid`, `AGENTS.md`).

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { lireDossierParLien } from "@/server/qualiopi/formateurs-independants/dossier";
import {
  etapeInitiale,
  piecesDemandees,
} from "@/server/qualiopi/formateurs-independants/dossier-regles";

import { Coquille, EcranEtat } from "./Coquille";
import { DossierFormateur } from "./DossierFormateur";
import { TEXTES } from "./textes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre dossier de formateur — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
}

export default async function DossierFormateurPage({ params }: PageProps) {
  const { id, jeton } = await params;
  const dossier = await lireDossierParLien(id, jeton);
  if (!dossier) notFound();
  const titre = TEXTES.bonjour(dossier.prenom);

  if (dossier.etat === "a_verifier") {
    return (
      <Coquille titre={titre}>
        <EcranEtat
          pastilleTexte={TEXTES.recuPastille}
          titre={TEXTES.recuTitre}
          ligne={TEXTES.recuLigne}
        />
      </Coquille>
    );
  }

  const etat = {
    codePostalPro: dossier.codePostalPro,
    siret: dossier.siret,
    nda: dossier.nda,
    regimeTva: dossier.regimeTva,
    ibanSaisi: dossier.ibanSaisi,
    piecesDeposees: dossier.pieces.filter((p) => p.statut !== "a_retransmettre").map((p) => p.type),
    codeUrssafSaisi: dossier.codeUrssafSaisi,
    // Le registre n'est pas rappelé à l'affichage : l'étape 2 le rejuge à la recherche.
    entrepriseBloquante: false,
  };

  return (
    <Coquille titre={titre}>
      <DossierFormateur
        dossier={{
          id: dossier.id,
          jeton,
          prenom: dossier.prenom,
          nom: dossier.nom,
          email: dossier.email,
          telephone: dossier.telephone,
          codePostalPro: dossier.codePostalPro ?? dossier.suggestions.codePostal,
          siret: dossier.siret ?? dossier.suggestions.siret,
          siretEnregistre: dossier.siret !== null,
          nda: dossier.nda ?? dossier.suggestions.nda,
          regimeTva: dossier.regimeTva,
          ibanSaisi: dossier.ibanSaisi,
          ibanFige: dossier.ibanFige,
          codeUrssafSaisi: dossier.codeUrssafSaisi,
          pieces: dossier.pieces,
          piecesDemandees: piecesDemandees(dossier.nda),
        }}
        etapeInitiale={etapeInitiale(etat)}
      />
    </Coquille>
  );
}
