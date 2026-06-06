/**
 * Qualiopi — Template PDF : Feuille d'émargement présentiel.
 *
 * Tableau participants : Nom-Prénom / Entreprise / Signature matin /
 * Signature après-midi / Paraphe formateur.
 * Mention de certification + signature formateur + visa responsable pédagogique.
 * Conservation obligatoire 5 ans (DOCUMENT_RETENTION_YEARS).
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
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles locaux
// ============================================================

const localStyles = StyleSheet.create({
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: brandColor("sand"),
    borderBottomWidth: 2,
    borderBottomColor: brandColor("border-strong"),
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableDataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cellNom: { flex: 2, fontSize: 9, paddingRight: 4 },
  cellEntreprise: { flex: 2, fontSize: 9, paddingRight: 4 },
  cellSignature: { flex: 2, fontSize: 9, paddingRight: 4 },
  cellParaphe: { flex: 1, fontSize: 9 },
  certificationText: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginTop: 16,
    marginBottom: 8,
  },
});

// ============================================================
// Types
// ============================================================

export interface EmargementParticipant {
  nom: string;
  entreprise?: string;
}

export interface EmargementData {
  numero: string;
  estCopie?: boolean;
  intituleFormation: string;
  date: string; /** Ex: "2026-06-10 (mardi)" */
  horaires: string; /** Heure de Paris, ex: "09h00–17h00" */
  lieu: string;
  nomFormateur: string;
  nda: string;
  participants: EmargementParticipant[];
  /** Nombre de lignes vides à ajouter après les participants (défaut 3). */
  lignesVides?: number;
}

// ============================================================
// Composant
// ============================================================

export function EmargementPdf({
  data,
  identite,
}: {
  data: EmargementData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const lignesVides = data.lignesVides ?? 3;

  // Participants réels + lignes vides
  const allRows: Array<{ nom: string; entreprise: string; vide: boolean }> = [
    ...data.participants.map((p) => ({
      nom: p.nom,
      entreprise: p.entreprise ?? "",
      vide: false,
    })),
    ...Array.from({ length: lignesVides }, () => ({ nom: "", entreprise: "", vide: true })),
  ];

  return (
    <Document>
      <QualiopiPage
        docTitle="Feuille d'émargement — Présentiel"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie !== undefined ? { estCopie: data.estCopie } : {})}
      >
        {/* En-tête de session */}
        <DocSection title="Informations de la session">
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date" value={data.date} />
          <FieldRow label="Horaires" value={`${data.horaires} (heure de Paris)`} />
          <FieldRow label="Lieu" value={data.lieu} />
          <FieldRow label="Formateur / Formatrice" value={data.nomFormateur} />
          <FieldRow label="NDA organisme" value={data.nda || identite.nda} />
        </DocSection>

        {/* Tableau émargement */}
        <DocSection title="Émargement des participants">
          {/* En-tête du tableau */}
          <View style={localStyles.tableHeaderRow}>
            <Text style={[localStyles.cellNom, { fontWeight: "bold" }]}>Nom — Prénom</Text>
            <Text style={[localStyles.cellEntreprise, { fontWeight: "bold" }]}>Entreprise</Text>
            <Text style={[localStyles.cellSignature, { fontWeight: "bold" }]}>Signature matin</Text>
            <Text style={[localStyles.cellSignature, { fontWeight: "bold" }]}>
              Signature après-midi
            </Text>
            <Text style={[localStyles.cellParaphe, { fontWeight: "bold" }]}>Paraphe formateur</Text>
          </View>

          {/* Lignes participants */}
          {allRows.map((row, idx) => (
            <View key={idx} style={localStyles.tableDataRow}>
              <Text style={localStyles.cellNom}>{row.nom}</Text>
              <Text style={localStyles.cellEntreprise}>{row.entreprise}</Text>
              <Text style={localStyles.cellSignature}></Text>
              <Text style={localStyles.cellSignature}></Text>
              <Text style={localStyles.cellParaphe}></Text>
            </View>
          ))}
        </DocSection>

        {/* Certification des présences */}
        <View>
          <Text style={localStyles.certificationText}>
            Je certifie l'exactitude des présences enregistrées sur ce document.
          </Text>
        </View>

        {/* Zone de signatures */}
        <View style={pdfStyles.signatureZone}>
          <View style={pdfStyles.signatureBox}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
              Signature du formateur / de la formatrice
            </Text>
            <Text style={{ fontSize: 8, color: brandColor("fg-soft") }}>
              Nom : {data.nomFormateur}
            </Text>
            <Text style={{ fontSize: 8, color: brandColor("fg-soft"), marginTop: 4 }}>Date :</Text>
          </View>
          <View style={pdfStyles.signatureBox}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
              Visa du responsable pédagogique
            </Text>
            <Text style={{ fontSize: 8, color: brandColor("fg-soft") }}>Nom :</Text>
            <Text style={{ fontSize: 8, color: brandColor("fg-soft"), marginTop: 4 }}>Date :</Text>
          </View>
        </View>

        {/* Mention conservation */}
        <Text style={pdfStyles.legalNote}>
          Document à conserver {DOCUMENT_RETENTION_YEARS} ans — Article L.6353-9 du Code du travail.
        </Text>
      </QualiopiPage>
    </Document>
  );
}
