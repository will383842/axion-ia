/**
 * Cadre RECOPIÉ NON signable (styles de blocs) — copie de `pdfStyles` de base-layout.tsx
 * où `brandColor` devient `couleurPiece` (palette définitive). Ne remplace RIEN :
 * les gabarits signables gardent `base-layout.tsx`.
 */
import { StyleSheet } from "@react-pdf/renderer";
import { couleurPiece as brandColor } from "@/lib/brand/jetons-pieces";
import {
  QUALIOPI_BRAND_FONTS,
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";

import { stylesPage } from "./styles-page";

export const stylesBlocs = StyleSheet.create({
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

  watermarkSpecimen: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 68,
    color: brandColor("terracotta"),
    opacity: 0.16,
    transform: "rotate(-45deg)",
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
  },
  specimenBanner: {
    borderWidth: 1,
    borderColor: brandColor("terracotta"),
    backgroundColor: brandColor("terracotta-soft"),
    borderRadius: 4,
    padding: S.md,
    marginBottom: S.lg,
  },
  specimenBannerTitle: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: brandColor("terracotta-deep"),
    marginBottom: 2,
  },
  specimenBannerText: {
    fontSize: T.xs,
    color: brandColor("fg-soft"),
    lineHeight: T.lineNormal,
  },
});

/** Équivalent de `pdfStyles`, pour les pièces non signables. */
export const pdfStylesPieces = { ...stylesPage, ...stylesBlocs };
