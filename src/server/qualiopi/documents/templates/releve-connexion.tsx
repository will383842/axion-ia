/**
 * Qualiopi — Template PDF : Relevé de connexion (distanciel).
 *
 * Remplace la feuille d'émargement pour les formations à distance.
 * Tableau : Nom-Prénom / Heure connexion / Heure déconnexion /
 * Durée effective / Présence validée.
 * Durée minimale requise configurable (ex : 80 %).
 * Source : export Zoom/Teams.
 * Signature formateur + visa responsable pédagogique.
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
    minHeight: 26,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cellNom: { flex: 3, fontSize: 9, paddingRight: 4 },
  cellHeure: { flex: 2, fontSize: 9, paddingRight: 4 },
  cellDuree: { flex: 2, fontSize: 9, paddingRight: 4 },
  cellPresence: { flex: 1, fontSize: 9 },
  summaryRow: {
    flexDirection: "row",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: brandColor("sand"),
    borderRadius: 2,
  },
});

// ============================================================
// Types
// ============================================================

export interface ReleveConnexionParticipant {
  nomPrenom: string;
  heureConnexion: string; /** Ex: "09h02" */
  heureDeconnexion: string; /** Ex: "17h05" */
  dureeEffective: string; /** Ex: "7h03" */
  presenceValidee: boolean;
}

export interface ReleveConnexionData {
  numero: string;
  estCopie?: boolean;
  intituleFormation: string;
  plateforme: string; /** Ex: "Zoom", "Microsoft Teams", "Google Meet" */
  idReunion: string;
  date: string;
  horairesSession: string; /** Heure de Paris */
  nomFormateur: string;
  /** Durée minimale requise pour valider la présence, en pourcentage (ex: 80). */
  dureeMinimaleRequisePercent: number;
  participants: ReleveConnexionParticipant[];
}

// ============================================================
// Composant
// ============================================================

export function ReleveConnexionPdf({
  data,
  identite,
}: {
  data: ReleveConnexionData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const conformes = data.participants.filter((p) => p.presenceValidee).length;
  const total = data.participants.length;

  return (
    <Document>
      <QualiopiPage
        docTitle="Relevé de connexion — Distanciel"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie !== undefined ? { estCopie: data.estCopie } : {})}
      >
        {/* Mention légale haut de page */}
        <View style={{ marginBottom: 10 }}>
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Ce document remplace la feuille d'émargement pour les formations dispensées à distance.
          </Text>
        </View>

        {/* En-tête session */}
        <DocSection title="Informations de la session">
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date" value={data.date} />
          <FieldRow label="Horaires" value={`${data.horairesSession} (heure de Paris)`} />
          <FieldRow label="Plateforme" value={data.plateforme} />
          <FieldRow label="ID de réunion" value={data.idReunion} />
          <FieldRow label="Formateur / Formatrice" value={data.nomFormateur} />
          <FieldRow
            label="Durée minimale requise"
            value={`${data.dureeMinimaleRequisePercent} % de la durée de la session`}
          />
        </DocSection>

        {/* Tableau connexions */}
        <DocSection title="Relevé des connexions">
          {/* En-tête tableau */}
          <View style={localStyles.tableHeaderRow}>
            <Text style={[localStyles.cellNom, { fontWeight: "bold" }]}>Nom — Prénom</Text>
            <Text style={[localStyles.cellHeure, { fontWeight: "bold" }]}>Connexion</Text>
            <Text style={[localStyles.cellHeure, { fontWeight: "bold" }]}>Déconnexion</Text>
            <Text style={[localStyles.cellDuree, { fontWeight: "bold" }]}>Durée effective</Text>
            <Text style={[localStyles.cellPresence, { fontWeight: "bold" }]}>Validée</Text>
          </View>

          {/* Lignes participants */}
          {data.participants.map((p, idx) => (
            <View key={idx} style={localStyles.tableDataRow}>
              <Text style={localStyles.cellNom}>{p.nomPrenom}</Text>
              <Text style={localStyles.cellHeure}>{p.heureConnexion}</Text>
              <Text style={localStyles.cellHeure}>{p.heureDeconnexion}</Text>
              <Text style={localStyles.cellDuree}>{p.dureeEffective}</Text>
              <Text style={localStyles.cellPresence}>{p.presenceValidee ? "Oui" : "Non"}</Text>
            </View>
          ))}

          {/* Récapitulatif */}
          <View style={localStyles.summaryRow}>
            <Text style={{ fontSize: 9, fontWeight: "bold", flex: 1 }}>
              Stagiaires conformes : {conformes} / {total}
            </Text>
          </View>
        </DocSection>

        {/* Source des données */}
        <View style={{ marginBottom: 8 }}>
          <Text style={pdfStyles.legalNote}>
            Source : export automatique {data.plateforme} — données horodatées en UTC converties en
            heure de Paris (Europe/Paris).
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
