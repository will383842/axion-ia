/**
 * Rendu PDF d'un guide fabriqué (G3) — @react-pdf/renderer, charte de la marque.
 * Texte BRUT seulement, aucune image venue du corps, date de création FIXE (rendu reproductible).
 * Chargé À L'APPEL par `fabrique-pdf.ts` (polices et moteur de rendu ne s'importent jamais au build).
 * NE PAS "use client" — rendu serveur exclusif.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
// Plomberie PDF (charte, polices, nettoyage d'espaces) empruntée à `registre-pdf` : AUCUN import direct du domaine
// Qualiopi ici (garde `qualiopi:isolation-check`). Polices enregistrées à l'import de `registre-pdf`.
import { styles as base, txt, enBuffer } from "@/features/conformite-rgpd/registre-pdf";
import type { ContenuGuide } from "./fabrique-pdf";

const styles = StyleSheet.create({
  couverture: { marginTop: 160 },
  titreCouverture: { fontSize: 24, marginBottom: 12 },
  titreSection: { marginTop: 12, marginBottom: 6 },
  paragraphe: { fontSize: 10, lineHeight: 1.65, marginBottom: 6 },
  puce: { flexDirection: "row", marginBottom: 4, paddingLeft: 8 },
  puceSigne: { width: 12 },
  puceTexte: { flex: 1, lineHeight: 1.5 },
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
      <Page size="A4" style={base.page}>
        <View style={styles.couverture}>
          <Text style={[base.titre, styles.titreCouverture]}>{txt(contenu.titre)}</Text>
          <Text style={base.entite}>{txt(IDENTITE_LEGALE.legalName)}</Text>
        </View>
      </Page>
      <Page size="A4" style={base.page}>
        {contenu.sections.map((s, i) => (
          <View key={i}>
            <Text style={[base.nom, styles.titreSection]}>{txt(s.titre)}</Text>
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
        <View style={base.pied} fixed>
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
