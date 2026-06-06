/**
 * Qualiopi — Layout de base partagé pour tous les PDF officiels.
 *
 * Composants : QualiopiPage, DocSection, FieldRow.
 * Styles : pdfStyles (StyleSheet.create — charte via brand-tokens, 0 hex en dur).
 * Polices : registerQualiopiPdfFonts() appelé au niveau module.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { brandColor, QUALIOPI_BRAND_FONTS } from "@/server/qualiopi/brand/brand-tokens";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
// Ré-export pour que les templates puissent importer le type depuis base-layout.
export type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// Enregistrement des polices au chargement du module.
registerQualiopiPdfFonts();

// ============================================================
// Styles partagés
// ============================================================

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: QUALIOPI_BRAND_FONTS.sans,
    color: brandColor("fg"),
    lineHeight: 1.5,
    backgroundColor: brandColor("paper"),
    position: "relative",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: brandColor("terracotta"),
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
    color: brandColor("terracotta"),
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 8,
    color: brandColor("fg-soft"),
    marginTop: 1,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
  },
  paragraph: {
    fontSize: 10,
    color: brandColor("fg"),
    marginBottom: 4,
    lineHeight: 1.5,
  },
  table: {
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
    paddingVertical: 6,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "bold",
    color: brandColor("fg-soft"),
    flex: 1,
    paddingRight: 4,
  },
  tableCell: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
    paddingRight: 4,
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("sand"),
  },
  fieldLabel: {
    fontSize: 9,
    color: brandColor("fg-soft"),
    width: 160,
    fontWeight: "bold",
  },
  fieldValue: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
  },
  signatureZone: {
    flexDirection: "row",
    marginTop: 24,
    gap: 24,
  },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    minHeight: 80,
    padding: 8,
    borderRadius: 2,
  },
  legalNote: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
    marginTop: 8,
  },
  watermark: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 72,
    color: brandColor("border"),
    opacity: 0.18,
    transform: "rotate(-45deg)",
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    fontSize: 8,
    color: brandColor("fg-muted"),
    borderTopWidth: 1,
    borderTopColor: brandColor("border"),
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

// ============================================================
// Composant de page principal
// ============================================================

interface QualiopiPageProps {
  docTitle: string;
  docNumber: string;
  identite: OrganismeIdentite;
  estCopie?: boolean;
  children: React.ReactNode;
}

/**
 * Wrapper de page A4 avec en-tête organisme, numéro de document,
 * filigrane "COPIE" optionnel, et footer paginé.
 *
 * Les templates de documents l'enveloppent dans `<Document>`.
 */
export function QualiopiPage({
  docTitle,
  docNumber,
  identite,
  estCopie = false,
  children,
}: QualiopiPageProps): React.ReactElement {
  const monoOverride = {
    fontFamily: QUALIOPI_BRAND_FONTS.mono,
    fontSize: 9,
    textAlign: "right" as const,
  };

  const footerOrg =
    `Organisme de formation` +
    (identite.nda ? ` — NDA ${identite.nda}` : "") +
    (identite.qualiopi ? ` — Qualiopi ${identite.qualiopi}` : "");

  return (
    <Page size="A4" style={pdfStyles.page}>
      {/* Filigrane COPIE */}
      {estCopie && <Text style={pdfStyles.watermark}>COPIE</Text>}

      {/* En-tête */}
      <View style={pdfStyles.header}>
        <View style={pdfStyles.headerLeft}>
          <Text style={pdfStyles.headerTitle}>{identite.raisonSociale || "Axion-IA SAS"}</Text>
          {identite.nda ? <Text style={pdfStyles.headerMeta}>NDA : {identite.nda}</Text> : null}
          {identite.qualiopi ? (
            <Text style={pdfStyles.headerMeta}>Qualiopi : {identite.qualiopi}</Text>
          ) : null}
          {identite.siret ? (
            <Text style={pdfStyles.headerMeta}>SIRET : {identite.siret}</Text>
          ) : null}
        </View>
        <View>
          <Text style={[pdfStyles.headerMeta, monoOverride]}>{docTitle}</Text>
          <Text style={[pdfStyles.headerMeta, monoOverride]}>{docNumber}</Text>
        </View>
      </View>

      {/* Contenu */}
      {children}

      {/* Footer paginé — Text.render supporte pageNumber/totalPages */}
      <View style={pdfStyles.footer}>
        <Text>{footerOrg}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} fixed />
      </View>
    </Page>
  );
}

// ============================================================
// Composants utilitaires partagés
// ============================================================

interface DocSectionProps {
  title: string;
  children: React.ReactNode;
}

/** Section avec titre et séparateur. */
export function DocSection({ title, children }: DocSectionProps): React.ReactElement {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
}

/** Ligne label / valeur (tableau de champs). */
export function FieldRow({ label, value }: FieldRowProps): React.ReactElement {
  return (
    <View style={pdfStyles.fieldRow}>
      <Text style={pdfStyles.fieldLabel}>{label}</Text>
      <Text style={pdfStyles.fieldValue}>{value}</Text>
    </View>
  );
}
