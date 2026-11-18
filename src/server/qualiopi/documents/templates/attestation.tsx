/**
 * Qualiopi — Attestation de fin de formation (complète, ≥ 80 % assiduité).
 *
 * Mention légale EXACTE : LEGAL_MENTIONS.attestation
 * Base : dernier alinéa de L.6313-7 du Code du travail (cf. `LEGAL_MENTIONS.attestation`).
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document } from "@react-pdf/renderer";
import { PageCharte, Carte, LigneChamp } from "../charte/v1";
import {
  BlocVerification,
  CartePhrase,
  CarteSignatureCachet,
  LigneResultat,
} from "./charte-documents-formation";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { NATURE_ACTION_LABELS } from "./certificat-realisation";
import { assiduiteSurMinutes, heuresMinutesFr } from "@/server/qualiopi/evaluations/heures-suivies";
import { libelleModalite } from "@/server/qualiopi/documents/libelles-enumerations";
import {
  identificationSignataire,
  signataireOrganisme,
  sujetAttestation,
} from "@/server/qualiopi/documents/representant-legal";

// ============================================================
// Types de données
// ============================================================

export interface BeneficiaireData {
  nom: string;
  prenom: string;
  entreprise?: string;
  fonction?: string;
}

export interface FormationData {
  intitule: string;
  objectifs: string;
  dureeHeures: number;
  dateDebut: string;
  dateFin: string;
  modalite: string;
  formateur: string;
  /**
   * Nature de l'action (mention de l'attestation). Même clé, même libellé et même défaut
   * (« Action de formation ») que le certificat de réalisation du dossier.
   */
  natureAction?: keyof typeof NATURE_ACTION_LABELS;
}

export interface ResultatsFormationData {
  heuresSuivies: number;
  heuresTotales: number;
  evaluationObtenue?: string;
  competencesAcquises: string;
  /**
   * Réserves : partiellement acquis, non acquis, non évalués (F21).
   *
   * Absent quand tout est acquis — une rubrique « Non acquis : — » attire l'œil
   * sur un vide sans rien signifier. L6353-1 impose de restituer les RÉSULTATS
   * de l'évaluation ; les taire rendrait l'attestation inexacte.
   */
  competencesReserves?: string;
}

export interface AttestationData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  /**
   * Nom du représentant légal signataire. Prime sur `identite.representantLegalNom`.
   * Absent des deux → « Le représentant légal de <raison sociale> », jamais la
   * raison sociale présentée comme une personne (`representant-legal.ts`).
   */
  dirigeant?: string;
  beneficiaire: BeneficiaireData;
  formation: FormationData;
  resultats: ResultatsFormationData;
  qrToken?: string;
  qrDataUrl?: string;
  estCopie?: boolean;
}

// ============================================================
// Helpers
// ============================================================

/** Assiduité calculée sur les MINUTES (2e relecture A09), pas sur des heures arrondies. */
function assiduitePercent(data: ResultatsFormationData): string {
  return assiduiteSurMinutes(data.heuresSuivies, data.heuresTotales);
}

/** Heures en heures ET minutes (« 6 h 30 ») — « les heures effectivement suivies ». */
const hMin = heuresMinutesFr;

// ============================================================
// Composant principal
// ============================================================

export function AttestationPdf({ data }: { data: AttestationData }): React.ReactElement {
  const { identite } = data;
  const signataire = signataireOrganisme(identite, data.dirigeant);
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();

  const verifyUrl =
    data.qrToken && identite.site
      ? `${identite.site}/fr/verifier-attestation/${data.qrToken}`
      : null;

  return (
    <Document>
      <PageCharte
        docTitle="Attestation de fin de formation"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Phrase certificative
            🔴 Audit initial 2026-09-14 (X-documents-pdf-07). Elle affirmait « et en
            a satisfait les exigences » quel que soit le résultat : le choix entre
            cette pièce et la partielle ne dépend que de la PRÉSENCE. Une stagiaire
            assidue mais « Non validée » recevait une attestation qui se contredisait
            deux blocs plus bas. La phrase certifie ce que la pièce prouve — le suivi —
            et renvoie aux résultats, qu'elle imprime tels quels. */}
        <CartePhrase
          grande
          phrase={`${sujetAttestation(signataire)} atteste que ${prenomNom} a suivi la formation mentionnée ci-dessous. Les résultats de l'évaluation des acquis figurent ci-après.`}
          note={LEGAL_MENTIONS.attestation}
        />

        {/* Bénéficiaire */}
        <Carte titre="Bénéficiaire">
          <LigneChamp label="Nom / Prénom" value={prenomNom} />
          {data.beneficiaire.entreprise ? (
            <LigneChamp label="Entreprise" value={data.beneficiaire.entreprise} />
          ) : null}
          {data.beneficiaire.fonction ? (
            <LigneChamp label="Fonction" value={data.beneficiaire.fonction} />
          ) : null}
        </Carte>

        {/* Formation */}
        <Carte titre="Formation suivie">
          <LigneChamp label="Intitulé" value={data.formation.intitule} />
          {/* 🔴 Audit initial 2026-09-14 (X-documents-pdf-05) : l'attestation porte
              la nature de l'action, et le règlement publié l'annonce. */}
          <LigneChamp
            label="Nature de l'action"
            value={NATURE_ACTION_LABELS[data.formation.natureAction ?? "action_formation"]}
          />
          <LigneChamp label="Objectifs" value={data.formation.objectifs} />
          <LigneChamp label="Durée totale" value={`${hMin(data.formation.dureeHeures)}`} />
          <LigneChamp label="Du" value={data.formation.dateDebut} />
          <LigneChamp label="Au" value={data.formation.dateFin} />
          <LigneChamp label="Modalité" value={libelleModalite(data.formation.modalite)} />
          <LigneChamp label="Formateur(rice)" value={data.formation.formateur} />
        </Carte>

        {/* Résultats */}
        <Carte titre="Résultats">
          <LigneResultat
            libelle="Assiduité"
            valeur={`${hMin(data.resultats.heuresSuivies)} / ${hMin(data.resultats.heuresTotales)} = ${assiduitePercent(data.resultats)}`}
          />
          {data.resultats.evaluationObtenue ? (
            <LigneResultat libelle="Évaluation" valeur={data.resultats.evaluationObtenue} />
          ) : null}
          <LigneResultat
            libelle="Compétences acquises"
            valeur={data.resultats.competencesAcquises}
          />
          {data.resultats.competencesReserves ? (
            <LigneResultat libelle="Réserves" valeur={data.resultats.competencesReserves} />
          ) : null}
        </Carte>

        {/* QR de vérification */}
        {verifyUrl && data.qrToken ? (
          <BlocVerification
            qrDataUrl={data.qrDataUrl}
            qrToken={data.qrToken}
            url={verifyUrl}
            explication="Scannez le QR code ou saisissez l'URL ci-dessus pour vérifier l'authenticité de cette attestation."
          />
        ) : null}

        {/* Signature */}
        <CarteSignatureCachet
          lignes={[
            `Fait à ${identite.rcsVille || identite.adresseSiege || "—"}, le ${data.dateEmission}`,
            `Le représentant légal : ${identificationSignataire(signataire)}`,
          ]}
        />
      </PageCharte>
    </Document>
  );
}
