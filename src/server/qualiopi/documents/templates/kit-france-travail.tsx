/**
 * Qualiopi — Kit France Travail : récapitulatif du dossier AIF/POEI/CSP.
 *
 * Couvre les 3 dispositifs France Travail :
 *   - AIF (Aide Individuelle à la Formation)
 *   - POEI (Préparation Opérationnelle à l'Emploi Individuelle)
 *   - CSP (Contrat de Sécurisation Professionnelle)
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
  LegalCallout,
  formatEurosFromCents,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles spécifiques
// ============================================================

const styles = StyleSheet.create({
  pieceRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("sand"),
    alignItems: "flex-start",
  },
  pieceCheck: {
    width: 16,
    fontSize: 10,
    color: brandColor("sage"),
    fontWeight: "bold",
  },
  pieceLabelBlock: { flex: 1 },
  pieceLabel: {
    fontSize: 10,
    color: brandColor("fg"),
  },
  pieceCondition: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
  },
  racRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  racLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor("mocha"),
    flex: 1,
  },
  racValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: brandColor("terracotta"),
    fontFamily: "Inconsolata",
  },
});

// ============================================================
// Types de données
// ============================================================


/**
 * Pied de kit financeur : NDA, et le n° Qualiopi UNIQUEMENT s'il existe.
 *
 * 🔴 F29 — « à renseigner » est une note de chantier destinée à Will. Elle
 * s'imprimait telle quelle sur un document adressé à un financeur, où elle se
 * lit comme un dossier bâclé. Un organisme non encore certifié n'a pas de numéro
 * Qualiopi : on omet la mention au lieu d'annoncer qu'elle manque.
 */
function qualiopiLigne(identite: OrganismeIdentite): string {
  const nda = identite.nda ? `NDA : ${identite.nda}` : "";
  const qualiopi = identite.qualiopi ? `Certification Qualiopi : ${identite.qualiopi}` : "";
  return [nda, qualiopi].filter((p) => p !== "").join(" — ");
}

export type DispositifFranceTravail = "AIF" | "POEI" | "CSP";

export interface BeneficiaireFT {
  nom: string;
  prenom: string;
  identifiantPoleEmploi?: string;
}

export interface EntreprisePoei {
  raisonSociale: string;
  siret?: string;
  offreEmploiReference?: string;
}

export interface MontantsFranceTravail {
  montantAideFranceTravailCents: number;
  resteAChargeCents: number;
  coutTotalCents: number;
}

export interface KitFranceTravailData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  dispositif: DispositifFranceTravail;
  beneficiaire: BeneficiaireFT;
  intituleFormation: string;
  dateDebut: string;
  dateFin: string;
  numeroDossierFranceTravail?: string;
  entreprisePoei?: EntreprisePoei;
  montants: MontantsFranceTravail;
  estCopie?: boolean;
}

// ============================================================
// Helpers
// ============================================================

const DISPOSITIF_LABELS: Record<DispositifFranceTravail, string> = {
  AIF: "AIF — Aide Individuelle à la Formation",
  POEI: "POEI — Préparation Opérationnelle à l'Emploi Individuelle",
  CSP: "CSP — Contrat de Sécurisation Professionnelle",
};

function getPiecesRequises(
  dispositif: DispositifFranceTravail,
): Array<{ label: string; condition: string | null }> {
  const commun: Array<{ label: string; condition: string | null }> = [
    { label: "Accord de financement France Travail", condition: null },
    { label: "Engagement du bénéficiaire / Protocole de formation", condition: null },
    { label: "Attestation de fin de formation (ou certificat de réalisation)", condition: null },
    { label: "Feuilles d'émargement ou relevés de connexion", condition: null },
    { label: "Facture exonérée de TVA (Art. 261-4-4° CGI)", condition: null },
  ];
  if (dispositif === "POEI") {
    commun.unshift({
      label: "Offre d'emploi déposée sur France Travail (POEI)",
      condition: "Référence de l'offre obligatoire",
    });
    commun.push({
      label: "Convention tripartite (Bénéficiaire / Entreprise / France Travail)",
      condition: "Dispositif POEI uniquement",
    });
  }
  if (dispositif === "CSP") {
    commun.unshift({
      label: "Attestation d'entrée en CSP",
      condition: "Dispositif CSP uniquement",
    });
  }
  return commun;
}

// ============================================================
// Composant principal
// ============================================================

export function KitFranceTravailPdf({ data }: { data: KitFranceTravailData }): React.ReactElement {
  const { identite } = data;
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();
  const pieces = getPiecesRequises(data.dispositif);

  return (
    <Document>
      <QualiopiPage
        docTitle="Kit dossier France Travail"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Badge dispositif */}
        <LegalCallout variant="info" title="Dispositif">
          {DISPOSITIF_LABELS[data.dispositif]}
        </LegalCallout>

        {/* Identification */}
        <DocSection title="Identification">
          <FieldRow label="Bénéficiaire" value={prenomNom} />
          {data.beneficiaire.identifiantPoleEmploi ? (
            <FieldRow
              label="Identifiant France Travail"
              value={data.beneficiaire.identifiantPoleEmploi}
            />
          ) : null}
          {data.numeroDossierFranceTravail ? (
            <FieldRow label="N° dossier France Travail" value={data.numeroDossierFranceTravail} />
          ) : null}
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
        </DocSection>

        {/* Entreprise (POEI uniquement) */}
        {data.dispositif === "POEI" && data.entreprisePoei ? (
          <DocSection title="Entreprise partenaire (POEI)">
            <FieldRow label="Raison sociale" value={data.entreprisePoei.raisonSociale} />
            {data.entreprisePoei.siret ? (
              <FieldRow label="SIRET" value={data.entreprisePoei.siret} />
            ) : null}
            {data.entreprisePoei.offreEmploiReference ? (
              <FieldRow
                label="Référence offre d'emploi"
                value={data.entreprisePoei.offreEmploiReference}
              />
            ) : null}
          </DocSection>
        ) : null}

        {/* Pièces constitutives */}
        <DocSection title="Pièces constitutives du dossier">
          {pieces.map((piece, idx) => (
            <View key={idx} style={styles.pieceRow}>
              <Text style={styles.pieceCheck}>☐</Text>
              <View style={styles.pieceLabelBlock}>
                <Text style={styles.pieceLabel}>{piece.label}</Text>
                {piece.condition ? (
                  <Text style={styles.pieceCondition}>{piece.condition}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </DocSection>

        {/* Montants */}
        <DocSection title="Montants de financement">
          <DataTable
            columns={[
              { key: "poste", header: "Poste", flex: 3 },
              { key: "montant", header: "Montant", flex: 1.5, align: "right" },
            ]}
            rows={[
              {
                poste: "Coût total de la formation",
                montant: formatEurosFromCents(data.montants.coutTotalCents),
              },
              {
                poste: "Aide France Travail",
                montant: formatEurosFromCents(data.montants.montantAideFranceTravailCents),
              },
            ]}
          />
          <LegalCallout variant="warning">
            <View style={styles.racRow}>
              <Text style={styles.racLabel}>Reste à charge</Text>
              <Text style={styles.racValue}>
                {formatEurosFromCents(data.montants.resteAChargeCents)}
              </Text>
            </View>
          </LegalCallout>
        </DocSection>

        {/* Mentions légales */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.factureExonerationTva}</Text>
          <Text style={pdfStyles.legalNote}>
            {qualiopiLigne(identite)}
          </Text>
        </View>
      </QualiopiPage>
    </Document>
  );
}
