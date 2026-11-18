/**
 * Qualiopi — Certificat de réalisation.
 *
 * Mention légale EXACTE : LEGAL_MENTIONS.certificatRealisation
 * Bases juridiques : R.6332-26 (contrôle de service fait) + arrêté du
 * 21/12/2018 relatif aux pièces nécessaires à ce contrôle. Formule et engagement
 * de conservation repris du modèle publié par le ministère du Travail.
 *
 * ⚠️ DURÉE EN CENTIÈMES OBLIGATOIRE : utiliser formatHeuresCentiemes(dureeHeures).
 *    Ex : 7 → "7,00", 1.5 → "1,50". JAMAIS le format "7h00".
 *    Obligatoire pour OPCO Atlas.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document } from "@react-pdf/renderer";
import { PageCharte, Carte, LigneChamp } from "../charte/v1";
import {
  BlocDuree,
  BlocVerification,
  CartePhrase,
  CarteSignatureCachet,
} from "./charte-documents-formation";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS, formatHeuresCentiemes } from "@/server/qualiopi/legal/legal-mentions";
import { heuresMinutesFr } from "@/server/qualiopi/evaluations/heures-suivies";
import {
  identificationSignataire,
  signataireOrganisme,
} from "@/server/qualiopi/documents/representant-legal";

/**
 * Engagement de conservation — VERBATIM du modèle de certificat de réalisation
 * publié par le ministère du Travail. Le modèle le fait porter par le signataire
 * (« je m'engage ») ; il n'est pas une clause maison.
 */
export const ENGAGEMENT_CONSERVATION_CERTIFICAT =
  "Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver l'ensemble des pièces justificatives qui ont permis d'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement. En cas de cofinancement des fonds européens la durée de conservation est étendue conformément aux obligations conventionnelles spécifiques.";

// ============================================================
// Types de données
// ============================================================

export interface StagiaireData {
  nom: string;
  prenom: string;
  fonction?: string;
}

export interface EntrepriseClientData {
  raisonSociale: string;
  siret?: string;
  adresse?: string;
}

export interface CertificatRealisationData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  /** Nom du dirigeant/représentant légal signataire. Fallback sur raisonSociale si absent. */
  dirigeant?: string;
  entreprise: EntrepriseClientData;
  stagiaire: StagiaireData;
  intituleAction: string;
  dateDebut: string;
  dateFin: string;
  /** Durée réalisée en heures décimales. Sera affichée en centièmes (ex. 7 → "7,00"). */
  dureeHeures: number;
  /**
   * Nature de l'action, parmi les catégories de l'article L6313-1 du code du
   * travail.
   *
   * 🔴 Audit certification 2026-07-26 (F30). Le modèle de certificat annexé à
   * l'arrêté du 21 décembre 2018 impose de qualifier l'action : le document
   * n'en portait aucune trace. Un OPCO qui reçoit un certificat sans nature
   * d'action ne sait pas au titre de quel dispositif il rembourse.
   *
   * Axion-IA ne dispense que des actions de formation — d'où le défaut. Le champ
   * existe pour que le jour où un bilan de compétences ou une VAE serait
   * proposé, la pièce ne mente pas par omission.
   */
  natureAction?: "action_formation" | "bilan_competences" | "vae" | "apprentissage";
  /**
   * Modalité d'exécution. Le modèle réglementaire distingue le présentiel du
   * distanciel — un contrôle de service fait porte précisément sur ce point.
   */
  modalite?: "presentiel" | "distanciel" | "hybride";
  qrToken?: string;
  qrDataUrl?: string;
  estCopie?: boolean;
}

/**
 * Libellés réglementaires — article L6313-1 du code du travail.
 *
 * Exporté : les attestations de fin de formation (complète et partielle)
 * impriment la nature de l'action avec CE libellé et ce même défaut, pour que
 * les pièces d'un même dossier ne qualifient pas l'action différemment.
 */
export const NATURE_ACTION_LABELS: Record<
  NonNullable<CertificatRealisationData["natureAction"]>,
  string
> = {
  action_formation: "Action de formation",
  bilan_competences: "Bilan de compétences",
  vae: "Action permettant de faire valider les acquis de l'expérience",
  apprentissage: "Action de formation par apprentissage",
};

const MODALITE_LABELS: Record<NonNullable<CertificatRealisationData["modalite"]>, string> = {
  presentiel: "Présentiel",
  distanciel: "À distance",
  hybride: "Mixte (présentiel et à distance)",
};

// ============================================================
// Composant principal
// ============================================================

