/**
 * Conformité RGPD — le registre des activités de traitement (art. 30), en PDF.
 *
 * ⛔ Les ÉCARTS n'y entrent pas, jamais : le registre est la pièce que l'on montre
 * (à la CNIL, à un client) ; les points à corriger sont un document de travail
 * interne. Le gabarit ne reçoit donc que les champs de l'article 30 — garde :
 * `__tests__/registre-pdf.spec.tsx`.
 *
 * Même charte et mêmes polices que les autres PDF de la console ; même nettoyage
 * des espaces fines (`assainirEspacesPdf`, importé et non recopié).
 *
 * NE PAS "use client" — rendu serveur exclusif.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

import { IDENTITE_LEGALE, adresseSiegeUneLigne } from "@/lib/identite-legale-ssot";
import {
  brandColor,
  QUALIOPI_BRAND_FONTS as F,
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";
import { assainirEspacesPdf } from "@/server/qualiopi/documents/base-layout";

import type { Registre, Traitement } from "./schema";

registerQualiopiPdfFonts();

/** Une activité telle que le PDF la reçoit : tout l'article 30, AUCUN écart. */
export type ActivitePdf = Omit<Traitement, "ecarts">;

export function activitesPourPdf(registre: Registre): ActivitePdf[] {
  return registre.traitements.map(({ ecarts: _ecarts, ...reste }) => reste);
}

const NON_IMPRIMABLES =
  /[\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}\u{200D}]/gu;

function txt(v: string | null | undefined): string {
  const s = assainirEspacesPdf(v ?? "").replace(NON_IMPRIMABLES, "");
  return s.trim() === "" ? "—" : s;
}

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
  entite: { fontSize: T.sm, color: brandColor("mocha"), lineHeight: T.lineNormal },
  titre: {
    fontFamily: F.serif,
    fontSize: T.xl,
    color: brandColor("mocha"),
    marginTop: S.xl,
    marginBottom: S.sm,
  },
  date: { fontSize: T.sm, color: brandColor("sage"), marginBottom: S.xxl },
  activite: {
    borderTopWidth: 1,
    borderTopColor: brandColor("border"),
    paddingTop: S.lg,
    marginBottom: S.xl,
  },
  nom: { fontFamily: F.serif, fontSize: T.lg, color: brandColor("mocha"), marginBottom: S.md },
  ligne: { flexDirection: "row", marginBottom: S.sm },
  libelle: { width: 150, fontSize: T.sm, color: brandColor("sage"), lineHeight: T.lineNormal },
  valeur: { flex: 1, fontSize: T.sm, lineHeight: T.lineNormal },
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

function Ligne({ libelle, valeur }: { libelle: string; valeur: string | null }) {
  return (
    <View style={styles.ligne} wrap={false}>
      <Text style={styles.libelle}>{libelle}</Text>
      <Text style={styles.valeur}>{txt(valeur)}</Text>
    </View>
  );
}

function destinataires(a: ActivitePdf): string {
  return a.destinataires
    .map((d) => {
      const lieu = [d.pays, d.horsUE === true ? "hors UE" : null].filter(Boolean).join(", ");
      return lieu ? `${d.nom} (${lieu})` : d.nom;
    })
    .join(" ; ");
}

export function RegistrePdf({
  activites,
  genereLe,
}: {
  activites: ReadonlyArray<ActivitePdf>;
  genereLe: Date;
}) {
  const date = genereLe.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  return (
    <Document title="Registre des activités de traitement" author={IDENTITE_LEGALE.legalName}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.entite}>{txt(IDENTITE_LEGALE.legalName)}</Text>
        <Text style={styles.entite}>{txt(adresseSiegeUneLigne())}</Text>
        <Text style={styles.entite}>SIREN {IDENTITE_LEGALE.siren}</Text>
        <Text style={styles.titre}>Registre des activités de traitement</Text>
        <Text style={styles.date}>
          {txt(`Article 30 du RGPD — état au ${date} — ${activites.length} activité(s)`)}
        </Text>
        {activites.map((a) => (
          <View key={a.id} style={styles.activite}>
            <Text style={styles.nom}>{txt(a.nom)}</Text>
            <Ligne libelle="Finalité" valeur={a.finalite} />
            <Ligne libelle="Base légale" valeur={a.baseLegale} />
            <Ligne libelle="Personnes concernées" valeur={a.personnes.join(", ")} />
            <Ligne libelle="Données" valeur={a.donnees.join(", ")} />
            <Ligne libelle="Destinataires" valeur={destinataires(a)} />
            <Ligne libelle="Durée de conservation" valeur={a.conservationAnnoncee} />
            <Ligne libelle="Mesures de sécurité" valeur={a.securite} />
            <Ligne libelle="Exercice des droits" valeur={a.droits} />
          </View>
        ))}
        <View style={styles.pied} fixed>
          <Text>{txt(`${IDENTITE_LEGALE.legalName} — registre au ${date}`)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function rendreRegistreEnPdf(registre: Registre, genereLe: Date): Promise<Buffer> {
  const stream = await pdf(
    <RegistrePdf activites={activitesPourPdf(registre)} genereLe={genereLe} />,
  ).toBuffer();
  return new Promise<Buffer>((resolve, reject) => {
    const morceaux: Buffer[] = [];
    stream.on("data", (m: Buffer | Uint8Array) =>
      morceaux.push(Buffer.isBuffer(m) ? m : Buffer.from(m)),
    );
    stream.on("end", () => resolve(Buffer.concat(morceaux)));
    stream.on("error", reject);
  });
}
