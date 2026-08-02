/**
 * Qualiopi — Attestation partielle de formation (assiduité 60–79 %).
 *
 * Identique à l'attestation complète MAIS :
 *  - Titre : "Attestation partielle de formation"
 *  - Durée réelle suivie affichée explicitement
 *  - Compétences désignées comme "partiellement validées"
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
  LegalCallout,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

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
  /** Nom du dirigeant/représentant légal signataire. Fallback sur raisonSociale si absent. */
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

/** Heures au format français (virgule décimale ; entiers inchangés). R.6313-3. */
function hFr(heures: number): string {
  return heures.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function assiduitePercent(heuresSuivies: number, heuresTotales: number): string {
  if (heuresTotales === 0) return "—";
  const pct = Math.round((heuresSuivies / heuresTotales) * 100);
  return `${pct} %`;
}

// ============================================================
// Composant principal
// ============================================================

export function AttestationPartiellePdf({
  data,
}: {
  data: AttestationPartielleData;
}): React.ReactElement {
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
        docTitle="Attestation partielle de formation"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Bannière partielle — signalée fortement */}
        <LegalCallout variant="warning" title="Attestation partielle">
          Formation non complétée (assiduité comprise entre 60 % et 79 %). Les compétences sont
          déclarées partiellement validées.
        </LegalCallout>

        {/* Phrase certificative */}
        <View style={pdfStyles.section}>
          <Text style={styles.certifPhrase}>
            {`Je soussigné ${dirigeantOuRS} certifie que ${prenomNom} a partiellement suivi la formation mentionnée ci-dessous.`}
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
        <DocSection title="Formation concernée">
          <FieldRow label="Intitulé" value={data.formation.intitule} />
          <FieldRow label="Objectifs" value={data.formation.objectifs} />
          <FieldRow label="Durée totale prévue" value={`${hFr(data.formation.dureeHeures)} h`} />
          <FieldRow label="Du" value={data.formation.dateDebut} />
          <FieldRow label="Au" value={data.formation.dateFin} />
          <FieldRow label="Modalité" value={data.formation.modalite} />
          <FieldRow label="Formateur(rice)" value={data.formation.formateur} />
        </DocSection>

        {/* Résultats partiels */}
        <DocSection title="Résultats partiels">
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Durée réelle suivie</Text>
            <Text style={styles.resultValue}>{`${hFr(data.resultats.heuresSuivies)} h`}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Assiduité</Text>
            <Text style={styles.resultValue}>
              {`${hFr(data.resultats.heuresSuivies)} h / ${hFr(data.resultats.heuresTotales)} h = ${assiduitePercent(data.resultats.heuresSuivies, data.resultats.heuresTotales)}`}
            </Text>
          </View>
          {data.resultats.evaluationObtenue ? (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Évaluation</Text>
              <Text style={styles.resultValue}>{data.resultats.evaluationObtenue}</Text>
            </View>
          ) : null}
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Compétences partiellement validées</Text>
            <Text style={styles.resultValue}>{data.resultats.competencesPartiellesValidees}</Text>
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
