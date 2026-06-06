/**
 * Qualiopi — Facture de prestation de formation professionnelle.
 *
 * Mention légale EXACTE : LEGAL_MENTIONS.factureExonerationTva
 * Exonération TVA : article 261-4-4° du Code Général des Impôts.
 *
 * NDA + Qualiopi + SIRET obligatoires dans l'en-tête (via QualiopiPage).
 * Montants en centimes d'euro (prixUnitaireHtCents, totalHtCents) pour
 * éviter les erreurs d'arrondi flottant.
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

/** Formate des centimes en euros avec virgule décimale française. Ex: 150000 → "1 500,00 €" */
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
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: brandColor("mocha"),
    paddingBottom: 4,
    marginBottom: 4,
  },
  colDesignation: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPu: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: brandColor("fg-soft"),
  },
  tableBodyRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: pdfStyles.fieldRow.borderBottomColor as string,
  },
  tableCellText: {
    fontSize: 10,
    color: brandColor("fg"),
  },
  totalsBlock: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 240,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
  },
  totalLabel: {
    fontSize: 10,
    flex: 1,
    color: brandColor("fg-soft"),
    fontWeight: "bold",
  },
  totalValue: {
    fontSize: 10,
    color: brandColor("fg"),
    fontFamily: "Inconsolata",
  },
  totalTtcRow: {
    flexDirection: "row",
    width: 240,
    paddingVertical: 5,
    backgroundColor: brandColor("mocha"),
    paddingHorizontal: 6,
    marginTop: 2,
    borderRadius: 2,
  },
  totalTtcLabel: {
    fontSize: 11,
    flex: 1,
    color: brandColor("primary-fg"),
    fontWeight: "bold",
  },
  totalTtcValue: {
    fontSize: 11,
    color: brandColor("primary-fg"),
    fontFamily: "Inconsolata",
    fontWeight: "bold",
  },
  subrogationBlock: {
    padding: 8,
    marginTop: 10,
    borderRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: brandColor("terracotta"),
    borderWidth: 1,
    borderColor: brandColor("border"),
  },
  subrogationText: {
    fontSize: 9,
    color: brandColor("fg"),
  },
  ribBlock: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    borderRadius: 2,
  },
  ribTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: brandColor("fg-soft"),
    marginBottom: 4,
  },
});

// ============================================================
// Types de données
// ============================================================

export interface LigneFacture {
  designation: string;
  quantite: number;
  prixUnitaireHtCents: number;
}

export interface ClientFacture {
  raisonSociale: string;
  siret?: string;
  adresse?: string;
  email?: string;
}

export interface SubrogationOpco {
  nomOpco: string;
  numeroDossier: string;
}

export interface RibFacture {
  iban: string;
  bic: string;
  titulaire: string;
  banque?: string;
}

export interface FactureData {
  numero: string;
  dateEmission: string;
  dateEcheance: string;
  identite: OrganismeIdentite;
  client: ClientFacture;
  lignes: LigneFacture[];
  subrogationOpco?: SubrogationOpco;
  rib?: RibFacture;
  estCopie?: boolean;
}

// ============================================================
// Composant principal
// ============================================================

export function FacturePdf({ data }: { data: FactureData }): React.ReactElement {
  const { identite } = data;

  const totalHtCents = data.lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaireHtCents, 0);

  return (
    <Document>
      <QualiopiPage
        docTitle="Facture"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Identifiants de facturation */}
        <DocSection title="Informations de facturation">
          <FieldRow label="N° de facture" value={data.numero} />
          <FieldRow label="Date d'émission" value={data.dateEmission} />
          <FieldRow label="Date d'échéance" value={data.dateEcheance} />
          {identite.nda ? (
            <FieldRow label="N° déclaration activité (NDA)" value={identite.nda} />
          ) : null}
          {identite.qualiopi ? (
            <FieldRow label="Certification Qualiopi" value={identite.qualiopi} />
          ) : null}
          {identite.siret ? <FieldRow label="SIRET" value={identite.siret} /> : null}
        </DocSection>

        {/* Client */}
        <DocSection title="Client">
          <FieldRow label="Raison sociale" value={data.client.raisonSociale} />
          {data.client.siret ? <FieldRow label="SIRET" value={data.client.siret} /> : null}
          {data.client.adresse ? <FieldRow label="Adresse" value={data.client.adresse} /> : null}
          {data.client.email ? <FieldRow label="Email" value={data.client.email} /> : null}
        </DocSection>

        {/* Détail des prestations */}
        <DocSection title="Détail des prestations">
          {/* En-tête tableau */}
          <View style={styles.tableHeader}>
            <View style={styles.colDesignation}>
              <Text style={styles.tableHeaderText}>Désignation</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.tableHeaderText}>Qté</Text>
            </View>
            <View style={styles.colPu}>
              <Text style={styles.tableHeaderText}>P.U. HT</Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.tableHeaderText}>Total HT</Text>
            </View>
          </View>

          {/* Lignes */}
          {data.lignes.map((ligne, idx) => {
            const ligneTotal = ligne.quantite * ligne.prixUnitaireHtCents;
            return (
              <View key={idx} style={styles.tableBodyRow}>
                <View style={styles.colDesignation}>
                  <Text style={styles.tableCellText}>{ligne.designation}</Text>
                </View>
                <View style={styles.colQty}>
                  <Text style={[styles.tableCellText, { textAlign: "right" }]}>
                    {String(ligne.quantite)}
                  </Text>
                </View>
                <View style={styles.colPu}>
                  <Text style={[styles.tableCellText, { textAlign: "right" }]}>
                    {formatEuros(ligne.prixUnitaireHtCents)}
                  </Text>
                </View>
                <View style={styles.colTotal}>
                  <Text style={[styles.tableCellText, { textAlign: "right" }]}>
                    {formatEuros(ligneTotal)}
                  </Text>
                </View>
              </View>
            );
          })}
        </DocSection>

        {/* Totaux */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{formatEuros(totalHtCents)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA (0 %)</Text>
            <Text style={styles.totalValue}>{formatEuros(0)}</Text>
          </View>
          <View style={styles.totalTtcRow}>
            <Text style={styles.totalTtcLabel}>Total TTC</Text>
            <Text style={styles.totalTtcValue}>{formatEuros(totalHtCents)}</Text>
          </View>
        </View>

        {/* Mention exonération TVA */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.factureExonerationTva}</Text>
        </View>

        {/* Subrogation OPCO */}
        {data.subrogationOpco ? (
          <View style={styles.subrogationBlock}>
            <Text style={styles.subrogationText}>
              {`Facture libellée à l'OPCO ${data.subrogationOpco.nomOpco} dans le cadre de la subrogation de paiement — N° dossier : ${data.subrogationOpco.numeroDossier}.`}
            </Text>
          </View>
        ) : null}

        {/* RIB */}
        {data.rib ? (
          <View style={styles.ribBlock}>
            <Text style={styles.ribTitle}>Coordonnées bancaires</Text>
            <FieldRow label="Titulaire" value={data.rib.titulaire} />
            {data.rib.banque ? <FieldRow label="Banque" value={data.rib.banque} /> : null}
            <FieldRow label="IBAN" value={data.rib.iban} />
            <FieldRow label="BIC" value={data.rib.bic} />
          </View>
        ) : null}
      </QualiopiPage>
    </Document>
  );
}
