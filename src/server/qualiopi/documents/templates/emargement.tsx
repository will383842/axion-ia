/**
 * Qualiopi — Template PDF : Feuille d'émargement présentiel.
 *
 * Tableau participants : Nom-Prénom / Entreprise / Signature matin /
 * Signature après-midi / Paraphe formateur / Observations.
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
  DataTable,
  SignatureZone,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles locaux
// ============================================================

const localStyles = StyleSheet.create({
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
          <FieldRow label="NDA organisme" value={data.nda || identite.nda} required />
        </DocSection>

        {/* Tableau émargement */}
        <DocSection title="Émargement des participants">
          <DataTable
            columns={[
              { key: "nom", header: "Nom — Prénom", flex: 2 },
              { key: "entreprise", header: "Entreprise", flex: 2 },
              { key: "matin", header: "Signature matin", flex: 2 },
              { key: "apresMidi", header: "Signature après-midi", flex: 2 },
              { key: "paraphe", header: "Paraphe formateur", flex: 1 },
              { key: "observations", header: "Observations", flex: 2 },
            ]}
            rows={data.participants.map((p) => ({
              nom: p.nom,
              entreprise: p.entreprise ?? "",
              matin: "",
              apresMidi: "",
              paraphe: "",
              observations: "",
            }))}
            emptyRows={lignesVides}
            minRowHeight={32}
          />
        </DocSection>

        {/* Certification des présences */}
        <View>
          <Text style={localStyles.certificationText}>
            Je certifie l'exactitude des présences enregistrées sur ce document.
          </Text>
        </View>

        {/* Zone de signatures */}
        <SignatureZone
          parties={[
            {
              titre: "Signature du formateur / de la formatrice",
              nom: `Nom : ${data.nomFormateur}`,
              mention: "Date :",
            },
            {
              titre: "Visa du responsable pédagogique",
              nom: "Nom :",
              mention: "Date :",
            },
          ]}
        />

        {/* Mention conservation */}
        <Text style={pdfStyles.legalNote}>
          Document à conserver {DOCUMENT_RETENTION_YEARS} ans — Article L.6353-9 du Code du travail.
        </Text>
      </QualiopiPage>
    </Document>
  );
}