export function CertificatRealisationPdf({
  data,
}: {
  data: CertificatRealisationData;
}): React.ReactElement {
  const { identite } = data;
  const signataire = signataireOrganisme(identite, data.dirigeant);
  const prenomNom = `${data.stagiaire.prenom} ${data.stagiaire.nom}`.trim();
  // 🔴 Audit des pièces réelles 2026-09-30 — la formule du MODÈLE du ministère :
  // une personne physique, représentant légal du dispensateur, atteste. La pièce
  // n'imprimait jusqu'ici que des champs, et « Le représentant légal : AXION IA
  // SAS » en signature. « salarié(e) de l'entreprise » n'est écrit que si
  // l'entreprise n'est pas l'organisme lui-même (repli du producteur).
  const dispensateur = `représentant légal du dispensateur de l'action concourant au développement des compétences ${signataire.organisme}`;
  const sujet =
    signataire.nom !== null
      ? `Je soussigné(e) ${signataire.nom}, ${dispensateur},`
      : `Le ${dispensateur}`;
  const entrepriseSalarie =
    data.entreprise.raisonSociale.trim() !== "" &&
    data.entreprise.raisonSociale.trim() !== signataire.organisme
      ? `, salarié(e) de l'entreprise ${data.entreprise.raisonSociale.trim()},`
      : "";
  const phraseModele = `${sujet} atteste que ${prenomNom}${entrepriseSalarie} a suivi l'action « ${data.intituleAction} », dont la nature, les dates et la durée réalisée figurent ci-dessous.`;

  // ⚠️ Format réglementaire en centièmes — JAMAIS "7h00"
  const dureeFormatee = formatHeuresCentiemes(data.dureeHeures);

  const verifyUrl =
    data.qrToken && identite.site
      ? `${identite.site}/fr/verifier-attestation/${data.qrToken}`
      : null;

  return (
    <Document>
      <PageCharte
        docTitle="Certificat de réalisation"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Mention légale */}
        <CartePhrase grande phrase={phraseModele} note={LEGAL_MENTIONS.certificatRealisation} />

        {/* Organisme de formation — identifiants jamais masqués (pièce d'audit) */}
        <Carte titre="Organisme de formation">
          <LigneChamp label="Raison sociale" value={identite.raisonSociale} required />
          {typeof identite.nda === "string" && identite.nda.trim() !== "" ? (
            <LigneChamp label="N° déclaration activité (NDA)" value={identite.nda.trim()} />
          ) : null}
          {/*
            🔴 F29 — la ligne n'apparaît QUE si le numéro existe.
            Marquée `required`, elle imprimait « Non renseigné » dans le style
            des champs manquants sur chaque convention, contrat et certificat —
            c'est-à-dire précisément les pièces qui partent chez le client, chez
            l'OPCO et chez le certificateur. Attirer l'œil en rouge sur une
            absence est pire que l'omettre : un organisme non encore certifié
            n'a simplement pas de numéro Qualiopi à porter, et la ligne n'a
            aucune raison d'exister. Même traitement que la facture et le devis.
          */}
          {identite.qualiopi ? (
            <LigneChamp label="Certification Qualiopi" value={identite.qualiopi} />
          ) : null}
          <LigneChamp label="SIRET" value={identite.siret} required />
          <LigneChamp label="Adresse" value={identite.adresseSiege} required />
        </Carte>

        {/* Entreprise cliente */}
        <Carte titre="Entreprise / Client">
          <LigneChamp label="Raison sociale" value={data.entreprise.raisonSociale} />
          {data.entreprise.siret ? (
            <LigneChamp label="SIRET" value={data.entreprise.siret} />
          ) : null}
          {data.entreprise.adresse ? (
            <LigneChamp label="Adresse" value={data.entreprise.adresse} />
          ) : null}
        </Carte>

        {/* Stagiaire */}
        <Carte titre="Stagiaire">
          <LigneChamp label="Nom / Prénom" value={prenomNom} />
          {data.stagiaire.fonction ? (
            <LigneChamp label="Fonction" value={data.stagiaire.fonction} />
          ) : null}
        </Carte>

        {/* Action de formation */}
        <Carte titre="Action de formation réalisée">
          {/*
            F30 — la nature de l'action et sa modalité figurent au modèle annexé
            à l'arrêté du 21 décembre 2018. Le défaut « action de formation »
            couvre le seul cas qu'Axion-IA pratique ; il est explicite ici plutôt
            que sous-entendu, parce qu'un certificat muet sur ce point oblige le
            financeur à le supposer.
          */}
          <LigneChamp
            label="Nature de l'action"
            value={NATURE_ACTION_LABELS[data.natureAction ?? "action_formation"]}
          />
          <LigneChamp label="Intitulé de l'action" value={data.intituleAction} />
          {data.modalite ? (
            <LigneChamp label="Modalité d'exécution" value={MODALITE_LABELS[data.modalite]} />
          ) : null}
          <LigneChamp label="Date de début" value={data.dateDebut} />
          <LigneChamp label="Date de fin" value={data.dateFin} />
        </Carte>

        {/* Durée en centièmes — bloc mis en avant */}
        {/* 🔴 3e relecture A09 : centièmes (R.6313-3) ET heures-minutes, le format
            de l'attestation du même stagiaire — une seule durée, deux écritures. */}
        <BlocDuree
          libelle="Durée réalisée (format réglementaire en centièmes)"
          valeur={`${dureeFormatee} heures (${heuresMinutesFr(data.dureeHeures)})`}
          note="Conformément à l'arrêté du 21 décembre 2018 — format centièmes obligatoire (OPCO Atlas)."
        />

        {/* QR de vérification */}
        {verifyUrl && data.qrToken ? (
          <BlocVerification
            qrDataUrl={data.qrDataUrl}
            qrToken={data.qrToken}
            url={verifyUrl}
            explication="Scannez le QR code ou saisissez l'URL ci-dessus pour vérifier l'authenticité de ce certificat."
          />
        ) : null}

        {/* Engagement de conservation — verbatim du modèle du ministère. */}
        <CartePhrase phrase={ENGAGEMENT_CONSERVATION_CERTIFICAT} />

        {/* Signature */}
        <CarteSignatureCachet
          lignes={[
            `Fait à ${identite.rcsVille || identite.adresseSiege || "—"}, le ${data.dateEmission}`,
            `Cachet et signature du responsable du dispensateur de formation : ${identificationSignataire(signataire)}`,
          ]}
        />
      </PageCharte>
    </Document>
  );
}
