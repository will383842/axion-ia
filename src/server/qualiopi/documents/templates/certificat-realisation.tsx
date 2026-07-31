/**
 * Qualiopi — Certificat de réalisation.
 *
 * Mention légale EXACTE : LEGAL_MENTIONS.certificatRealisation
 * Bases juridiques : R.6313-3 + arrêté 21/12/2018.
 *
 * ⚠️ DURÉE EN CENTIÈMES OBLIGATOIRE : utiliser formatHeuresCentiemes(dureeHeures).
 *    Ex : 7 → "7,00", 1.5 → "1,50". JAMAIS le format "7h00".
 *    Obligatoire pour OPCO Atlas.
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
  NdaFieldRow,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS, formatHeuresCentiemes } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles spécifiques
// ============================================================

const styles = StyleSheet.create({
  dureeBlock: {
    backgroundColor: brandColor("sand"),
    padding: 10,
    marginBottom: 12,
    borderRadius: 2,
  },
  dureeLabel: {
    fontSize: 9,
    color: brandColor("fg-soft"),
    fontWeight: "bold",
    marginBottom: 2,
  },
  dureeValue: {
    fontSize: 14,
    fontFamily: "Inconsolata",
    fontWeight: "bold",
    color: brandColor("terracotta"),
  },
  dureeNote: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
    marginTop: 2,
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

/** Libellés réglementaires — article L6313-1 du code du travail. */
const NATURE_ACTION_LABELS: Record<
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
  const dirigeantOuRS = data.dirigeant ?? identite.raisonSociale;
  const prenomNom = `${data.stagiaire.prenom} ${data.stagiaire.nom}`.trim();

  // ⚠️ Format réglementaire en centièmes — JAMAIS "7h00"
  const dureeFormatee = formatHeuresCentiemes(data.dureeHeures);

  const verifyUrl =
    data.qrToken && identite.site
      ? `${identite.site}/fr/verifier-attestation/${data.qrToken}`
      : null;

  return (
    <Document>
      <QualiopiPage
        docTitle="Certificat de réalisation"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Mention légale */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.certificatRealisation}</Text>
        </View>

        {/* Organisme de formation — identifiants jamais masqués (pièce d'audit) */}
        <DocSection title="Organisme de formation">
          <FieldRow label="Raison sociale" value={identite.raisonSociale} required />
          <NdaFieldRow label="N° déclaration activité (NDA)" nda={identite.nda} />
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
            <FieldRow label="Certification Qualiopi" value={identite.qualiopi} />
          ) : null}
          <FieldRow label="SIRET" value={identite.siret} required />
          <FieldRow label="Adresse" value={identite.adresseSiege} required />
        </DocSection>

        {/* Entreprise cliente */}
        <DocSection title="Entreprise / Client">
          <FieldRow label="Raison sociale" value={data.entreprise.raisonSociale} />
          {data.entreprise.siret ? <FieldRow label="SIRET" value={data.entreprise.siret} /> : null}
          {data.entreprise.adresse ? (
            <FieldRow label="Adresse" value={data.entreprise.adresse} />
          ) : null}
        </DocSection>

        {/* Stagiaire */}
        <DocSection title="Stagiaire">
          <FieldRow label="Nom / Prénom" value={prenomNom} />
          {data.stagiaire.fonction ? (
            <FieldRow label="Fonction" value={data.stagiaire.fonction} />
          ) : null}
        </DocSection>

        {/* Action de formation */}
        <DocSection title="Action de formation réalisée">
          {/*
            F30 — la nature de l'action et sa modalité figurent au modèle annexé
            à l'arrêté du 21 décembre 2018. Le défaut « action de formation »
            couvre le seul cas qu'Axion-IA pratique ; il est explicite ici plutôt
            que sous-entendu, parce qu'un certificat muet sur ce point oblige le
            financeur à le supposer.
          */}
          <FieldRow
            label="Nature de l'action"
            value={NATURE_ACTION_LABELS[data.natureAction ?? "action_formation"]}
          />
          <FieldRow label="Intitulé de l'action" value={data.intituleAction} />
          {data.modalite ? (
            <FieldRow label="Modalité d'exécution" value={MODALITE_LABELS[data.modalite]} />
          ) : null}
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
        </DocSection>

        {/* Durée en centièmes — bloc mis en avant */}
        <View style={styles.dureeBlock}>
          <Text style={styles.dureeLabel}>Durée réalisée (format réglementaire en centièmes)</Text>
          <Text style={styles.dureeValue}>{`${dureeFormatee} heures`}</Text>
          <Text style={styles.dureeNote}>
            Conformément à l'arrêté du 21 décembre 2018 — format centièmes obligatoire (OPCO Atlas).
          </Text>
        </View>

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
                  Scannez le QR code ou saisissez l'URL ci-dessus pour vérifier l'authenticité de ce
                  certificat.
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
                {`Fait à ${identite.adresseSiege || "—"}, le ${data.dateEmission}`}
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
