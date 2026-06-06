/**
 * Qualiopi — Lettre de mission formateur sous-traitant.
 *
 * Définit le périmètre de mission, les formations confiées, le tarif,
 * les obligations de confidentialité et de conformité Qualiopi.
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface FormationConfiee {
  intitule: string;
  dateDebut: string;
  dateFin: string;
  lieuOuModalite: string;
  dureeHeures: number;
}

export interface LettreMissionData {
  numero: string;
  estCopie?: boolean;
  // Formateur
  formateur: {
    nomPrenom: string;
    siretOuSirenOuNaf?: string;
    adresse: string;
    email: string;
    telephone?: string;
    specialite: string;
  };
  // Mission
  objetMission: string;
  formations: FormationConfiee[];
  tarifJourHt: number;
  // Dates
  dateMission: string;
}

// ============================================================
// Styles locaux
// ============================================================

const local = StyleSheet.create({
  signatureLabel: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 4,
  },
  signatureLu: {
    fontSize: 8,
    fontStyle: "italic",
    marginBottom: 12,
    color: pdfStyles.legalNote.color,
  },
  obligationItem: {
    fontSize: 10,
    marginBottom: 3,
    paddingLeft: 8,
  },
  tableHeaderRow: {
    flexDirection: "row" as const,
    backgroundColor: pdfStyles.fieldRow.borderBottomColor,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableDataRow: {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: pdfStyles.fieldRow.borderBottomColor,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  col40: { flex: 2, fontSize: 9 },
  col20: { flex: 1, fontSize: 9 },
  colHeader: { fontWeight: "bold", fontSize: 8 },
});

// ============================================================
// Helpers
// ============================================================

function formatEur(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(montant);
}

// ============================================================
// Composant
// ============================================================

export function LettreMissionPdf({
  data,
  identite,
}: {
  data: LettreMissionData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Lettre de mission formateur"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
      >
        {/* 1. Parties */}
        <DocSection title="1. Parties">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Organisme de formation (mandant)
          </Text>
          <FieldRow label="Raison sociale" value={identite.raisonSociale || "Axion-IA SAS"} />
          <FieldRow label="SIRET" value={identite.siret || "—"} />
          <FieldRow label="NDA" value={identite.nda || "—"} />
          <FieldRow label="Qualiopi" value={identite.qualiopi || "—"} />
          <FieldRow label="Adresse" value={identite.adresseSiege || "—"} />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Formateur (mandataire sous-traitant)
          </Text>
          <FieldRow label="Nom / Prénom" value={data.formateur.nomPrenom} />
          {data.formateur.siretOuSirenOuNaf ? (
            <FieldRow label="SIRET / SIREN / NAF" value={data.formateur.siretOuSirenOuNaf} />
          ) : null}
          <FieldRow label="Adresse" value={data.formateur.adresse} />
          <FieldRow label="Email" value={data.formateur.email} />
          {data.formateur.telephone ? (
            <FieldRow label="Téléphone" value={data.formateur.telephone} />
          ) : null}
          <FieldRow label="Spécialité" value={data.formateur.specialite} />
        </DocSection>

        {/* 2. Objet et périmètre */}
        <DocSection title="2. Objet et périmètre de la mission">
          <Text style={pdfStyles.paragraph}>{data.objetMission}</Text>
        </DocSection>

        {/* 3. Formations confiées */}
        <DocSection title="3. Formation(s) confiée(s)">
          <View style={local.tableHeaderRow}>
            <Text style={[local.col40, local.colHeader]}>Intitulé</Text>
            <Text style={[local.col20, local.colHeader]}>Du</Text>
            <Text style={[local.col20, local.colHeader]}>Au</Text>
            <Text style={[local.col20, local.colHeader]}>Durée</Text>
            <Text style={[local.col20, local.colHeader]}>Lieu / Modalité</Text>
          </View>
          {data.formations.map((f, i) => (
            <View key={i} style={local.tableDataRow}>
              <Text style={local.col40}>{f.intitule}</Text>
              <Text style={local.col20}>{f.dateDebut}</Text>
              <Text style={local.col20}>{f.dateFin}</Text>
              <Text style={local.col20}>{f.dureeHeures} h</Text>
              <Text style={local.col20}>{f.lieuOuModalite}</Text>
            </View>
          ))}
        </DocSection>

        {/* 4. Tarif */}
        <DocSection title="4. Rémunération">
          <FieldRow label="Tarif journalier HT" value={formatEur(data.tarifJourHt) + " / jour"} />
          <Text style={pdfStyles.legalNote}>
            La facturation s'effectue sur présentation de facture conforme par le formateur, après
            chaque session réalisée. Le tarif est exprimé hors taxes (TVA selon régime applicable au
            formateur).
          </Text>
        </DocSection>

        {/* 5. Obligations */}
        <DocSection title="5. Obligations du formateur">
          <Text style={local.obligationItem}>
            • Respecter les référentiels pédagogiques transmis par l'organisme de formation.
          </Text>
          <Text style={local.obligationItem}>
            • Être titulaire ou en cours d'obtention d'une certification Qualiopi valide (ou sous
            sous-traitance déclarée conformément à l'indicateur 27 du référentiel Qualiopi) et en
            justifier sur demande (indicateur 19).
          </Text>
          <Text style={local.obligationItem}>
            • Maintenir la confidentialité sur tout document, programme, technique ou information
            appris dans le cadre de cette mission (NDA implicite — voir article 6).
          </Text>
          <Text style={local.obligationItem}>
            • Remettre les feuilles d'émargement dûment signées à l'issue de chaque demi-journée.
          </Text>
          <Text style={local.obligationItem}>
            • Informer l'organisme sans délai de toute difficulté pédagogique ou logistique
            susceptible d'affecter la réalisation de la formation.
          </Text>
        </DocSection>

        {/* 6. Confidentialité */}
        <DocSection title="6. Confidentialité">
          <Text style={pdfStyles.paragraph}>
            Le formateur s'engage à ne divulguer à aucun tiers, pendant la durée de la mission et
            pendant cinq (5) ans après son terme, toute information confidentielle relative à
            l'organisme de formation, à ses clients, stagiaires, méthodes pédagogiques, outils ou
            supports, sauf autorisation écrite préalable de l'organisme ou obligation légale.
          </Text>
        </DocSection>

        {/* 7. Signatures */}
        <DocSection title="7. Signatures">
          <Text style={pdfStyles.paragraph}>
            Fait à _________________________, le {data.dateMission}
          </Text>
          <View style={pdfStyles.signatureZone}>
            <View style={pdfStyles.signatureBox}>
              <Text style={local.signatureLabel}>Pour l'organisme de formation</Text>
              <Text style={local.signatureLu}>Lu et approuvé</Text>
              <Text style={pdfStyles.paragraph}>{identite.raisonSociale || "Axion-IA SAS"}</Text>
              <Text style={pdfStyles.legalNote}>Nom, qualité, signature et cachet</Text>
            </View>
            <View style={pdfStyles.signatureBox}>
              <Text style={local.signatureLabel}>Pour le formateur</Text>
              <Text style={local.signatureLu}>Lu et approuvé</Text>
              <Text style={pdfStyles.paragraph}>{data.formateur.nomPrenom}</Text>
              <Text style={pdfStyles.legalNote}>Nom, signature</Text>
            </View>
          </View>
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
