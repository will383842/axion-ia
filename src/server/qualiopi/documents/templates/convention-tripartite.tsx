/**
 * Qualiopi — Convention de formation tripartite (OF + Client + OPCO).
 *
 * Extension de la convention bipartite avec subrogation de paiement OPCO.
 * Conforme L.6353-1 et L.6353-2 du Code du travail.
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  SignatureZone,
  pdfStyles,
  assainirEspacesPdf,
} from "@/server/qualiopi/documents/base-layout";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface ConventionTripartiteData {
  numero: string;
  estCopie?: boolean;
  /** Injecte par `generateDocument` quand l'identite de l'OF est incomplete. */
  estSpecimen?: boolean;
  specimenMotif?: string;
  // Partie cliente
  client: {
    raisonSociale: string;
    siret: string;
    adresse: string;
    contact: string;
  };
  // Partie OPCO
  opco: {
    nom: string;
    numeroPriseEnCharge: string;
    adresse?: string;
    contact?: string;
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
  montantPrisEnCharge: number;
  resteAChargeClient: number;
  // Date convention
  dateConvention: string;
}

// ============================================================
// Styles locaux
// ============================================================

const local = StyleSheet.create({
  subrogationNote: {
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 6,
    marginBottom: 6,
    color: pdfStyles.legalNote.color,
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

// 🔴 Correctif glyphes 2026-07-26. `Intl` fr-FR emet U+202F (fine insecable)
// comme separateur de milliers ; aucune police du projet ne possede ce glyphe,
// @react-pdf bascule sur Helvetica/WinAnsi et ecrit l'octet 0x2F, soit « / ».
// Tout montant >= 1 000 EUR sortait donc « 1/440,00 € ». Detail mesure dans
// `assainirEspacesPdf` (base-layout.tsx). Ce duplicat local echappait au
// correctif du helper partage : il doit assainir lui aussi.
function formatEur(montant: number): string {
  return assainirEspacesPdf(
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(montant),
  );
}

// ============================================================
// Composant
// ============================================================

export function ConventionTripartitePdf({
  data,
  identite,
}: {
  data: ConventionTripartiteData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Convention de formation tripartite"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        {/* Mention légale de tête */}
        <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.convention}</Text>

        {/* 1. Parties */}
        <DocSection title="1. Parties">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Organisme de formation (prestataire)
          </Text>
          <FieldRow label="Raison sociale" value={identite.raisonSociale} required />
          <FieldRow label="SIRET" value={identite.siret} required />
          <FieldRow label="NDA" value={identite.nda} required />
          {/*
            🔴 F29 — la ligne n'apparaît QUE si le numéro existe.
            Marquée `required`, elle imprimait « Non renseigné » dans le style
            des champs manquants sur chaque convention, contrat et certificat —
            c'est-à-dire précisément les pièces qui partent chez le client, chez
            l'OPCO et chez le certificateur. Attirer l'œil en rouge sur une
            absence est pire que l'omettre : un organisme non encore certifié
            n'a simplement pas de numéro Qualiopi à porter, et la ligne n'a
            aucune raison d'exister. Même traitement que la facture et le devis.
          */}
          {identite.qualiopi ? (
            <FieldRow label="Certification Qualiopi" value={identite.qualiopi} />
          ) : null}
          <FieldRow label="Siège social" value={identite.adresseSiege} required />
          <FieldRow label="Email" value={identite.email || "—"} />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Client (employeur / commanditaire)
          </Text>
          <FieldRow label="Raison sociale" value={data.client.raisonSociale} />
          <FieldRow label="SIRET" value={data.client.siret} />
          <FieldRow label="Adresse" value={data.client.adresse} />
          <FieldRow label="Contact" value={data.client.contact} />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            OPCO (organisme financeur)
          </Text>
          <FieldRow label="Nom de l'OPCO" value={data.opco.nom} />
          <FieldRow label="N° de prise en charge" value={data.opco.numeroPriseEnCharge} />
          {data.opco.adresse ? <FieldRow label="Adresse" value={data.opco.adresse} /> : null}
          {data.opco.contact ? <FieldRow label="Contact" value={data.opco.contact} /> : null}

          <Text style={local.subrogationNote}>
            En application de la subrogation de paiement, l'OPCO versera directement sa
            participation à l'organisme de formation. Le solde restant à charge reste dû par le
            client.
          </Text>
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
            <Text style={local.amountLabel}>Prise en charge OPCO ({data.opco.nom})</Text>
            <Text style={local.amountValue}>{formatEur(data.montantPrisEnCharge)}</Text>
          </View>
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Reste à charge client</Text>
            <Text style={local.amountValue}>{formatEur(data.resteAChargeClient)}</Text>
          </View>
          {/*
            🔴 F25 — la mention TVA vient du régime CONFIGURÉ, jamais d'une
            constante. L'exonération 261-4-4° était imprimée en dur alors que
            `regime_tva` vaut « assujetti » : on annonçait une exonération non
            détenue sur une pièce contractuelle et sur les kits financeurs.
            `null` en régime assujetti → aucun bloc, ce qui est correct.
          */}
          {identite.mentionTvaRegime ? (
            <Text style={pdfStyles.legalNote}>{identite.mentionTvaRegime}</Text>
          ) : null}
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
          <Text style={local.annexeItem}>– Programme détaillé de la formation</Text>
          <Text style={local.annexeItem}>– Règlement intérieur des stagiaires</Text>
          <Text style={local.annexeItem}>– Conditions générales de vente (CGV)</Text>
          <Text style={local.annexeItem}>
            – Accord de prise en charge OPCO n° {data.opco.numeroPriseEnCharge}
          </Text>
        </DocSection>

        {/* 6. Signatures — 3 parties */}
        <DocSection title="6. Signatures">
          <SignatureZone
            faitLe={`_________________________, le ${data.dateConvention}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              { titre: "Pour le client", nom: data.client.raisonSociale },
              { titre: "Pour l'OPCO", nom: data.opco.nom },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
