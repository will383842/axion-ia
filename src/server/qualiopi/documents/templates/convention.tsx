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
  NdaFieldRow,
  SignatureZone,
  pdfStyles,
  assainirEspacesPdf,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface ConventionData {
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
  /**
   * Preuves de signature RÉELLEMENT apposées, par partie.
   *
   * 🔴 ABSENTES = cadres vides à remplir au stylo, comportement historique
   * INCHANGÉ. Le circuit papier reste un chemin de plein droit.
   *
   * Renseignées, `SignatureZone` rend le tracé, l'horodatage et l'empreinte.
   * Sans ce branchement, la preuve n'existait QU'en base : le signataire signait
   * et la pièce qu'on lui remettait affichait encore des cadres vides.
   */
  signatures?: PreuvesParPartie;
}

// ============================================================
// Styles locaux
// ============================================================

const local = StyleSheet.create({
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

export function ConventionPdf({
  data,
  identite,
}: {
  data: ConventionData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  // 🔴 Réconciliation des sources de l'acompte, 2026-07-27.
  //
  // L'absence de plafond ici est VOULUE, et c'est la différence de fond avec
  // `contrat-formation.tsx` : le plafond de 30 % de l'article L.6353-6 protège
  // une PERSONNE PHYSIQUE qui finance sa propre formation. Une convention
  // (L.6353-1) lie l'organisme à une personne morale ou à un financeur — aucun
  // plafond légal ne s'y applique, l'acompte y est purement contractuel.
  //
  // Ne PAS « harmoniser » en plafonnant ici : ce serait s'interdire une clause
  // parfaitement licite entre professionnels, et brouiller la raison d'être du
  // plafond là où il compte vraiment.
  //
  // Le pourcentage par défaut de 30 % est un usage commercial, pas une règle de
  // droit — sa coïncidence avec le plafond B2C est fortuite, et c'est
  // précisément ce qui rend les deux documents faciles à confondre.
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
          <NdaFieldRow nda={identite.nda} />
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
          {/*
            🔴 F51 — le report gratuit était promis par les CGV et absent de la
            convention, alors que les deux sont signées ensemble. Les CGV ont été
            alignées sur ce barème (jours ouvrés) ; la promesse de report, elle,
            devait remonter ici pour que les deux textes disent la même chose.
          */}
          <Text style={local.listItem}>
            • Dans tous les cas, la prestation est reportable une fois sans frais à une date
            convenue entre les parties, le report se substituant alors à l&apos;annulation.
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
          <SignatureZone
            intro="La présente convention est établie en deux exemplaires originaux, un pour chaque partie."
            faitLe={`_________________________, le ${data.dateConvention}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                signature: data.signatures?.axionia ?? null,
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              {
                titre: "Pour le client",
                signature: data.signatures?.client ?? null,
                nom: data.client.raisonSociale,
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
