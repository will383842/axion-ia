/**
 * Cadre RECOPIÉ NON signable (styles de blocs) — copie de `pdfStyles` de base-layout.tsx
 * où `brandColor` devient `couleurPiece` (palette définitive). Ne remplace RIEN :
 * les gabarits signables gardent `base-layout.tsx`.
 */
import { StyleSheet } from "@react-pdf/renderer";
import { couleurPiece } from "@/server/qualiopi/brand/jetons-pieces";
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
    color: couleurPiece("mocha"),
    marginBottom: S.md,
    paddingBottom: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurPiece("border"),
  },
  paragraph: {
    fontSize: T.base,
    color: couleurPiece("fg"),
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
    borderBottomColor: couleurPiece("border"),
    paddingVertical: S.md,
  },
  tableHeaderCell: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: couleurPiece("fg-soft"),
    flex: 1,
    paddingRight: S.sm,
  },
  tableCell: {
    fontSize: T.base,
    color: couleurPiece("fg"),
    flex: 1,
    paddingRight: S.sm,
  },

  // ---- Champs label / valeur -----------------------------------
  fieldRow: {
    flexDirection: "row",
    marginBottom: S.sm,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: couleurPiece("sand"),
  },
  fieldLabel: {
    fontSize: T.sm,
    color: couleurPiece("fg-soft"),
    width: 160,
    fontWeight: "bold",
  },
  fieldValue: {
    fontSize: T.base,
    color: couleurPiece("fg"),
    flex: 1,
  },
  // Valeur manquante mise en évidence (rouge terracotta) — ne JAMAIS masquer
  // en silence un identifiant obligatoire absent.
  fieldValueMissing: {
    fontSize: T.base,
    color: couleurPiece("terracotta-deep"),
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
    borderColor: couleurPiece("border-strong"),
    minHeight: 84,
    padding: S.lg,
    borderRadius: S.radius,
    backgroundColor: couleurPiece("bg"),
  },
  signatureBoxTitle: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: couleurPiece("mocha"),
    marginBottom: S.xs,
  },
  signatureBoxName: {
    fontSize: T.base,
    color: couleurPiece("fg"),
    marginBottom: S.sm,
  },
  signatureBoxMention: {
    fontSize: T.xs,
    color: couleurPiece("fg-muted"),
    fontStyle: "italic",
    marginTop: S.xxl,
  },

  // ---- Notes légales -------------------------------------------
  legalNote: {
    fontSize: T.xs,
    color: couleurPiece("fg-muted"),
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
    color: couleurPiece("border"),
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
    color: couleurPiece("terracotta"),
    opacity: 0.16,
    transform: "rotate(-45deg)",
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
  },
  specimenBanner: {
    borderWidth: 1,
    borderColor: couleurPiece("terracotta"),
    backgroundColor: couleurPiece("terracotta-soft"),
    borderRadius: 4,
    padding: S.md,
    marginBottom: S.lg,
  },
  specimenBannerTitle: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: couleurPiece("terracotta-deep"),
    marginBottom: 2,
  },
  specimenBannerText: {
    fontSize: T.xs,
    color: couleurPiece("fg-soft"),
    lineHeight: T.lineNormal,
  },
});

/** Équivalent de `pdfStyles`, pour les pièces non signables. */
export const pdfStylesPieces = { ...stylesPage, ...stylesBlocs };
