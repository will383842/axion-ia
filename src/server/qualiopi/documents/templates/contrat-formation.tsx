/**
 * Qualiopi — Contrat de formation professionnelle (PARTICULIERS / B2C).
 *
 * Conforme aux articles L.6353-3 à L.6353-7 du Code du travail.
 * Distinct de la convention (personnes morales, L.6353-1/2) : ce contrat est
 * conclu directement avec une personne physique qui finance elle-même sa
 * formation. Mentions obligatoires (L.6353-4), délai de rétractation de 10 jours
 * (L.6353-5), interdiction de paiement avant l'expiration du délai + acompte ≤ 30 %
 * + échelonnement (L.6353-6), résiliation pour force majeure au prorata (L.6353-7).
 *
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

export interface ContratFormationData {
  numero: string;
  estCopie?: boolean;
  // Stagiaire (personne physique signataire et financeur)
  stagiaire: {
    nomPrenom: string;
    adresse?: string;
    email?: string;
    telephone?: string;
  };
  // Objet de la formation (L.6353-4)
  intitule: string;
  objectifs: string[];
  /** Nature de l'action (L.6313-1) — par défaut « action de formation ». */
  natureAction?: string;
  /** Niveau de connaissances préalables requis (L.6353-4). */
  niveauPrealable?: string;
  /** Sanction de la formation (attestation de fin de formation). */
  sanction?: string;
  dureeHeures: number;
  dateDebut: string;
  dateFin: string;
  modalite: "Présentiel" | "Distanciel" | "Mixte";
  lieu: string;
  // Conditions financières (prix net — formation exonérée de TVA)
  prixNet: number;
  /** Pourcentage d'acompte après le délai de rétractation (plafonné à 30 % — L.6353-6). */
  acomptePercent?: number;
  dateContrat: string;
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

