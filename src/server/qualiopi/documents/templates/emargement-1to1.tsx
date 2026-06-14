/**
 * Qualiopi — Feuille d'émargement 1-to-1 / AFEST (preuve de présence par séance).
 *
 * Analogue de l'émargement collectif mais pour 1 bénéficiaire : tableau des
 * séances (date, durée, présence) avec colonnes de signature (bénéficiaire,
 * formateur, tuteur entreprise) — matérialise la réalité de l'alternance AFEST.
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
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

const styles = StyleSheet.create({
  table: { marginTop: 6 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandColor("sand"),
    paddingVertical: 4,
  },
  headRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border-strong"),
    paddingVertical: 4,
  },
  cDate: { width: 90, fontSize: 9 },
  cDuree: { width: 60, fontSize: 9 },
  cPres: { width: 60, fontSize: 9 },
  cSig: { flex: 1, fontSize: 8, color: brandColor("fg-muted") },
  head: { fontSize: 9, fontWeight: "bold", color: brandColor("fg-soft") },
  total: { marginTop: 8, fontSize: 10, fontWeight: "bold" },
});

export interface EmargementSeance1to1 {
  date: string;
  dureeLabel: string;
  present: boolean;
  beneficiaireSigne: boolean;
  formateurSigne: boolean;
  tuteurSigne: boolean;
}

export interface Emargement1to1Data {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  intitule: string;
  beneficiaire: { nom: string; prenom: string; entreprise?: string };
  formateur: string;
  tuteur?: string;
  seances: EmargementSeance1to1[];
  totalHeures: string;
  estCopie?: boolean;
}

function sig(ok: boolean): string {
  return ok ? "signé" : "—";
}

export function Emargement1to1Pdf({ data }: { data: Emargement1to1Data }): React.ReactElement {
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();
  return (
    <Document>
      <QualiopiPage
        docTitle="Feuille d'émargement — AFEST 1-to-1"
        docNumber={`N° ${data.numero}`}
        identite={data.identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        <DocSection title="Parcours">
          <FieldRow label="Intitulé" value={data.intitule} />
          <FieldRow
            label="Bénéficiaire"
            value={
              data.beneficiaire.entreprise
                ? `${prenomNom} (${data.beneficiaire.entreprise})`
                : prenomNom
            }
          />
          <FieldRow label="Formateur AFEST" value={data.formateur} />
          {data.tuteur ? <FieldRow label="Tuteur entreprise" value={data.tuteur} /> : null}
        </DocSection>

        <DocSection title="Présence par séance">
          <View style={styles.table}>
            <View style={styles.headRow}>
              <Text style={[styles.cDate, styles.head]}>Date</Text>
              <Text style={[styles.cDuree, styles.head]}>Durée</Text>
              <Text style={[styles.cPres, styles.head]}>Présent</Text>
              <Text style={[styles.cSig, styles.head]}>Bénéf.</Text>
              <Text style={[styles.cSig, styles.head]}>Formateur</Text>
              <Text style={[styles.cSig, styles.head]}>Tuteur</Text>
            </View>
            {data.seances.map((s, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cDate}>{s.date}</Text>
                <Text style={styles.cDuree}>{s.dureeLabel}</Text>
                <Text style={styles.cPres}>{s.present ? "Oui" : "Non"}</Text>
                <Text style={styles.cSig}>{sig(s.beneficiaireSigne)}</Text>
                <Text style={styles.cSig}>{sig(s.formateurSigne)}</Text>
                <Text style={styles.cSig}>{sig(s.tuteurSigne)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.total}>{`Total heures réalisées : ${data.totalHeures} h`}</Text>
        </DocSection>

        <DocSection title="Attestation de présence">
          <Text style={pdfStyles.paragraph}>
            {`Le formateur atteste la réalité des séances ci-dessus et des mises en situation de travail correspondantes.`}
          </Text>
          <View style={pdfStyles.signatureZone}>
            <View style={pdfStyles.signatureBox}>
              <Text style={pdfStyles.paragraph}>{`Fait le ${data.dateEmission}`}</Text>
              <Text style={pdfStyles.paragraph}>{`Le formateur : ${data.formateur}`}</Text>
            </View>
            <View style={pdfStyles.signatureBox}>
              <Text style={pdfStyles.paragraph}>Cachet de l'organisme</Text>
            </View>
          </View>
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
