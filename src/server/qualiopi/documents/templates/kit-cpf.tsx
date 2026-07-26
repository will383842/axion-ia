/**
 * Qualiopi — Kit CPF/EDOF : récapitulatif du dossier de financement CPF.
 *
 * Contient : code CPF/EDOF, liste des pièces, reste à charge (PLF 2026),
 * récap financier (montant CPF, reste à charge bénéficiaire).
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
  pieceLabel: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
  },
  racValue: {
    fontSize: 16,
    fontFamily: "Inconsolata",
    fontWeight: "bold",
    color: brandColor("terracotta"),
    marginBottom: 2,
  },
  racNote: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
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

export interface BeneficiaireCpf {
  nom: string;
  prenom: string;
  numeroEdof?: string;
}

export interface KitCpfData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  beneficiaire: BeneficiaireCpf;
  codeCpf: string;
  intituleFormation: string;
  dateDebut: string;
  dateFin: string;
  montantCpfCents: number;
  resteAChargeCents: number;
  coutTotalCents: number;
  estCopie?: boolean;
}

// ============================================================
// Composant principal
// ============================================================

export function KitCpfPdf({ data }: { data: KitCpfData }): React.ReactElement {
  const { identite } = data;
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();

  return (
    <Document>
      <QualiopiPage
        docTitle="Kit dossier CPF / EDOF"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Identification de la formation */}
        <DocSection title="Formation et bénéficiaire">
          <FieldRow label="Code CPF" value={data.codeCpf} />
          {data.beneficiaire.numeroEdof ? (
            <FieldRow label="N° EDOF (Mon Compte Formation)" value={data.beneficiaire.numeroEdof} />
          ) : null}
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Bénéficiaire" value={prenomNom} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
        </DocSection>

        {/* Pièces constitutives */}
        <DocSection title="Pièces constitutives du dossier CPF">
          {[
            { label: "Accord de prise en charge EDOF / Mon Compte Formation" },
            { label: "Attestation de fin de formation (ou partielle)" },
            // 🔴 F25 (3e passage) — voir kit-opco : la checklist annonçait encore
            // l'exonération 261-4-4° en dur, sur une pièce adressée à un financeur.
            {
              label: identite.mentionTvaRegime
                ? `Facture — ${identite.mentionTvaRegime}`
                : "Facture",
            },
            { label: "Feuilles d'émargement ou relevés de connexion" },
          ].map((piece, idx) => (
            <View key={idx} style={styles.pieceRow}>
              <Text style={styles.pieceCheck}>☐</Text>
              <Text style={styles.pieceLabel}>{piece.label}</Text>
            </View>
          ))}
        </DocSection>

        {/* Récapitulatif financier */}
        <DocSection title="Récapitulatif financier">
          <DataTable
            columns={[
              { key: "poste", header: "Poste", flex: 3 },
              { key: "montant", header: "Montant", flex: 1.5, align: "right" },
            ]}
            rows={[
              {
                poste: "Coût total de la formation",
                montant: formatEurosFromCents(data.coutTotalCents),
              },
              {
                poste: "Montant pris en charge par le CPF",
                montant: formatEurosFromCents(data.montantCpfCents),
              },
            ]}
          />
        </DocSection>

        {/* Reste à charge — bloc mis en avant (PLF 2026) */}
        <LegalCallout variant="warning" title="Reste à charge bénéficiaire (PLF 2026)">
          <Text style={styles.racValue}>{formatEurosFromCents(data.resteAChargeCents)}</Text>
          <Text style={styles.racNote}>
            Conformément aux dispositions du Projet de Loi de Finances 2026. Le reste à charge est
            payé directement par le bénéficiaire à l'organisme de formation.
          </Text>
        </LegalCallout>

        {/* Mentions légales */}
        <View style={[pdfStyles.section, { marginTop: 16 }]}>
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
          <Text style={pdfStyles.legalNote}>{qualiopiLigne(identite)}</Text>
        </View>
      </QualiopiPage>
    </Document>
  );
}
