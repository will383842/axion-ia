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
  DataTable,
  SignatureZone,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles locaux
// ============================================================

const localStyles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: brandColor("sand"),
    borderRadius: 2,
  },
  summaryText: {
    fontSize: 9,
    fontWeight: "bold",
    flex: 1,
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
  /**
   * Preuves de signature RÉELLEMENT apposées, par partie.
   *
   * 🔴 ABSENTES = cadres vides à remplir au stylo, comportement historique
   * INCHANGÉ. Le circuit papier reste un chemin de plein droit.
   *
   * Sans ce branchement, la preuve n'existait QU'en base : le signataire signait
   * et la pièce qu'on lui remettait affichait encore des cadres vides.
   */
  signatures?: PreuvesParPartie;
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
          <DataTable
            columns={[
              { key: "nom", header: "Nom — Prénom", flex: 3 },
              { key: "connexion", header: "Connexion", flex: 2 },
              { key: "deconnexion", header: "Déconnexion", flex: 2 },
              { key: "duree", header: "Durée effective", flex: 2 },
              { key: "validee", header: "Validée", flex: 1 },
            ]}
            rows={data.participants.map((p) => ({
              nom: p.nomPrenom,
              connexion: p.heureConnexion,
              deconnexion: p.heureDeconnexion,
              duree: p.dureeEffective,
              validee: p.presenceValidee ? "Oui" : "Non",
            }))}
          />

          {/* Récapitulatif */}
          <View style={localStyles.summaryRow}>
            <Text style={localStyles.summaryText}>
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
        <SignatureZone
          parties={[
            {
              titre: "Signature du formateur / de la formatrice",
              signature: data.signatures?.formateur ?? null,
              nom: `Nom : ${data.nomFormateur}`,
              mention: "Date :",
            },
            {
              titre: "Visa du responsable pédagogique",
              signature: data.signatures?.responsable_pedagogique ?? null,
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