export function ContratFormationPdf({
  data,
  identite,
}: {
  data: ContratFormationData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  // L.6353-6 : l'acompte versé à l'expiration du délai de rétractation ne peut
  // excéder 30 % du prix convenu. On plafonne donc à 30 % par sécurité.
  const acomptePercent = Math.min(data.acomptePercent ?? 30, 30);
  const acompte = (data.prixNet * acomptePercent) / 100;
  const solde = data.prixNet - acompte;
  const natureAction =
    data.natureAction ?? "Action de formation (article L.6313-1 du Code du travail)";
  const niveauPrealable = data.niveauPrealable ?? "Aucun prérequis particulier.";
  const sanction =
    data.sanction ??
    "Attestation de fin de formation remise à l'issue de l'action (article L.6353-1).";

  return (
    <Document>
      <QualiopiPage
        docTitle="Contrat de formation professionnelle"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
      >
        {/* Mention légale de tête */}
        <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.contratParticulier}</Text>

        {/* 1. Parties */}
        <DocSection title="1. Entre les soussignés">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            L'organisme de formation (prestataire)
          </Text>
          <FieldRow label="Raison sociale" value={identite.raisonSociale || "Axion-IA SAS"} />
          <FieldRow label="SIRET" value={identite.siret || "—"} />
          <FieldRow label="NDA" value={identite.nda || "—"} />
          <FieldRow label="Certification Qualiopi" value={identite.qualiopi || "—"} />
          <FieldRow label="Siège social" value={identite.adresseSiege || "—"} />
          <FieldRow label="Email" value={identite.email || "—"} />
          <FieldRow label="Téléphone" value={identite.telephone || "—"} />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Le stagiaire (personne physique)
          </Text>
          <FieldRow label="Nom et prénom" value={data.stagiaire.nomPrenom} />
          <FieldRow
            label="Adresse"
            value={data.stagiaire.adresse || "_______________________________"}
          />
          <FieldRow label="Email" value={data.stagiaire.email || "—"} />
          <FieldRow label="Téléphone" value={data.stagiaire.telephone || "—"} />
          <Text style={pdfStyles.legalNote}>
            Le présent contrat est conclu avec une personne physique qui entreprend la formation à
            titre individuel et à ses frais (articles L.6353-3 à L.6353-7 du Code du travail).
          </Text>
        </DocSection>

        {/* 2. Objet et nature de l'action (L.6353-4) */}
        <DocSection title="2. Objet, nature et organisation de l'action">
          <FieldRow label="Intitulé" value={data.intitule} />
          <FieldRow label="Nature de l'action" value={natureAction} />
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
          <FieldRow label="Niveau de connaissances préalables" value={niveauPrealable} />
          <FieldRow label="Durée" value={`${data.dureeHeures} heure(s)`} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
          <FieldRow label="Modalité de déroulement" value={data.modalite} />
          <FieldRow label="Lieu" value={data.lieu} />
          <FieldRow label="Sanction de la formation" value={sanction} />
        </DocSection>

        {/* 3. Prix et modalités de règlement (L.6353-4 / L.6353-6) */}
        <DocSection title="3. Prix et modalités de règlement">
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>Prix total de la formation (net)</Text>
            <Text style={local.amountValue}>{formatEur(data.prixNet)}</Text>
          </View>
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>
              Acompte à l'expiration du délai de rétractation ({acomptePercent} % maximum)
            </Text>
            <Text style={local.amountValue}>{formatEur(acompte)}</Text>
          </View>
          <View style={local.amountRow}>
            <Text style={local.amountLabel}>
              Solde échelonné au fur et à mesure du déroulement de l'action
            </Text>
            <Text style={local.amountValue}>{formatEur(solde)}</Text>
          </View>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.factureExonerationTva}</Text>
          <Text style={pdfStyles.paragraph}>
            Conformément à l'article L.6353-6 du Code du travail, aucune somme ne peut être exigée
            du stagiaire avant l'expiration du délai de rétractation. À l'issue de ce délai, il ne
            peut être versé un acompte supérieur à 30 % du prix convenu ; le solde fait l'objet d'un
            échelonnement des paiements au fur et à mesure du déroulement de la formation.
          </Text>
        </DocSection>

        {/* 4. Délai de rétractation (L.6353-5) */}
        <DocSection title="4. Délai de rétractation">
          <Text style={pdfStyles.paragraph}>
            À compter de la date de signature du présent contrat, le stagiaire dispose d'un délai de{" "}
            <Text style={{ fontWeight: "bold" }}>dix (10) jours</Text> pour se rétracter. Il en
            informe l'organisme de formation par lettre recommandée avec accusé de réception.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Dans ce cas, aucune somme ne peut être retenue ni exigée du stagiaire (article L.6353-5
            du Code du travail).
          </Text>
        </DocSection>

        {/* 5. Interruption, abandon et résiliation (L.6353-7) */}
        <DocSection title="5. Interruption, abandon et résiliation">
          <Text style={pdfStyles.paragraph}>
            Si, par suite d'un cas de force majeure dûment reconnu, le stagiaire est empêché de
            suivre la formation, il peut rompre le contrat. Seules les prestations effectivement
            dispensées sont alors dues, à due proportion de leur valeur prévue au présent contrat
            (article L.6353-7 du Code du travail).
          </Text>
          <Text style={local.listItem}>
            • En cas d'inexécution totale ou partielle de la formation du fait de l'organisme, ce
            dernier rembourse au stagiaire les sommes indûment perçues.
          </Text>
          <Text style={local.listItem}>
            • En cas d'abandon en cours de formation pour un motif autre que la force majeure, les
            prestations effectivement réalisées restent dues.
          </Text>
        </DocSection>

        {/* 6. Documents annexés */}
        <DocSection title="6. Documents annexés">
          <Text style={local.listItem}>– Programme détaillé de la formation</Text>
          <Text style={local.listItem}>– Règlement intérieur des stagiaires</Text>
          <Text style={local.listItem}>– Conditions générales de vente (CGV)</Text>
        </DocSection>

        {/* 7. Signatures */}
        <DocSection title="7. Signatures">
          <Text style={local.signatureLu}>
            Le présent contrat est établi en deux exemplaires originaux, un pour chaque partie.
          </Text>
          <Text style={pdfStyles.paragraph}>
            Fait à _________________________, le {data.dateContrat}
          </Text>
          <View style={pdfStyles.signatureZone}>
            <View style={pdfStyles.signatureBox}>
              <Text style={local.signatureLabel}>Pour l'organisme de formation</Text>
              <Text style={local.signatureLu}>Lu et approuvé</Text>
              <Text style={pdfStyles.paragraph}>{identite.raisonSociale || "Axion-IA SAS"}</Text>
              <Text style={pdfStyles.legalNote}>Nom, qualité, signature et cachet</Text>
            </View>
            <View style={pdfStyles.signatureBox}>
              <Text style={local.signatureLabel}>Le stagiaire</Text>
              <Text style={local.signatureLu}>Lu et approuvé</Text>
              <Text style={pdfStyles.paragraph}>{data.stagiaire.nomPrenom}</Text>
              <Text style={pdfStyles.legalNote}>
                Mention manuscrite « Lu et approuvé », date et signature
              </Text>
            </View>
          </View>
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
