/**
 * Qualiopi — Attestation de fin de formation (complète, ≥ 80 % assiduité).
 *
 * Mention légale EXACTE : LEGAL_MENTIONS.attestation
 * Bases juridiques : L.6353-1 / D.6353-1 du Code du travail.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";
import { NATURE_ACTION_LABELS } from "./certificat-realisation";
import { assiduiteSurMinutes, heuresMinutesFr } from "@/server/qualiopi/evaluations/heures-suivies";

// ============================================================
// Styles spécifiques
// ============================================================

const styles = StyleSheet.create({
  certifPhrase: {
    fontSize: 11,
    lineHeight: 1.6,
    marginBottom: 14,
  },
  resultRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("sand"),
  },
  resultLabel: {
    fontSize: 9,
    color: brandColor("fg-soft"),
    width: 180,
    fontWeight: "bold",
  },
  resultValue: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
  },
  qrBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    gap: 12,
  },
  qrTextBlock: {
    flex: 1,
  },
  qrToken: {
    fontSize: 8,
    fontFamily: "Inconsolata",
    marginBottom: 2,
  },
  qrUrl: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
  },
});

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
   * Nature de l'action (L.6353-1 al. 2). Même clé, même libellé et même défaut
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
  /** Nom du dirigeant/représentant légal signataire. Fallback sur raisonSociale si absent. */
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
  const dirigeantOuRS = data.dirigeant ?? identite.raisonSociale;
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();

  const verifyUrl =
    data.qrToken && identite.site
      ? `${identite.site}/fr/verifier-attestation/${data.qrToken}`
      : null;

  return (
    <Document>
      <QualiopiPage
        docTitle="Attestation de fin de formation"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Phrase certificative
            🔴 Audit initial 2026-09-14 (X-documents-pdf-07). Elle affirmait « et en
            a satisfait les exigences » quel que soit le résultat : le choix entre
            cette pièce et la partielle ne dépend que de la PRÉSENCE. Une stagiaire
            assidue mais « Non validée » recevait une attestation qui se contredisait
            deux blocs plus bas. La phrase certifie ce que la pièce prouve — le suivi —
            et renvoie aux résultats, qu'elle imprime tels quels (L.6353-1 al. 2). */}
        <View style={pdfStyles.section}>
          <Text style={styles.certifPhrase}>
            {`Je soussigné ${dirigeantOuRS} certifie que ${prenomNom} a suivi la formation mentionnée ci-dessous. Les résultats de l'évaluation des acquis figurent ci-après.`}
          </Text>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.attestation}</Text>
        </View>

        {/* Bénéficiaire */}
        <DocSection title="Bénéficiaire">
          <FieldRow label="Nom / Prénom" value={prenomNom} />
          {data.beneficiaire.entreprise ? (
            <FieldRow label="Entreprise" value={data.beneficiaire.entreprise} />
          ) : null}
          {data.beneficiaire.fonction ? (
            <FieldRow label="Fonction" value={data.beneficiaire.fonction} />
          ) : null}
        </DocSection>

        {/* Formation */}
        <DocSection title="Formation suivie">
          <FieldRow label="Intitulé" value={data.formation.intitule} />
          {/* 🔴 Audit initial 2026-09-14 (X-documents-pdf-05) : L.6353-1 al. 2 fait
              porter la nature de l'action, et le règlement publié l'annonce. */}
          <FieldRow
            label="Nature de l'action"
            value={NATURE_ACTION_LABELS[data.formation.natureAction ?? "action_formation"]}
          />
          <FieldRow label="Objectifs" value={data.formation.objectifs} />
          <FieldRow label="Durée totale" value={`${hMin(data.formation.dureeHeures)}`} />
          <FieldRow label="Du" value={data.formation.dateDebut} />
          <FieldRow label="Au" value={data.formation.dateFin} />
          <FieldRow label="Modalité" value={data.formation.modalite} />
          <FieldRow label="Formateur(rice)" value={data.formation.formateur} />
        </DocSection>

        {/* Résultats */}
        <DocSection title="Résultats">
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Assiduité</Text>
            <Text style={styles.resultValue}>
              {`${hMin(data.resultats.heuresSuivies)} / ${hMin(data.resultats.heuresTotales)} = ${assiduitePercent(data.resultats)}`}
            </Text>
          </View>
          {data.resultats.evaluationObtenue ? (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Évaluation</Text>
              <Text style={styles.resultValue}>{data.resultats.evaluationObtenue}</Text>
            </View>
          ) : null}
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Compétences acquises</Text>
            <Text style={styles.resultValue}>{data.resultats.competencesAcquises}</Text>
          </View>
          {data.resultats.competencesReserves ? (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Réserves</Text>
              <Text style={styles.resultValue}>{data.resultats.competencesReserves}</Text>
            </View>
          ) : null}
        </DocSection>

        {/* QR de vérification */}
        {verifyUrl ? (
          <DocSection title="Vérification d'authenticité">
            <View style={styles.qrBlock}>
              {data.qrDataUrl ? (
                <Image src={data.qrDataUrl} style={{ width: 90, height: 90 }} />
              ) : null}
              <View style={styles.qrTextBlock}>
                <Text style={styles.qrToken}>{`Token : ${data.qrToken}`}</Text>
                <Text style={styles.qrUrl}>{verifyUrl}</Text>
                <Text style={pdfStyles.legalNote}>
                  Scannez le QR code ou saisissez l'URL ci-dessus pour vérifier l'authenticité de
                  cette attestation.
                </Text>
              </View>
            </View>
          </DocSection>
        ) : null}

        {/* Signature */}
        <DocSection title="Signature et cachet">
          <View style={pdfStyles.signatureZone}>
            <View style={pdfStyles.signatureBox}>
              <Text style={pdfStyles.paragraph}>
                {/* Ville du siège, pas l'adresse complète : « Fait à ELITE
                    BUREAUX - boîte 53, 11 Avenue… » n'est pas un lieu d'acte. */}
                {`Fait à ${identite.rcsVille || identite.adresseSiege || "—"}, le ${data.dateEmission}`}
              </Text>
              <Text style={pdfStyles.paragraph}>{`Le représentant légal : ${dirigeantOuRS}`}</Text>
            </View>
            <View style={pdfStyles.signatureBox}>
              <Text style={pdfStyles.paragraph}>Cachet de l'organisme</Text>
            </View>
          </View>
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
