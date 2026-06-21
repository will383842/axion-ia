/**
 * Qualiopi — Layout de base partagé pour tous les PDF officiels.
 *
 * Design system :
 *   - Échelle typographique/espacement centralisée (QUALIOPI_PDF_TYPE / _SPACE).
 *   - Palette via brand-tokens (0 hex en dur ; verrouillée par le parity test).
 *   - Composants de page : QualiopiPage (en-tête + filigrane + pied paginé avec
 *     adresse postale complète répétée sur chaque page → exigence audit OF).
 *   - Composants de contenu réutilisables : DocSection, FieldRow, SignatureZone,
 *     DataTable, LegalCallout, BulletList. Ils remplacent les StyleSheet locaux
 *     dupliqués dans chaque template (cohérence + conformité homogène).
 *   - Helpers monétaires centralisés : formatEur, formatEurosFromCents.
 *
 * Polices : registerQualiopiPdfFonts() appelé au niveau module.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  brandColor,
  QUALIOPI_BRAND_FONTS,
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
// Ré-export pour que les templates puissent importer le type depuis base-layout.
export type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// Enregistrement des polices au chargement du module.
registerQualiopiPdfFonts();

// ============================================================
// Helpers monétaires centralisés (fin des formatEur dupliqués par template)
// ============================================================

/** Formate un montant en EUROS (nombre) → "1 500,00 €" (virgule décimale FR). */
export function formatEur(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(montant);
}

/** Formate des CENTIMES (entier) → "1 500,00 €". Évite les erreurs d'arrondi flottant. */
export function formatEurosFromCents(cents: number): string {
  return formatEur(cents / 100);
}

