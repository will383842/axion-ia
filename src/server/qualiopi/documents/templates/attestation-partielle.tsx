/**
 * Qualiopi — Attestation partielle de formation (assiduité sous le seuil de
 * présence complète, y compris sous 60 % : la pièce est remise, L.6313-7 dern. al.).
 *
 * Identique à l'attestation complète MAIS :
 *  - Titre : "Attestation partielle de formation"
 *  - Durée réelle suivie affichée explicitement
 *  - La partialité porte sur la PRÉSENCE ; les résultats de l'évaluation sont
 *    imprimés tels quels, jamais présentés comme « partiellement validés »
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
  EncadreAvertissement,
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

export interface BeneficiaireDataP {
  nom: string;
  prenom: string;
  entreprise?: string;
  fonction?: string;
}

export interface FormationDataP {
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

export interface ResultatsPartielsData {
  heuresSuivies: number;
  heuresTotales: number;
  evaluationObtenue?: string;
  competencesPartiellesValidees: string;
  /** Réserves : partiellement acquis, non acquis, non évalués (F21). */
  competencesReserves?: string;
}

export interface AttestationPartielleData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  /**
   * Nom du représentant légal signataire. Prime sur `identite.representantLegalNom`.
   * Absent des deux → « Le représentant légal de <raison sociale> » (`representant-legal.ts`).
   */
  dirigeant?: string;
  beneficiaire: BeneficiaireDataP;
  formation: FormationDataP;
  resultats: ResultatsPartielsData;
  qrToken?: string;
  qrDataUrl?: string;
  estCopie?: boolean;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Heures en heures ET minutes (« 6 h 30 »), assiduité calculée sur les minutes.
 * 🔴 2e relecture A09 : l'arrondi à l'heure et l'assiduité recalculée depuis cet
 * arrondi contredisaient « les heures effectivement suivies » du règlement publié.
 */
const hMin = heuresMinutesFr;
const assiduitePercent = assiduiteSurMinutes;

// ============================================================
// Composant principal
// ============================================================

export function AttestationPartiellePdf({
  data,
}: {
  data: AttestationPartielleData;
}): React.ReactElement {
  const { identite } = data;
  const signataire = signataireOrganisme(identite, data.dirigeant);
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();
  const aucuneHeure = Math.round(data.resultats.heuresSuivies * 60) === 0;

  const verifyUrl =
    data.qrToken && identite.site
      ? `${identite.site}/fr/verifier-attestation/${data.qrToken}`
      : null;

  return (
    <Document>
      <PageCharte
        docTitle={
          aucuneHeure
            ? "Attestation de fin de formation — aucune heure suivie"
            : "Attestation partielle de formation"
        }
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Bannière partielle — signalée fortement.
            🔴 Audit initial 2026-09-14 (M-documents-pdf-11 / X-documents-pdf-07).
            Elle annonçait « assiduité comprise entre 60 % et 79 % » : fausse dès
            que le seuil de présence complète était réglé autrement que 80 %, et
            fausse tout court depuis que la pièce est émise sous 60 % (elle est remise
            au stagiaire, L.6313-7 dern. al.). Elle ajoutait « compétences déclarées
            partiellement validées » : la partialité ne dit que la PRÉSENCE, les
            résultats de l'évaluation sont imprimés plus bas, tels quels. */}
        {/* 🔴 2e relecture A09 : à 0 minute suivie, la pièce ne dit JAMAIS « a
            (partiellement) suivi ». Elle atteste l'inscription et l'absence de
            suivi, avec les autres mentions obligatoires. */}
        <EncadreAvertissement titre={aucuneHeure ? "Aucune heure suivie" : "Attestation partielle"}>
          {aucuneHeure
            ? `Aucune heure de formation suivie sur ${hMin(data.resultats.heuresTotales)} prévues (assiduité ${assiduitePercent(data.resultats.heuresSuivies, data.resultats.heuresTotales)}). Les résultats de l'évaluation des acquis figurent ci-après.`
            : `Formation suivie en partie : ${hMin(data.resultats.heuresSuivies)} sur ${hMin(data.resultats.heuresTotales)} prévues (assiduité ${assiduitePercent(data.resultats.heuresSuivies, data.resultats.heuresTotales)}). Les résultats de l'évaluation des acquis figurent ci-après.`}
        </EncadreAvertissement>

        {/* Phrase certificative */}
        <CartePhrase
          grande
          phrase={
            aucuneHeure
              ? `${sujetAttestation(signataire)} atteste que ${prenomNom}, inscrit(e) à la formation mentionnée ci-dessous, n'a suivi aucune heure de la formation.`
              : `${sujetAttestation(signataire)} atteste que ${prenomNom} a partiellement suivi la formation mentionnée ci-dessous.`
          }
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
        <Carte titre="Formation concernée">
          <LigneChamp label="Intitulé" value={data.formation.intitule} />
          {/* 🔴 Audit initial 2026-09-14 (X-documents-pdf-05) : l'attestation porte
              la nature de l'action, et le règlement publié l'annonce. */}
          <LigneChamp
            label="Nature de l'action"
            value={NATURE_ACTION_LABELS[data.formation.natureAction ?? "action_formation"]}
          />
          <LigneChamp label="Objectifs" value={data.formation.objectifs} />
          <LigneChamp label="Durée totale prévue" value={`${hMin(data.formation.dureeHeures)}`} />
          <LigneChamp label="Du" value={data.formation.dateDebut} />
          <LigneChamp label="Au" value={data.formation.dateFin} />
          <LigneChamp label="Modalité" value={libelleModalite(data.formation.modalite)} />
          <LigneChamp label="Formateur(rice)" value={data.formation.formateur} />
        </Carte>

        {/* Résultats partiels */}
        {/* 🔴 3e relecture A09 : à 0 h, rien n'est « partiel ». */}
        <Carte titre={aucuneHeure ? "Résultats" : "Résultats partiels"}>
          <LigneResultat
            libelle="Durée réelle suivie"
            valeur={`${hMin(data.resultats.heuresSuivies)}`}
          />
          <LigneResultat
            libelle="Assiduité"
            valeur={`${hMin(data.resultats.heuresSuivies)} / ${hMin(data.resultats.heuresTotales)} = ${assiduitePercent(data.resultats.heuresSuivies, data.resultats.heuresTotales)}`}
          />
          {data.resultats.evaluationObtenue ? (
            <LigneResultat libelle="Évaluation" valeur={data.resultats.evaluationObtenue} />
          ) : null}
          <LigneResultat
            libelle="Compétences acquises"
            valeur={data.resultats.competencesPartiellesValidees}
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
