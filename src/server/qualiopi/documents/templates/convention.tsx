/**
 * Qualiopi — Convention de formation professionnelle (personnes morales).
 *
 * Conforme L.6353-1 et L.6353-2 du Code du travail.
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
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface ConventionData {
  numero: string;
  estCopie?: boolean;
  // Partie cliente
  client: {
    raisonSociale: string;
    siret: string;
    adresse: string;
    contact: string;
  };
  // Objet de la formation
  intitule: string;
  objectifs: string[];
  publicVise: string;
  dureeHeures: number;
  dateDebut: string;
  dateFin: string;
  modalite: "Présentiel" | "Distanciel" | "Mixte";
  lieu: string;
  effectif: number;
  // Conditions financières
  prixHt: number;
  acomptePercent?: number;
  // Dates convention
  dateConvention: string;
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
  annexeList: {
    marginTop: 4,
  },
  annexeItem: {
    fontSize: 9,
    marginBottom: 2,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 10,
    marginBottom: 2,
    paddingLeft: 8,
  },
  amountRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: pdfStyles.fieldRow.borderBottomColor,
  },
  amountLabel: {
    fontSize: 10,
  },
  amountValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
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

export function ConventionPdf({
  data,
  identite,
}: {
  data: ConventionData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const acomptePercent = data.acomptePercent ?? 30;
  const acompte = (data.prixHt * acomptePercent) / 100;
  const solde = data.prixHt - acompte;

  return (
    <Document>
      <QualiopiPage
        docTitle="Convention de formation professionnelle"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
      >
        {/* Mention légale de tête */}
        <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.convention}</Text>

        {/* 1. Parties */}
        <DocSection title="1. Parties">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Organisme de formation (prestataire)
          </Text>
          <FieldRow label="Raison sociale" value={identite.raisonSociale || "Axion-IA SAS"} />
          <FieldRow label="SIRET" value={identite.siret || "—"} />
          <FieldRow label="NDA" value={identite.nda || "—"} />
          <FieldRow label="Certification Qualiopi" value={identite.qualiopi || "—"} />
          <FieldRow label="Siège social" value={identite.adresseSiege || "—"} />
          <FieldRow label="Email" value={identite.email || "—"} />
          <FieldRow label="Téléphone" value={identite.telephone || "—"} />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Client (commanditaire)
          </Text>
          <FieldRow label="Raison sociale" value={data.client.raisonSociale} />
          <FieldRow label="SIRET" value={data.client.siret} />
          <FieldRow label="Adresse" value={data.client.adresse} />
          <FieldRow label="Contact" value={data.client.contact} />
        </DocSection>

        {/* 2. Objet */}
        <DocSection title="2. Objet de la convention">
          <FieldRow label="Intitulé" value={data.intitule} />
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.fieldLabel}>Objectifs</Text>
            <View style={{ flex: 1 }}>
              {data.objectifs.map((obj, i) => (
                <Text key={i} style={local.listItem}>
                  • {obj}
                </Text>
              ))}
            </View>
          </View>
          <FieldRow label="Public visé" value={data.publicVise} />
          <FieldRow label="Durée" value={`${data.dureeHeures} heure(s)`} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
          <FieldRow label="Modalité" value={data.modalite} />
          <FieldRow label="Lieu" value={data.lieu} />
          <FieldRow label="Effectif prévu" value={`${data.effectif} stagiaire(s)`} />
        </DocSection>

        {/* 3. Conditions financières */}
        <DocSection title="3. Conditions financières">
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Prix total HT</Text>
            <Text style={local.amountValue}>{formatEur(data.prixHt)}</Text>
          </View>
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Acompte à la signature ({acomptePercent} %)</Text>
            <Text style={local.amountValue}>{formatEur(acompte)}</Text>
          </View>
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Solde à la fin de la formation</Text>
            <Text style={local.amountValue}>{formatEur(solde)}</Text>
          </View>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.factureExonerationTva}</Text>
        </DocSection>

        {/* 4. Conditions d'annulation */}
        <DocSection title="4. Conditions d'annulation">
          <Text style={pdfStyles.paragraph}>
            En cas de désistement du client, les frais d'annulation suivants s'appliquent :
          </Text>
          <Text style={local.listItem}>
            • Annulation à plus de 15 jours ouvrés avant le début : 0 %
          </Text>
          <Text style={local.listItem}>
            • Annulation entre 8 et 15 jours ouvrés avant le début : 50 % du prix HT
          </Text>
          <Text style={local.listItem}>
            • Annulation à moins de 8 jours ouvrés avant le début : 100 % du prix HT
          </Text>
        </DocSection>

        {/* 5. Annexes */}
        <DocSection title="5. Documents annexés">
          <View style={local.annexeList}>
            <Text style={local.annexeItem}>– Programme détaillé de la formation</Text>
            <Text style={local.annexeItem}>– Règlement intérieur des stagiaires</Text>
            <Text style={local.annexeItem}>– Conditions générales de vente (CGV)</Text>
          </View>
        </DocSection>

        {/* 6. Signatures */}
        <DocSection title="6. Signatures">
          <Text style={local.signatureLu}>
            La présente convention est établie en deux exemplaires originaux, un pour chaque partie.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Fait à _________________________, le {data.dateConvention}
          </Text>
          <View style={pdfStyles.signatureZone}>
            <View style={pdfStyles.signatureBox}>
              <Text style={local.signatureLabel}>Pour l'organisme de formation</Text>
              <Text style={local.signatureLu}>Lu et approuvé</Text>
              <Text style={pdfStyles.paragraph}>{identite.raisonSociale || "Axion-IA SAS"}</Text>
              <Text style={pdfStyles.legalNote}>Nom, qualité, signature et cachet</Text>
            </View>
            <View style={pdfStyles.signatureBox}>
              <Text style={local.signatureLabel}>Pour le client</Text>
              <Text style={local.signatureLu}>Lu et approuvé</Text>
              <Text style={pdfStyles.paragraph}>{data.client.raisonSociale}</Text>
              <Text style={pdfStyles.legalNote}>Nom, qualité, signature et cachet</Text>
            </View>
          </View>
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
