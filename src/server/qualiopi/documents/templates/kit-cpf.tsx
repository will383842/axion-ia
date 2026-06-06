/**
 * Qualiopi — Kit CPF/EDOF : récapitulatif du dossier de financement CPF.
 *
 * Contient : code CPF/EDOF, liste des pièces, reste à charge (PLF 2026),
 * récap financier (montant CPF, reste à charge bénéficiaire).
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
  pieceLabel: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
  },
  racBlock: {
    backgroundColor: brandColor("terracotta-soft"),
    padding: 10,
    marginTop: 8,
    borderRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: brandColor("terracotta"),
  },
  racLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: brandColor("terracotta-deep"),
    marginBottom: 2,
  },
  racValue: {
    fontSize: 16,
    fontFamily: "Inconsolata",
    fontWeight: "bold",
    color: brandColor("terracotta"),
  },
  racNote: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
    marginTop: 2,
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
});

// ============================================================
// Types de données
// ============================================================

export interface BeneficiaireCpf {
  nom: string;
  prenom: string;
  numeroEdof?: string;
}

export interface KitCpfData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  beneficiaire: BeneficiaireCpf;
  codeCpf: string;
  intituleFormation: string;
  dateDebut: string;
  dateFin: string;
  montantCpfCents: number;
  resteAChargeCents: number;
  coutTotalCents: number;
  estCopie?: boolean;
}

// ============================================================
// Composant principal
// ============================================================

export function KitCpfPdf({ data }: { data: KitCpfData }): React.ReactElement {
  const { identite } = data;
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();

  return (
    <Document>
      <QualiopiPage
        docTitle="Kit dossier CPF / EDOF"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Identification de la formation */}
        <DocSection title="Formation et bénéficiaire">
          <FieldRow label="Code CPF" value={data.codeCpf} />
          {data.beneficiaire.numeroEdof ? (
            <FieldRow label="N° EDOF (Mon Compte Formation)" value={data.beneficiaire.numeroEdof} />
          ) : null}
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Bénéficiaire" value={prenomNom} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
        </DocSection>

        {/* Pièces constitutives */}
        <DocSection title="Pièces constitutives du dossier CPF">
          {[
            { label: "Accord de prise en charge EDOF / Mon Compte Formation" },
            { label: "Attestation de fin de formation (ou partielle)" },
            { label: "Facture exonérée de TVA (Art. 261-4-4° CGI)" },
            { label: "Feuilles d'émargement ou relevés de connexion" },
          ].map((piece, idx) => (
            <View key={idx} style={styles.pieceRow}>
              <Text style={styles.pieceCheck}>☐</Text>
              <Text style={styles.pieceLabel}>{piece.label}</Text>
            </View>
          ))}
        </DocSection>

        {/* Récapitulatif financier */}
        <DocSection title="Récapitulatif financier">
          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Coût total de la formation</Text>
            <Text style={styles.financeValue}>{formatEuros(data.coutTotalCents)}</Text>
          </View>
          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Montant pris en charge par le CPF</Text>
            <Text style={styles.financeValue}>{formatEuros(data.montantCpfCents)}</Text>
          </View>
        </DocSection>

        {/* Reste à charge — bloc mis en avant (PLF 2026) */}
        <View style={styles.racBlock}>
          <Text style={styles.racLabel}>Reste à charge bénéficiaire (PLF 2026)</Text>
          <Text style={styles.racValue}>{formatEuros(data.resteAChargeCents)}</Text>
          <Text style={styles.racNote}>
            Conformément aux dispositions du Projet de Loi de Finances 2026. Le reste à charge est
            payé directement par le bénéficiaire à l'organisme de formation.
          </Text>
        </View>

        {/* Mentions légales */}
        <View style={[pdfStyles.section, { marginTop: 16 }]}>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.factureExonerationTva}</Text>
          <Text style={pdfStyles.legalNote}>
            {`NDA : ${identite.nda || "à renseigner"} — Qualiopi : ${identite.qualiopi || "à renseigner"}`}
          </Text>
        </View>
      </QualiopiPage>
    </Document>
  );
}
