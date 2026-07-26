/**
 * Qualiopi — Kit OPCO : page récapitulative du dossier de prise en charge.
 *
 * Récapitule les pièces requises par l'OPCO + la ventilation horaire
 * (participants × heures × barème → montant pris en charge + reste à charge).
 * Rappel : durée en centièmes (formatHeuresCentiemes), NDA/Qualiopi/exonération TVA.
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
  formatEurosFromCents,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS, formatHeuresCentiemes } from "@/server/qualiopi/legal/legal-mentions";
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
    alignItems: "center",
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
  pieceNote: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontStyle: "italic",
  },
  ventilTotalRow: {
    flexDirection: "row",
    paddingVertical: 5,
    backgroundColor: brandColor("sand"),
    paddingHorizontal: 4,
    marginTop: 4,
    borderRadius: 2,
  },
  ventilTotalLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor("mocha"),
    flex: 2,
  },
  ventilTotalValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor("terracotta"),
    fontFamily: "Inconsolata",
    flex: 1.5,
    textAlign: "right",
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

export interface VentilationParticipant {
  nomParticipant: string;
  heuresRealisees: number;
  baremePrisEnChargeHeureCents: number;
  montantPrisEnChargeCents: number;
  resteAChargeCents: number;
}

export interface KitOpcoData {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  nomOpco: string;
  numeroDossier: string;
  intituleFormation: string;
  dateDebut: string;
  dateFin: string;
  ventilation: VentilationParticipant[];
  totalPrisEnChargeCents: number;
  totalResteAChargeCents: number;
  estCopie?: boolean;
}

// ============================================================
// Composant principal
// ============================================================

export function KitOpcoPdf({ data }: { data: KitOpcoData }): React.ReactElement {
  const { identite } = data;

  return (
    <Document>
      <QualiopiPage
        docTitle="Kit dossier OPCO"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Informations OPCO */}
        <DocSection title="Informations OPCO et dossier">
          <FieldRow label="OPCO" value={data.nomOpco} />
          <FieldRow label="N° de dossier OPCO" value={data.numeroDossier} />
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date de début" value={data.dateDebut} />
          <FieldRow label="Date de fin" value={data.dateFin} />
        </DocSection>

        {/* Pièces à joindre */}
        <DocSection title="Pièces constitutives du dossier">
          {[
            { label: "Convention de formation / accord tripartite", note: "L.6353-1 / L.6353-2" },
            {
              label: "Certificat de réalisation (durées en centièmes)",
              note: "R.6313-3 + arrêté 21/12/2018",
            },
            { label: "Feuilles d'émargement signées (présentiel)", note: "Par demi-journée" },
            {
              label: "Relevés de connexion (distanciel)",
              note: "Connexion/déconnexion horodatés",
            },
            { label: "Facture exonérée de TVA", note: "Art. 261-4-4° CGI" },
          ].map((piece, idx) => (
            <View key={idx} style={styles.pieceRow}>
              <Text style={styles.pieceCheck}>☐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pieceLabel}>{piece.label}</Text>
                <Text style={styles.pieceNote}>{piece.note}</Text>
              </View>
            </View>
          ))}
        </DocSection>

        {/* Ventilation horaire */}
        <DocSection title="Ventilation horaire et financement">
          <DataTable
            columns={[
              { key: "participant", header: "Participant", flex: 2 },
              { key: "heures", header: "Heures", flex: 1.5, align: "right" },
              { key: "bareme", header: "Barème/h", flex: 1.5, align: "right" },
              { key: "prisEnCharge", header: "Pris en charge", flex: 2, align: "right" },
              { key: "rac", header: "RAC", flex: 1.5, align: "right" },
            ]}
            rows={data.ventilation.map((v) => ({
              participant: v.nomParticipant,
              heures: formatHeuresCentiemes(v.heuresRealisees),
              bareme: formatEurosFromCents(v.baremePrisEnChargeHeureCents),
              prisEnCharge: formatEurosFromCents(v.montantPrisEnChargeCents),
              rac: formatEurosFromCents(v.resteAChargeCents),
            }))}
          />

          {/* Totaux */}
          <View style={styles.ventilTotalRow}>
            <Text style={styles.ventilTotalLabel}>Total pris en charge OPCO</Text>
            <Text style={styles.ventilTotalValue}>
              {formatEurosFromCents(data.totalPrisEnChargeCents)}
            </Text>
          </View>
          <View style={[styles.ventilTotalRow, { backgroundColor: brandColor("terracotta-soft") }]}>
            <Text style={styles.ventilTotalLabel}>Total reste à charge</Text>
            <Text style={styles.ventilTotalValue}>
              {formatEurosFromCents(data.totalResteAChargeCents)}
            </Text>
          </View>
        </DocSection>

        {/* Mentions légales */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.legalNote}>
            {qualiopiLigne(identite)}
          </Text>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.factureExonerationTva}</Text>
        </View>
      </QualiopiPage>
    </Document>
  );
}
