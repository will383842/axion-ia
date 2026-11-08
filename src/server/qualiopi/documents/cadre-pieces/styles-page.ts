/**
 * Cadre RECOPIÉ NON signable (styles de page) — copie de `pdfStyles` de base-layout.tsx
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

export const stylesPage = StyleSheet.create({
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
