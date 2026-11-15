/**
 * Rendu PDF d'un guide fabriqué (G3) — @react-pdf/renderer, charte de la marque.
 * Texte BRUT seulement, aucune image venue du corps, date de création FIXE (rendu reproductible).
 * Chargé À L'APPEL par `fabrique-pdf.ts` (polices et moteur de rendu ne s'importent jamais au build).
 * NE PAS "use client" — rendu serveur exclusif.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
import {
  brandColor,
  QUALIOPI_BRAND_FONTS as F,
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";
import { txt, enBuffer } from "@/features/conformite-rgpd/registre-pdf";
import type { ContenuGuide } from "./fabrique-pdf";

registerQualiopiPdfFonts();

const styles = StyleSheet.create({
  page: {
    paddingTop: S.page,
    paddingHorizontal: S.page,
    paddingBottom: 52,
    fontSize: T.base,
    fontFamily: F.sans,
    color: brandColor("fg"),
    backgroundColor: brandColor("paper"),
  },
  couverture: { marginTop: 160 },
  titreCouverture: {
    fontFamily: F.serif,
    fontSize: T.display,
    color: brandColor("mocha"),
    marginBottom: S.xl,
  },
  marque: { fontSize: T.sm, color: brandColor("sage") },
  titreSection: {
    fontFamily: F.serif,
    fontSize: T.lg,
    color: brandColor("mocha"),
    marginTop: S.xl,
    marginBottom: S.md,
  },
  paragraphe: { fontSize: T.base, lineHeight: T.lineRelaxed, marginBottom: S.md },
  puce: { flexDirection: "row", marginBottom: S.sm, paddingLeft: S.lg },
  puceSigne: { width: 12 },
  puceTexte: { flex: 1, lineHeight: T.lineNormal },
  pied: {
    position: "absolute",
    bottom: 24,
    left: S.page,
    right: S.page,
    fontSize: T.xs,
    color: brandColor("sage"),
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const DATE_FIXE = new Date("2026-01-01T00:00:00Z");

export function GuidePdf({ contenu }: { contenu: ContenuGuide }) {
  return (
    <Document
      title={txt(contenu.titre)}
      author={IDENTITE_LEGALE.legalName}
      creator={IDENTITE_LEGALE.legalName}
      producer={IDENTITE_LEGALE.legalName}
      creationDate={DATE_FIXE}
      modificationDate={DATE_FIXE}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.couverture}>
          <Text style={styles.titreCouverture}>{txt(contenu.titre)}</Text>
          <Text style={styles.marque}>{txt(IDENTITE_LEGALE.legalName)}</Text>
        </View>
      </Page>
      <Page size="A4" style={styles.page}>
        {contenu.sections.map((s, i) => (
          <View key={i}>
            <Text style={styles.titreSection}>{txt(s.titre)}</Text>
            {s.paragraphes.map((p, j) => (
              <Text key={j} style={styles.paragraphe}>
                {txt(p)}
              </Text>
            ))}
            {s.puces.map((p, j) => (
              <View key={`p${j}`} style={styles.puce} wrap={false}>
                <Text style={styles.puceSigne}>•</Text>
                <Text style={styles.puceTexte}>{txt(p)}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={styles.pied} fixed>
          <Text>{txt(`${IDENTITE_LEGALE.legalName} — ${contenu.titre}`)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function rendreGuidePdf(contenu: ContenuGuide): Promise<Buffer> {
  return enBuffer(<GuidePdf contenu={contenu} />);
}
