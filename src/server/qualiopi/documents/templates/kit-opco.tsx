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
  ventilationHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: brandColor("mocha"),
    paddingBottom: 4,
    marginBottom: 4,
  },
  colParticipants: { flex: 2 },
  colHeures: { flex: 1.5, textAlign: "right" },
  colBareme: { flex: 1.5, textAlign: "right" },
  colPrisEnCharge: { flex: 2, textAlign: "right" },
  colRac: { flex: 1.5, textAlign: "right" },
  ventilHeaderText: {
    fontSize: 8,
    fontWeight: "bold",
    color: brandColor("fg-soft"),
  },
  ventilRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
  },
  ventilCell: {
    fontSize: 9,
    color: brandColor("fg"),
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
// Helpers monétaires
// ============================================================

function formatEuros(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

// ============================================================
// Types de données
// ============================================================

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
          {/* En-tête tableau */}
          <View style={styles.ventilationHeader}>
            <View style={styles.colParticipants}>
              <Text style={styles.ventilHeaderText}>Participant</Text>
            </View>
            <View style={styles.colHeures}>
              <Text style={[styles.ventilHeaderText, { textAlign: "right" }]}>Heures</Text>
            </View>
            <View style={styles.colBareme}>
              <Text style={[styles.ventilHeaderText, { textAlign: "right" }]}>Barème/h</Text>
            </View>
            <View style={styles.colPrisEnCharge}>
              <Text style={[styles.ventilHeaderText, { textAlign: "right" }]}>Pris en charge</Text>
            </View>
            <View style={styles.colRac}>
              <Text style={[styles.ventilHeaderText, { textAlign: "right" }]}>RAC</Text>
            </View>
          </View>

          {/* Lignes participants */}
          {data.ventilation.map((v, idx) => (
            <View key={idx} style={styles.ventilRow}>
              <View style={styles.colParticipants}>
                <Text style={styles.ventilCell}>{v.nomParticipant}</Text>
              </View>
              <View style={styles.colHeures}>
                <Text style={[styles.ventilCell, { textAlign: "right" }]}>
                  {formatHeuresCentiemes(v.heuresRealisees)}
                </Text>
              </View>
              <View style={styles.colBareme}>
                <Text style={[styles.ventilCell, { textAlign: "right" }]}>
                  {formatEuros(v.baremePrisEnChargeHeureCents)}
                </Text>
              </View>
              <View style={styles.colPrisEnCharge}>
                <Text style={[styles.ventilCell, { textAlign: "right" }]}>
                  {formatEuros(v.montantPrisEnChargeCents)}
                </Text>
              </View>
              <View style={styles.colRac}>
                <Text style={[styles.ventilCell, { textAlign: "right" }]}>
                  {formatEuros(v.resteAChargeCents)}
                </Text>
              </View>
            </View>
          ))}

          {/* Totaux */}
          <View style={styles.ventilTotalRow}>
            <Text style={styles.ventilTotalLabel}>Total pris en charge OPCO</Text>
            <Text style={styles.ventilTotalValue}>{formatEuros(data.totalPrisEnChargeCents)}</Text>
          </View>
          <View style={[styles.ventilTotalRow, { backgroundColor: brandColor("terracotta-soft") }]}>
            <Text style={styles.ventilTotalLabel}>Total reste à charge</Text>
            <Text style={styles.ventilTotalValue}>{formatEuros(data.totalResteAChargeCents)}</Text>
          </View>
        </DocSection>

        {/* Mentions légales */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.legalNote}>
            {`NDA : ${identite.nda || "à renseigner"} — Certification Qualiopi : ${identite.qualiopi || "à renseigner"}`}
          </Text>
          <Text style={pdfStyles.legalNote}>{LEGAL_MENTIONS.factureExonerationTva}</Text>
        </View>
      </QualiopiPage>
    </Document>
  );
}
