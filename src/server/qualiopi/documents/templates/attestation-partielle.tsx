/**
 * Qualiopi — Attestation partielle de formation (assiduité sous le seuil de
 * présence complète, y compris sous 60 % : la pièce reste due, L.6353-1 al. 2).
 *
 * Identique à l'attestation complète MAIS :
 *  - Titre : "Attestation partielle de formation"
 *  - Durée réelle suivie affichée explicitement
 *  - La partialité porte sur la PRÉSENCE ; les résultats de l'évaluation sont
 *    imprimés tels quels, jamais présentés comme « partiellement validés »
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
   * Nature de l'action (L.6353-1 al. 2). Même clé, même libellé et même défaut
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
  const dirigeantOuRS = data.dirigeant ?? identite.raisonSociale;
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();
  const aucuneHeure = Math.round(data.resultats.heuresSuivies * 60) === 0;

  const verifyUrl =
    data.qrToken && identite.site
      ? `${identite.site}/fr/verifier-attestation/${data.qrToken}`
      : null;

  return (
    <Document>
      <QualiopiPage
        docTitle={
          aucuneHeure
            ? "Attestation de fin de formation — aucune heure suivie"
            : "Attestation partielle de formation"
        }
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Bannière partielle — signalée fortement.
            🔴 Audit initial 2026-09-14 (M-documents-pdf-11 / X-documents-pdf-07).
            Elle annonçait « assiduité comprise entre 60 % et 79 % » : fausse dès
            que le seuil de présence complète était réglé autrement que 80 %, et
            fausse tout court depuis que la pièce est émise sous 60 % (elle est due
            au stagiaire, L.6353-1 al. 2). Elle ajoutait « compétences déclarées
            partiellement validées » : la partialité ne dit que la PRÉSENCE, les
            résultats de l'évaluation sont imprimés plus bas, tels quels. */}
        {/* 🔴 2e relecture A09 : à 0 minute suivie, la pièce ne dit JAMAIS « a
            (partiellement) suivi ». Elle atteste l'inscription et l'absence de
            suivi, avec les autres mentions obligatoires. */}
        <LegalCallout
          variant="warning"
          title={aucuneHeure ? "Aucune heure suivie" : "Attestation partielle"}
        >
          {aucuneHeure
            ? `Aucune heure de formation suivie sur ${hMin(data.resultats.heuresTotales)} prévues (assiduité ${assiduitePercent(data.resultats.heuresSuivies, data.resultats.heuresTotales)}). Les résultats de l'évaluation des acquis figurent ci-après.`
            : `Formation suivie en partie : ${hMin(data.resultats.heuresSuivies)} sur ${hMin(data.resultats.heuresTotales)} prévues (assiduité ${assiduitePercent(data.resultats.heuresSuivies, data.resultats.heuresTotales)}). Les résultats de l'évaluation des acquis figurent ci-après.`}
        </LegalCallout>

        {/* Phrase certificative */}
        <View style={pdfStyles.section}>
          <Text style={styles.certifPhrase}>
            {aucuneHeure
              ? `Je soussigné ${dirigeantOuRS} atteste que ${prenomNom}, inscrit(e) à la formation mentionnée ci-dessous, n'a suivi aucune heure de la formation.`
              : `Je soussigné ${dirigeantOuRS} certifie que ${prenomNom} a partiellement suivi la formation mentionnée ci-dessous.`}
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
          {/* 🔴 Audit initial 2026-09-14 (X-documents-pdf-05) : L.6353-1 al. 2 fait
              porter la nature de l'action, et le règlement publié l'annonce. */}
          <FieldRow
            label="Nature de l'action"
            value={NATURE_ACTION_LABELS[data.formation.natureAction ?? "action_formation"]}
          />
          <FieldRow label="Objectifs" value={data.formation.objectifs} />
          <FieldRow label="Durée totale prévue" value={`${hMin(data.formation.dureeHeures)}`} />
          <FieldRow label="Du" value={data.formation.dateDebut} />
          <FieldRow label="Au" value={data.formation.dateFin} />
          <FieldRow label="Modalité" value={data.formation.modalite} />
          <FieldRow label="Formateur(rice)" value={data.formation.formateur} />
        </DocSection>

        {/* Résultats partiels */}
        {/* 🔴 3e relecture A09 : à 0 h, rien n'est « partiel ». */}
        <DocSection title={aucuneHeure ? "Résultats" : "Résultats partiels"}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Durée réelle suivie</Text>
            <Text style={styles.resultValue}>{`${hMin(data.resultats.heuresSuivies)}`}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Assiduité</Text>
            <Text style={styles.resultValue}>
              {`${hMin(data.resultats.heuresSuivies)} / ${hMin(data.resultats.heuresTotales)} = ${assiduitePercent(data.resultats.heuresSuivies, data.resultats.heuresTotales)}`}
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
