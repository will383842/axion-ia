// Le DOSSIER EN LIGNE d'un apporteur du réseau (démarrage manuel, 2026-10-05).
//
// `/apporteur/dossier/<apporteurId>/<jeton>` : le lien personnel envoyé par e-mail
// (`urlDossier`). Page racine hors `[locale]`, comme le questionnaire en ligne.
//
//   · lien faux, révoqué, dossier inconnu, refusé ou résilié → la MÊME page neutre,
//     statut 404 (`not-found.tsx`) : rien ne dit lequel ;
//   · dossier en cours ou à compléter → le parcours en 4 étapes (`DossierEnLigne`) ;
//   · à vérifier → « Dossier reçu », plus rien ne se modifie ;
//   · signé → « Votre contrat est signé », la déclaration d'entreprise (art. 3.2 du
//     contrat) avec la liste de SES déclarations, et le dépôt des pièces de vigilance
//     (attestation URSSAF, extrait d'immatriculation), demandées à 5 000 € puis tous
//     les 6 mois.
//
// Rendu à la demande (`force-dynamic`), jamais au build : `lireDossierParLien` refuse
// lui-même la base factice (contrat `stub.invalid`, `AGENTS.md`).

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { texteDuContrat } from "@/features/apporteurs-reseau/contrat-pdf";
import { lireDossierParLien, vigilanceDemandeeA } from "@/features/apporteurs-reseau/donnees";
import {
  AIDE_PIECE,
  LIBELLE_PIECE,
  PIECES_VIGILANCE,
  PROTECTION_MOIS,
} from "@/features/apporteurs-reseau/regles";
import {
  etatDeLaPage,
  libelleMotif,
  manquesDuDossier,
  valeursDuContrat,
} from "@/features/apporteurs-reseau/signature";

import { lireDeclarationsDe } from "@/features/apporteurs-reseau/declaration-entreprise";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";

import { ContratLisible } from "./ContratLisible";
import { Coquille, EcranEtat } from "./Coquille";
import { DeclarationEntreprise } from "./DeclarationEntreprise";
import { DepotPiece } from "./DepotPiece";
import { DossierEnLigne, type DossierPublic } from "./DossierEnLigne";
import { ListeDeclarations } from "./ListeDeclarations";
import { TEXTES } from "./textes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre dossier d'apporteur — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
}