// ============================================================
// Styles partagés
// ============================================================

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: S.page,
    paddingHorizontal: S.page,
    // Réserve l'espace du pied de page (identité + adresse sur 3 lignes).
    paddingBottom: 64,
    fontSize: T.base,
    fontFamily: QUALIOPI_BRAND_FONTS.sans,
    color: brandColor("fg"),
    lineHeight: T.lineNormal,
    backgroundColor: brandColor("paper"),
    position: "relative",
  },

  // ---- En-tête -------------------------------------------------
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: S.xxl,
    paddingBottom: S.xl,
    borderBottomWidth: 2,
    borderBottomColor: brandColor("terracotta"),
  },
  headerLeft: {
    flex: 1,
    paddingRight: S.xl,
  },
  headerEyebrow: {
    fontSize: T.xs,
    fontFamily: QUALIOPI_BRAND_FONTS.sans,
    fontWeight: "bold",
    letterSpacing: T.trackingWide,
    textTransform: "uppercase",
    color: brandColor("terracotta"),
    marginBottom: S.xs,
  },
  headerTitle: {
    fontSize: T.xl,
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: S.xs,
  },
  headerMeta: {
    fontSize: T.xs,
    color: brandColor("fg-soft"),
    marginTop: 1,
  },
  // Bloc méta document (droite) — encart discret pour le titre + n° de doc.
  headerDocBox: {
    minWidth: 150,
    borderWidth: 1,
    borderColor: brandColor("border"),
    borderRadius: S.radius,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    backgroundColor: brandColor("bg"),
  },
  headerDocLabel: {
    fontSize: 7,
    fontWeight: "bold",
    letterSpacing: T.trackingWide,
    textTransform: "uppercase",
    color: brandColor("fg-muted"),
    textAlign: "right",
    marginBottom: 1,
  },
  headerDocTitle: {
    fontSize: T.sm,
    fontFamily: QUALIOPI_BRAND_FONTS.sans,
    fontWeight: "bold",
    color: brandColor("mocha"),
    textAlign: "right",
  },
  headerDocNumber: {
    fontSize: T.sm,
    fontFamily: QUALIOPI_BRAND_FONTS.mono,
    color: brandColor("terracotta-deep"),
    textAlign: "right",
    marginTop: 1,
  },

  // ---- Sections ------------------------------------------------
  section: {
    marginBottom: S.xxl,
  },
  sectionTitle: {
    fontSize: T.md,
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: S.md,
    paddingBottom: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
  },
  paragraph: {
    fontSize: T.base,
    color: brandColor("fg"),
    marginBottom: S.sm,
    lineHeight: T.lineNormal,
  },

  // ---- Tables génériques (compat) ------------------------------
  table: {
    marginBottom: S.lg,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
    paddingVertical: S.md,
  },
  tableHeaderCell: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: brandColor("fg-soft"),
    flex: 1,
    paddingRight: S.sm,
  },
  tableCell: {
    fontSize: T.base,
    color: brandColor("fg"),
    flex: 1,
    paddingRight: S.sm,
  },

  // ---- Champs label / valeur -----------------------------------
  fieldRow: {
    flexDirection: "row",
    marginBottom: S.sm,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("sand"),
  },
  fieldLabel: {
    fontSize: T.sm,
    color: brandColor("fg-soft"),
    width: 160,
    fontWeight: "bold",
  },
  fieldValue: {
    fontSize: T.base,
    color: brandColor("fg"),
    flex: 1,
  },
  // Valeur manquante mise en évidence (rouge terracotta) — ne JAMAIS masquer
  // en silence un identifiant obligatoire absent.
  fieldValueMissing: {
    fontSize: T.base,
    color: brandColor("terracotta-deep"),
    flex: 1,
    fontStyle: "italic",
  },

  // ---- Signatures ----------------------------------------------
  signatureZone: {
    flexDirection: "row",
    marginTop: S.xxxl,
    gap: S.xxl,
  },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    minHeight: 84,
    padding: S.lg,
    borderRadius: S.radius,
    backgroundColor: brandColor("bg"),
  },
  signatureBoxTitle: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: S.xs,
  },
  signatureBoxName: {
    fontSize: T.base,
    color: brandColor("fg"),
    marginBottom: S.sm,
  },
  signatureBoxMention: {
    fontSize: T.xs,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
    marginTop: S.xxl,
  },

  // ---- Notes légales -------------------------------------------
  legalNote: {
    fontSize: T.xs,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
    marginTop: S.lg,
    lineHeight: T.lineNormal,
  },

  // ---- Filigrane ----------------------------------------------
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

  // ---- Pied de page (identité + adresse postale, répété par page) ----
  footer: {
    position: "absolute",
    bottom: 22,
    left: S.page,
    right: S.page,
    borderTopWidth: 1,
    borderTopColor: brandColor("border"),
    paddingTop: S.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerIdentity: {
    flex: 1,
    paddingRight: S.xl,
  },
  footerOrg: {
    fontSize: T.xs,
    fontWeight: "bold",
    color: brandColor("fg-soft"),
  },
  footerLine: {
    fontSize: 7,
    color: brandColor("fg-muted"),
    marginTop: 1,
  },
  footerPage: {
    fontSize: T.xs,
    color: brandColor("fg-muted"),
    fontFamily: QUALIOPI_BRAND_FONTS.mono,
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
  /** Sur-titre optionnel au-dessus de la raison sociale (ex. « Organisme de formation »). */
  eyebrow?: string;
  children: React.ReactNode;
}

/** Joint des fragments non vides avec un séparateur (ignore "", null, undefined). */
function joinDefined(parts: Array<string | null | undefined>, sep: string): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

/**
 * Wrapper de page A4 avec en-tête organisme, encart numéro de document,
 * filigrane "COPIE" optionnel, et pied de page paginé portant l'identité +
 * l'adresse postale complète de l'OF (répétée sur chaque page — pièce d'audit).
 *
 * Les templates de documents l'enveloppent dans `<Document>`.
 */
export function QualiopiPage({
  docTitle,
  docNumber,
  identite,
  estCopie = false,
  eyebrow = "Organisme de formation",
  children,
}: QualiopiPageProps): React.ReactElement {
  const footerIds = joinDefined(
    [
      identite.siret ? `SIRET ${identite.siret}` : "",
      identite.nda ? `NDA ${identite.nda}` : "",
      identite.qualiopi ? `Qualiopi ${identite.qualiopi}` : "",
    ],
    "  ·  ",
  );
  const footerContact = joinDefined([identite.email, identite.telephone, identite.site], "  ·  ");

  return (
    <Page size="A4" style={pdfStyles.page}>
      {/* Filigrane COPIE */}
      {estCopie && <Text style={pdfStyles.watermark}>COPIE</Text>}

      {/* En-tête */}
      <View style={pdfStyles.header} fixed>
        <View style={pdfStyles.headerLeft}>
          {eyebrow ? <Text style={pdfStyles.headerEyebrow}>{eyebrow}</Text> : null}
          <Text style={pdfStyles.headerTitle}>{identite.raisonSociale || "Axion-IA SAS"}</Text>
          {identite.adresseSiege ? (
            <Text style={pdfStyles.headerMeta}>{identite.adresseSiege}</Text>
          ) : null}
          {footerIds ? <Text style={pdfStyles.headerMeta}>{footerIds}</Text> : null}
        </View>
        <View style={pdfStyles.headerDocBox}>
          <Text style={pdfStyles.headerDocLabel}>{docTitle}</Text>
          <Text style={pdfStyles.headerDocNumber}>{docNumber}</Text>
        </View>
      </View>

      {/* Contenu */}
      {children}

      {/* Pied de page — répété sur chaque page (fixed) */}
      <View style={pdfStyles.footer} fixed>
        <View style={pdfStyles.footerIdentity}>
          <Text style={pdfStyles.footerOrg}>
            {joinDefined([identite.raisonSociale || "Axion-IA SAS", identite.adresseSiege], " — ")}
          </Text>
          {footerIds ? <Text style={pdfStyles.footerLine}>{footerIds}</Text> : null}
          {footerContact ? <Text style={pdfStyles.footerLine}>{footerContact}</Text> : null}
        </View>
        <Text
          style={pdfStyles.footerPage}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          fixed
        />
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
  /**
   * Si `true` et `value` vide/—, la valeur est rendue en rouge italique
   * (« Non renseigné ») au lieu d'être masquée : un identifiant obligatoire
   * absent doit SAUTER AUX YEUX, pas disparaître en silence.
   */
  required?: boolean;
}

/** Ligne label / valeur (tableau de champs). */
export function FieldRow({ label, value, required = false }: FieldRowProps): React.ReactElement {
  const isMissing = !value || !value.trim() || value.trim() === "—";
  if (isMissing && required) {
    return (
      <View style={pdfStyles.fieldRow}>
        <Text style={pdfStyles.fieldLabel}>{label}</Text>
        <Text style={pdfStyles.fieldValueMissing}>Non renseigné</Text>
      </View>
    );
  }
  return (
    <View style={pdfStyles.fieldRow}>
      <Text style={pdfStyles.fieldLabel}>{label}</Text>
      <Text style={pdfStyles.fieldValue}>{value}</Text>
    </View>
  );
}

// ---- SignatureZone ------------------------------------------

export interface SignaturePartie {
  /** Ex. « Pour l'organisme de formation ». */
  titre: string;
  /** Nom de l'entité/personne (raison sociale, nom du signataire). */
  nom?: string;
  /** Mention en bas de l'encadré (défaut : « Nom, qualité, signature et cachet »). */
  mention?: string;
}

interface SignatureZoneProps {
  parties: SignaturePartie[];
  /** Phrase d'introduction (ex. « établie en deux exemplaires originaux »). */
  intro?: string;
  /** Ligne « Fait à …, le … » avec la date. Si fournie, affichée avant les cases. */
  faitLe?: string;
}

const signatureLocal = StyleSheet.create({
  intro: {
    fontSize: T.xs,
    fontStyle: "italic",
    color: brandColor("fg-muted"),
    marginBottom: S.lg,
  },
  faitLe: {
    fontSize: T.base,
    color: brandColor("fg"),
    marginBottom: S.md,
  },
  approuve: {
    fontSize: T.xs,
    fontStyle: "italic",
    color: brandColor("fg-soft"),
    marginBottom: S.sm,
  },
});

/**
 * Zone de signatures normalisée (1 à 3 parties). Remplace les
 * `signatureZone`/`signatureBox`/`signatureLabel`/`signatureLu` redéfinis
 * dans chaque template. Les encadrés s'étalent uniformément.
 */
export function SignatureZone({ parties, intro, faitLe }: SignatureZoneProps): React.ReactElement {
  return (
    <View wrap={false}>
      {intro ? <Text style={signatureLocal.intro}>{intro}</Text> : null}
      {faitLe ? <Text style={signatureLocal.faitLe}>{`Fait à ${faitLe}`}</Text> : null}
      <View style={pdfStyles.signatureZone}>
        {parties.map((p, i) => (
          <View key={i} style={pdfStyles.signatureBox}>
            <Text style={pdfStyles.signatureBoxTitle}>{p.titre}</Text>
            <Text style={signatureLocal.approuve}>Lu et approuvé</Text>
            {p.nom ? <Text style={pdfStyles.signatureBoxName}>{p.nom}</Text> : null}
            <Text style={pdfStyles.signatureBoxMention}>
              {p.mention ?? "Nom, qualité, signature et cachet"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---- DataTable ----------------------------------------------

export interface DataColumn {
  /** Clé dans chaque ligne (`rows[i][key]`). */
  key: string;
  /** Libellé d'en-tête. */
  header: string;
  /** Poids de la colonne (flex). Défaut 1. */
  flex?: number;
  /** Alignement du contenu. Défaut « left ». */
  align?: "left" | "right" | "center";
}

interface DataTableProps {
  columns: DataColumn[];
  rows: Array<Record<string, React.ReactNode>>;
  /** Nombre de lignes vides à ajouter (émargement papier). Défaut 0. */
  emptyRows?: number;
  /** Hauteur minimale des lignes (émargement = grandes cases). */
  minRowHeight?: number;
}

const tableLocal = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    backgroundColor: brandColor("sand"),
    borderTopWidth: 1,
    borderTopColor: brandColor("border-strong"),
    borderBottomWidth: 1.5,
    borderBottomColor: brandColor("border-strong"),
    paddingVertical: S.md,
    paddingHorizontal: S.sm,
  },
  headerCell: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: brandColor("mocha"),
    paddingRight: S.sm,
  },
  dataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
    paddingVertical: S.md,
    paddingHorizontal: S.sm,
  },
  dataCell: {
    fontSize: T.base,
    color: brandColor("fg"),
    paddingRight: S.sm,
  },
});

/**
 * Tableau de données générique (en-tête + lignes + lignes vides optionnelles).
 * Remplace les `tableHeaderRow`/`tableDataRow`/`cellXxx` réinventés dans
 * facture, émargement, kits, lettre-mission, grille d'évaluation, etc.
 */
export function DataTable({
  columns,
  rows,
  emptyRows = 0,
  minRowHeight,
}: DataTableProps): React.ReactElement {
  const colStyle = (c: DataColumn) => ({
    flex: c.flex ?? 1,
    textAlign: (c.align ?? "left") as "left" | "right" | "center",
  });
  const rowStyle = minRowHeight
    ? [tableLocal.dataRow, { minHeight: minRowHeight }]
    : tableLocal.dataRow;

  return (
    <View style={pdfStyles.table}>
      <View style={tableLocal.headerRow}>
        {columns.map((c) => (
          <Text key={c.key} style={[tableLocal.headerCell, colStyle(c)]}>
            {c.header}
          </Text>
        ))}
      </View>
      {rows.map((row, idx) => (
        <View key={idx} style={rowStyle} wrap={false}>
          {columns.map((c) => (
            <View key={c.key} style={colStyle(c)}>
              {typeof row[c.key] === "string" || typeof row[c.key] === "number" ? (
                <Text style={[tableLocal.dataCell, { textAlign: c.align ?? "left" }]}>
                  {row[c.key]}
                </Text>
              ) : (
                ((row[c.key] as React.ReactNode) ?? <Text style={tableLocal.dataCell}> </Text>)
              )}
            </View>
          ))}
        </View>
      ))}
      {Array.from({ length: emptyRows }).map((_, idx) => (
        <View key={`empty-${idx}`} style={rowStyle}>
          {columns.map((c) => (
            <View key={c.key} style={colStyle(c)}>
              <Text style={tableLocal.dataCell}> </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---- LegalCallout -------------------------------------------

export type CalloutVariant = "info" | "warning" | "success" | "legal";

interface CalloutTheme {
  bg: string;
  border: string;
  title: string;
}

function calloutTheme(variant: CalloutVariant): CalloutTheme {
  switch (variant) {
    case "info":
      return {
        bg: brandColor("primary-soft"),
        border: brandColor("primary"),
        title: brandColor("primary-hover"),
      };
    case "warning":
      return {
        bg: brandColor("terracotta-soft"),
        border: brandColor("terracotta"),
        title: brandColor("terracotta-deep"),
      };
    case "success":
      return { bg: brandColor("sage-soft"), border: brandColor("sage"), title: brandColor("sage") };
    case "legal":
    default:
      return {
        bg: brandColor("bg"),
        border: brandColor("border-strong"),
        title: brandColor("mocha"),
      };
  }
}

interface LegalCalloutProps {
  variant?: CalloutVariant;
  /** Titre optionnel (gras) en tête du callout. */
  title?: string;
  children: React.ReactNode;
}

/**
 * `true` si le nœud est purement textuel (string/number, ou tableau de tels —
 * ex. `["texte ", email, "."]`). Sert à envelopper automatiquement le contenu
 * dans un <Text> : @react-pdf rejette toute chaîne hors <Text> (texte perdu
 * silencieusement). Faux dès qu'un élément React est présent (déjà structuré).
 */
function estTextuel(node: React.ReactNode): boolean {
  if (typeof node === "string" || typeof node === "number") return true;
  if (Array.isArray(node)) return node.every((n) => estTextuel(n));
  return false;
}

/**
 * Encart mis en évidence (mention légale, avertissement, info, succès).
 * Bord gauche coloré + fond doux. Unifie les nombreux blocs ad hoc
 * (subrogation, RAC, durée certifiée, bannières d'attestation partielle…).
 */
export function LegalCallout({
  variant = "legal",
  title,
  children,
}: LegalCalloutProps): React.ReactElement {
  const theme = calloutTheme(variant);
  return (
    <View
      wrap={false}
      style={{
        backgroundColor: theme.bg,
        borderWidth: 1,
        borderColor: brandColor("border"),
        borderLeftWidth: 3,
        borderLeftColor: theme.border,
        borderRadius: S.radius,
        paddingVertical: S.lg,
        paddingHorizontal: S.xl,
        marginTop: S.lg,
      }}
    >
      {title ? (
        <Text
          style={{
            fontSize: T.sm,
            fontWeight: "bold",
            color: theme.title,
            marginBottom: S.xs,
          }}
        >
          {title}
        </Text>
      ) : null}
      {estTextuel(children) ? (
        <Text style={{ fontSize: T.sm, color: brandColor("fg"), lineHeight: T.lineNormal }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

// ---- BulletList ---------------------------------------------

export type BulletVariant = "default" | "check" | "objective";

interface BulletListProps {
  items: string[];
  variant?: BulletVariant;
}

function bulletGlyph(variant: BulletVariant): { glyph: string; color: string } {
  switch (variant) {
    case "check":
      return { glyph: "✓", color: brandColor("sage") };
    case "objective":
      return { glyph: "→", color: brandColor("primary") };
    case "default":
    default:
      return { glyph: "•", color: brandColor("terracotta") };
  }
}

const bulletLocal = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: S.xs,
    paddingLeft: S.sm,
  },
  glyph: {
    width: 12,
    fontSize: T.base,
    fontWeight: "bold",
  },
  text: {
    flex: 1,
    fontSize: T.base,
    color: brandColor("fg"),
    lineHeight: T.lineNormal,
  },
});

/**
 * Liste à puces normalisée (• terracotta par défaut, ✓ sage, → bleu objectifs).
 * Remplace les `{items.map(i => <Text>• {i}</Text>)}` manuels dispersés.
 */
export function BulletList({ items, variant = "default" }: BulletListProps): React.ReactElement {
  const { glyph, color } = bulletGlyph(variant);
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={bulletLocal.row}>
          <Text style={[bulletLocal.glyph, { color }]}>{glyph}</Text>
          <Text style={bulletLocal.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}
