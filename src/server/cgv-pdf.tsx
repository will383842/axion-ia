/**
 * Les conditions générales de vente en PDF, à partir du texte publié sur le site
 * (`getLegal("conditions-generales").fr`) : une seule source, jamais de copie.
 *
 * Polices standard du PDF (Helvetica), comme le contrat d'apporteur : aucune dépendance à
 * un fichier de police ni à la base. Rendu serveur exclusif, aucun JavaScript navigateur.
 *
 * ⚠️ N'inclut PAS la section « Déclaration d'activité » que la page publique lit au runtime
 * dans la base : le PDF doit se générer partout, y compris au build (base factice).
 */

import "server-only";

import React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import { CGV_VERSION, CGV_VERSION_LIBELLE } from "@/content/cgv-version";
import { getLegal } from "@/content/legal";

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "black",
  },
  titre: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  version: { fontSize: 9, color: "dimgray", marginBottom: 14 },
  intro: { marginBottom: 10 },
  h2: { fontSize: 11.5, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 },
  p: { marginBottom: 5 },
  pied: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "dimgray",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

/** Helvetica (WinAnsi) n'a pas les espaces fines : on les ramène à l'espace insécable. */
function nettoyer(texte: string): string {
  return texte.replace(/[   ]/g, " ");
}

function paragraphes(texte: string): string[] {
  return nettoyer(texte)
    .split(/\n{1,}/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

let enMemoire: { version: string; pdf: Promise<Buffer> } | null = null;

/** Le texte ne change qu'au déploiement : un seul rendu par version et par processus. */
export function rendreCgvPdf(): Promise<Buffer> {
  if (enMemoire === null || enMemoire.version !== CGV_VERSION) {
    const pdf = produireCgvPdf();
    // Un rendu raté ne doit pas rester en mémoire.
    pdf.catch(() => {
      enMemoire = null;
    });
    enMemoire = { version: CGV_VERSION, pdf };
  }
  return enMemoire.pdf;
}

async function produireCgvPdf(): Promise<Buffer> {
  const fr = getLegal("conditions-generales").fr;
  const doc = (
    <Document title={`${fr.title} ${fr.titleEm ?? ""}`.trim()} author="Axion-IA">
      <Page size="A4" style={s.page} wrap>
        <Text style={s.titre}>{nettoyer(`${fr.title}${fr.titleEm ? ` ${fr.titleEm}` : ""}`)}</Text>
        <Text style={s.version}>{`Version du ${CGV_VERSION_LIBELLE} (${CGV_VERSION})`}</Text>
        {paragraphes(fr.intro).map((l, i) => (
          <Text key={`i${i}`} style={s.intro}>
            {l}
          </Text>
        ))}
        {fr.sections.map((sec, i) => (
          <View key={i}>
            <Text style={s.h2}>{nettoyer(sec.title)}</Text>
            {paragraphes(sec.body).map((l, j) => (
              <Text key={j} style={s.p}>
                {l}
              </Text>
            ))}
          </View>
        ))}
        <View style={s.pied} fixed>
          <Text>{`Conditions générales de vente · Axion-IA · version du ${CGV_VERSION_LIBELLE}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  const flux = await pdf(doc).toBuffer();
  return await new Promise<Buffer>((resolve, reject) => {
    const morceaux: Buffer[] = [];
    flux.on("data", (c: Buffer | Uint8Array) =>
      morceaux.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    );
    flux.on("end", () => resolve(Buffer.concat(morceaux)));
    flux.on("error", reject);
  });
}