export default async function DossierApporteurPage({ params }: PageProps) {
  const { id, jeton } = await params;
  // Le lien d'EXEMPLE de l'aperçu de la console : un écran qui le dit, jamais un 404.
  if (id.toLowerCase() === ID_DOSSIER_EXEMPLE) {
    return (
      <Coquille>
        <EcranEtat
          pastilleTexte={TEXTES.exemplePastille}
          titre={TEXTES.exempleTitre}
          ligne={TEXTES.exempleLigne}
        />
      </Coquille>
    );
  }
  const dossier = await lireDossierParLien(id, jeton);
  if (!dossier) notFound();
  // MODE RESTREINT (2026-10-07) : retiré du réseau, avec de l'argent encore en jeu. Seul le
  // dépôt des attestations de vigilance reste ouvert — ni signature, ni déclaration, ni
  // dossier (les actions le refusent aussi).
  if (dossier.restreint) {
    return (
      <Coquille titre={TEXTES.bonjour(dossier.prenom)}>
        <EcranEtat
          pastilleTexte={TEXTES.restreintPastille}
          titre={TEXTES.restreintTitre}
          ligne={TEXTES.restreintLigne}
        />
        <ul className="mt-5 grid gap-3">
          {PIECES_VIGILANCE.map((t) => {
            const p = dossier.pieces.find((x) => x.type === t) ?? null;
            return (
              <DepotPiece
                key={t}
                id={dossier.id}
                jeton={jeton}
                type={t}
                libelle={LIBELLE_PIECE[t]}
                aide={AIDE_PIECE[t]}
                piece={p ? { statut: p.statut, motif: p.motif, nomFichier: p.nomFichier } : null}
                motifLibelle={p?.statut === "a_retransmettre" ? libelleMotif(p.motif) : null}
                avecDate={t === "vigilance"}
              />
            );
          })}
        </ul>
      </Coquille>
    );
  }
  const etat = etatDeLaPage(dossier.statut);
  if (etat === "neutre") notFound();
  const titre = TEXTES.bonjour(dossier.prenom);

  if (etat === "a_verifier") {
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

  if (etat === "signe") {
    const declarations = await lireDeclarationsDe(dossier.id);
    // Les attestations ne sont « demandées » qu'à l'approche du seuil : avant, pas de dépôt proposé.
    const vigilance = await vigilanceDemandeeA(dossier.id);
    return (
      <Coquille titre={titre}>
        <EcranEtat
          pastilleTexte={TEXTES.signePastille}
          titre={TEXTES.signeTitre}
          ligne={vigilance ? TEXTES.signeLigneVigilance : TEXTES.signeLigne}
          succes
        >
          {dossier.aContratSigne ? (
            <a
              href={`/apporteur/dossier/${dossier.id}/${jeton}/contrat?dl=1`}
              target="_blank"
              rel="noopener"
              className="text-terracotta-deep mt-4 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4"
            >
              ↓ {TEXTES.telechargerSigne}
            </a>
          ) : null}
        </EcranEtat>
        <DeclarationEntreprise id={dossier.id} jeton={jeton} protectionMois={PROTECTION_MOIS} />
        <ListeDeclarations declarations={declarations} />
        {/* La grille de référence des commissions, réservée aux apporteurs (2026-10-09). */}
        <a
          href={`/apporteur/dossier/${dossier.id}/${jeton}/commissions`}
          className="text-terracotta-deep mt-5 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4"
        >
          Voir la grille de référence des commissions →
        </a>
        {/* Les pièces prêtes à l'emploi pour parler d'Axion-IA (art. 22 bis, 2026-10-09). */}
        <a
          href={`/apporteur/dossier/${dossier.id}/${jeton}/outils`}
          className="text-terracotta-deep mt-1 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4"
        >
          Mes outils de communication : bannière, visuels, textes, logo →
        </a>
        {vigilance ? (
          <ul className="mt-5 grid gap-3">
            {PIECES_VIGILANCE.map((t) => {
              const p = dossier.pieces.find((x) => x.type === t) ?? null;
              return (
                <DepotPiece
                  key={t}
                  id={dossier.id}
                  jeton={jeton}
                  type={t}
                  libelle={LIBELLE_PIECE[t]}
                  aide={AIDE_PIECE[t]}
                  piece={p ? { statut: p.statut, motif: p.motif, nomFichier: p.nomFichier } : null}
                  motifLibelle={p?.statut === "a_retransmettre" ? libelleMotif(p.motif) : null}
                  avecDate={t === "vigilance"}
                />
              );
            })}
          </ul>
        ) : null}
      </Coquille>
    );
  }

  // Dossier modifiable (en cours, ou à compléter).
  const publicDossier: DossierPublic = {
    id: dossier.id,
    jeton,
    statut: dossier.statut === "a_completer" ? "a_completer" : "dossier_en_cours",
    prenom: dossier.prenom,
    nom: dossier.nom,
    email: dossier.email,
    telephone: dossier.telephone,
    siren: dossier.siren,
    siret: dossier.siret ?? null,
    denomination: dossier.denomination,
    adresse: dossier.adresse,
    statutJuridique: dossier.statutJuridique,
    siegeAdresse: dossier.siegeAdresse ?? null,
    fonctionSignataire: dossier.fonctionSignataire ?? null,
    immatriculeRcs: dossier.immatriculeRcs ?? null,
    regimeTva: dossier.regimeTva,
    numeroTva: dossier.numeroTva,
    ibanMasque: dossier.ibanMasque,
    ibanSaisi: dossier.ibanSaisi,
    dernierMessage: dossier.statut === "a_completer" ? dossier.dernierMessage : null,
    pieces: dossier.pieces.map((p) => ({
      type: p.type,
      statut: p.statut,
      motif: p.motif,
      nomFichier: p.nomFichier,
    })),
  };

  // Première étape à montrer : la première qui reste à faire.
  const activiteFaite =
    !!dossier.siren &&
    !!dossier.statutJuridique &&
    !!dossier.regimeTva &&
    (dossier.regimeTva !== "assujetti" || !!dossier.numeroTva) &&
    dossier.ibanSaisi;
  const etapeInitiale =
    !dossier.siren || dossier.nom.trim() === ""
      ? 1
      : !activiteFaite
        ? 2
        : manquesDuDossier(dossier).length > 0
          ? 3
          : 4;

  const texte = texteDuContrat(valeursDuContrat(dossier, new Date()));

  return (
    <Coquille titre={titre}>
      <DossierEnLigne
        dossier={publicDossier}
        etapeInitiale={etapeInitiale}
        contrat={<ContratLisible texte={texte} />}
        urlPdf={`/apporteur/dossier/${dossier.id}/${jeton}/contrat`}
      />
    </Coquille>
  );
}
