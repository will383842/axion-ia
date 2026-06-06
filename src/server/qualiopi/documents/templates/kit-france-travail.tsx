/**
 * Qualiopi — Kit France Travail : récapitulatif du dossier AIF/POEI/CSP.
 *
 * Couvre les 3 dispositifs France Travail :
 *   - AIF (Aide Individuelle à la Formation)
 *   - POEI (Préparation Opérationnelle à l'Emploi Individuelle)
 *   - CSP (Contrat de Sécurisation Professionnelle)
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Helpers monétaires
// ============================================================

function formatEuros(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

// ============================================================
// Styles spécifiques
// ============================================================

const styles = StyleSheet.create({
  dispositifBadge: {
    backgroundColor: brandColor("primary-soft"),
    padding: 8,
    marginBottom: 14,
    borderRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: brandColor("primary"),
    flexDirection: "row",
    alignItems: "center",
  },
  dispositifLabel: {
    fontSize: 9,
    color: brandColor("fg-soft"),
    fontWeight: "bold",
    marginRight: 8,
  },
  dispositifValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: brandColor("primary"),
  },
  pieceRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("sand"),
    alignItems: "flex-start",
  },
  pieceCheck: {
    width: 16,
    fontSize: 10,
    color: brandColor("sage"),
    fontWeight: "bold",
  },
  pieceLabelBlock: { flex: 1 },
  pieceLabel: {
    fontSize: 10,
    color: brandColor("fg"),
  },
  pieceCondition: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
  },
  financeRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
  },
  financeLabel: {
    fontSize: 10,
    flex: 1,
    color: brandColor("fg-soft"),
    fontWeight: "bold",
  },
  financeValue: {
    fontSize: 10,
    color: brandColor("fg"),
    fontFamily: "Inconsolata",
  },
  totalBlock: {
    backgroundColor: brandColor("sand"),
    padding: 8,
    borderRadius: 2,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor("mocha"),
    flex: 1,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: brandColor("terracotta"),
    fontFamily: "Inconsolata",
  },
});

// ============================================================
// Types de données
// ============================================================

export type DispositifFranceTravail = "AIF" | "POEI" | "CSP";

export interface BeneficiaireFT {
  nom: string;
  prenom: string;
  identifiantPoleEmploi?: string;
}

export interface EntreprisePoei {
  raisonSociale: string;
  siret?: string;
  offreEmploiReference?: string;
}

export interface MontantsFranceTravail {
  montantAideFranceTravailCents: number;
  resteAChargeCents: number;
  coutTotalCents: number;
}

export interface KitFranceTravailData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  dispositif: DispositifFranceTravail;
  beneficiaire: BeneficiaireFT;
  intituleFormation: string;
  dateDebut: string;
  dateFin: string;
  numeroDossierFranceTravail?: string;
  entreprisePoei?: EntreprisePoei;
  montants: MontantsFranceTravail;
  estCopie?: boolean;
}

// ============================================================
// Helpers
// ============================================================

const DISPOSITIF_LABELS: Record<DispositifFranceTravail, string> = {
  AIF: "AIF — Aide Individuelle à la Formation",
  POEI: "POEI — Préparation Opérationnelle à l'Emploi Individuelle",
  CSP: "CSP — Contrat de Sécurisation Professionnelle",
};

function getPiecesRequises(
  dispositif: DispositifFranceTravail,
): Array<{ label: string; condition: string | null }> {
  const commun: Array<{ label: string; condition: string | null }> = [
    { label: "Accord de financement France Travail", condition: null },
    { label: "Engagement du bénéficiaire / Protocole de formation", condition: null },
    { label: "Attestation de fin de formation (ou certificat de réalisation)", condition: null },
    { label: "Feuilles d'émargement ou relevés de connexion", condition: null },
    { label: "Facture exonérée de TVA (Art. 261-4-4° CGI)", condition: null },
  ];
  if (dispositif === "POEI") {
    commun.unshift({
      label: "Offre d'emploi déposée sur France Travail (POEI)",
      condition: "Référence de l'offre obligatoire",
    });
    commun.push({
      label: "Convention tripartite (Bénéficiaire / Entreprise / France Travail)",
      condition: "Dispositif POEI uniquement",
    });
  }
  if (dispositif === "CSP") {
    commun.unshift({
      label: "Attestation d'entrée en CSP",
      condition: "Dispositif CSP uniquement",
    });
  }
  return commun;
}

// ============================================================
// Composant principal
// ============================================================

export function KitFranceTravailPdf({ data }: { data: KitFranceTravailData }): React.ReactElement {
  const { identite } = data;
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();
  const pieces = getPiecesRequises(data.dispositif);

  return (
    <Document>
      <QualiopiPage
        docTitle="Kit dossier France Travail"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Badge dispositif */}
        <View style={styles.dispositifBadge}>
          <Text style={styles.dispositifLabel}>Dispositif :</Text>
          <Text style={styles.dispositifValue}>{DISPOSITIF_LABELS[data.dispositif]}</Text>
        </View>

        {/* Identification */}
        <DocSection title="Identification">
          <FieldRow label="Bénéficiaire" value={prenomNom} />
          {data.beneficiaire.identifiantPoleEmploi ? (
            <FieldRow
              label="Identifiant France Travail"
              value={data.beneficiaire.identifiantPoleEmploi}
            />
          ) : null}
          {data.numeroDossierFranceTravail ? (
            <FieldRow label="N° dossier France Travail" value={data.numeroDossierFranceTravail} />
          ) : null}
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
        </DocSection>

        {/* Entreprise (POEI uniquement) */}
        {data.dispositif === "POEI" && data.entreprisePoei ? (
          <DocSection title="Entreprise partenaire (POEI)">
            <FieldRow label="Raison sociale" value={data.entreprisePoei.raisonSociale} />
            {data.entreprisePoei.siret ? (
              <FieldRow label="SIRET" value={data.entreprisePoei.siret} />
            ) : null}
            {data.entreprisePoei.offreEmploiReference ? (
              <FieldRow
                label="Référence offre d'emploi"
                value={data.entreprisePoei.offreEmploiReference}
              />
            ) : null}
          </DocSection>
        ) : null}

        {/* Pièces constitutives */}
        <DocSection title="Pièces constitutives du dossier">
          {pieces.map((piece, idx) => (
            <View key={idx} style={styles.pieceRow}>
              <Text style={styles.pieceCheck}>☐</Text>
              <View style={styles.pieceLabelBlock}>
                <Text style={styles.pieceLabel}>{piece.label}</Text>
                {piece.condition ? (
                  <Text style={styles.pieceCondition}>{piece.condition}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </DocSection>

        {/* Montants */}
        <DocSection title="Montants de financement">
          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Coût total de la formation</Text>
            <Text style={styles.financeValue}>{formatEuros(data.montants.coutTotalCents)}</Text>
          </View>
          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Aide France Travail</Text>
            <Text style={styles.financeValue}>
              {formatEuros(data.montants.montantAideFranceTravailCents)}
            </Text>
          </View>
          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Reste à charge</Text>
            <Text style={styles.totalValue}>{formatEuros(data.montants.resteAChargeCents)}</Text>
          </View>
        </DocSection>

        {/* Mentions légales */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.factureExonerationTva}</Text>
          <Text style={pdfStyles.legalNote}>
            {`NDA : ${identite.nda || "à renseigner"} — Qualiopi : ${identite.qualiopi || "à renseigner"}`}
          </Text>
        </View>
      </QualiopiPage>
    </Document>
  );
}
