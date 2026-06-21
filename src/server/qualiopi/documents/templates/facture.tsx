/**
 * Qualiopi — Facture de prestation de formation professionnelle.
 *
 * Conformité mentions obligatoires :
 *   - Identité + adresse du siège du vendeur (en-tête + pied via QualiopiPage).
 *   - SIRET / NDA / Qualiopi (en-tête + bloc facturation, `required`).
 *   - Date d'émission, date d'échéance, date de réalisation de la prestation
 *     (art. 242 nonies A CGI).
 *   - TVA : exonération art. 261-4-4° CGI (formation professionnelle continue).
 *   - Pénalités de retard (art. L.441-10), indemnité forfaitaire 40 €
 *     (art. D.441-5), absence d'escompte (art. L.441-9) — C. commerce, B2B.
 *
 * Montants en centimes d'euro (prixUnitaireHtCents, totalHtCents) pour éviter
 * les erreurs d'arrondi flottant.
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
import {
  brandColor,
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles spécifiques (totaux + RIB)
// ============================================================

const styles = StyleSheet.create({
  totalsBlock: {
    marginTop: S.xl,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 240,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
  },
  totalLabel: {
    fontSize: T.base,
    flex: 1,
    color: brandColor("fg-soft"),
    fontWeight: "bold",
  },
  totalValue: {
    fontSize: T.base,
    color: brandColor("fg"),
    fontFamily: "Inconsolata",
    textAlign: "right",
  },
  totalTtcRow: {
    flexDirection: "row",
    width: 240,
    paddingVertical: S.md,
    backgroundColor: brandColor("mocha"),
    paddingHorizontal: S.md,
    marginTop: S.xs,
    borderRadius: S.radius,
  },
  totalTtcLabel: {
    fontSize: T.lg,
    flex: 1,
    color: brandColor("primary-fg"),
    fontWeight: "bold",
  },
  totalTtcValue: {
    fontSize: T.lg,
    color: brandColor("primary-fg"),
    fontFamily: "Inconsolata",
    fontWeight: "bold",
    textAlign: "right",
  },
  ribTitle: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: brandColor("fg-soft"),
    marginBottom: S.sm,
  },
  legalLine: {
    fontSize: T.xs,
    color: brandColor("fg"),
    lineHeight: T.lineNormal,
    marginBottom: S.xs,
  },
});

// ============================================================
// Types de données
// ============================================================

export interface LigneFacture {
  designation: string;
  quantite: number;
  prixUnitaireHtCents: number;
}

export interface ClientFacture {
  raisonSociale: string;
  siret?: string;
  adresse?: string;
  email?: string;
  /** N° TVA intracommunautaire du client (B2B intra-UE). Optionnel. */
  numeroTvaIntracom?: string;
}

export interface SubrogationOpco {
  nomOpco: string;
  numeroDossier: string;
}

export interface RibFacture {
  iban: string;
  bic: string;
  titulaire: string;
  banque?: string;
}

export interface FactureData {
  numero: string;
  dateEmission: string;
  dateEcheance: string;
  /**
   * Date (ou période) de réalisation de la prestation — obligatoire si
   * différente de la date d'émission (art. 242 nonies A CGI). Ex.
   * « du 01/06/2026 au 02/06/2026 ». Optionnel (défaut : date d'émission).
   */
  periodePrestation?: string;
  identite: OrganismeIdentite;
  client: ClientFacture;
  lignes: LigneFacture[];
  subrogationOpco?: SubrogationOpco;
  rib?: RibFacture;
  estCopie?: boolean;
}

// ============================================================
// Composant principal
// ============================================================

export function FacturePdf({ data }: { data: FactureData }): React.ReactElement {
  const { identite } = data;

  const totalHtCents = data.lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaireHtCents, 0);

  return (
    <Document>
      <QualiopiPage
        docTitle="Facture"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Identifiants de facturation — SIRET/NDA en `required` (jamais masqués) */}
        <DocSection title="Informations de facturation">
          <FieldRow label="N° de facture" value={data.numero} required />
          <FieldRow label="Date d'émission" value={data.dateEmission} required />
          <FieldRow
            label="Date de réalisation de la prestation"
            value={data.periodePrestation ?? data.dateEmission}
          />
          <FieldRow label="Date d'échéance" value={data.dateEcheance} required />
          <FieldRow label="SIRET de l'organisme" value={identite.siret} required />
          <FieldRow label="N° déclaration activité (NDA)" value={identite.nda} required />
          {identite.qualiopi ? (
            <FieldRow label="Certification Qualiopi" value={identite.qualiopi} />
          ) : null}
        </DocSection>

        {/* Client */}
        <DocSection title="Client">
          <FieldRow label="Raison sociale" value={data.client.raisonSociale} required />
          {data.client.siret ? <FieldRow label="SIRET" value={data.client.siret} /> : null}
          {data.client.adresse ? <FieldRow label="Adresse" value={data.client.adresse} /> : null}
          {data.client.numeroTvaIntracom ? (
            <FieldRow label="N° TVA intracommunautaire" value={data.client.numeroTvaIntracom} />
          ) : null}
          {data.client.email ? <FieldRow label="Email" value={data.client.email} /> : null}
        </DocSection>

        {/* Détail des prestations */}
        <DocSection title="Détail des prestations">
          <DataTable
            columns={[
              { key: "designation", header: "Désignation", flex: 3 },
              { key: "qte", header: "Qté", flex: 1, align: "right" },
              { key: "pu", header: "P.U. HT", flex: 1.5, align: "right" },
              { key: "total", header: "Total HT", flex: 1.5, align: "right" },
            ]}
            rows={data.lignes.map((ligne) => ({
              designation: ligne.designation,
              qte: String(ligne.quantite),
              pu: formatEurosFromCents(ligne.prixUnitaireHtCents),
              total: formatEurosFromCents(ligne.quantite * ligne.prixUnitaireHtCents),
            }))}
          />
        </DocSection>

        {/* Totaux */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{formatEurosFromCents(totalHtCents)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA (0 %)</Text>
            <Text style={styles.totalValue}>{formatEurosFromCents(0)}</Text>
          </View>
          <View style={styles.totalTtcRow}>
            <Text style={styles.totalTtcLabel}>Total TTC</Text>
            <Text style={styles.totalTtcValue}>{formatEurosFromCents(totalHtCents)}</Text>
          </View>
        </View>

        {/* Subrogation OPCO */}
        {data.subrogationOpco ? (
          <LegalCallout variant="info" title="Subrogation de paiement OPCO">
            {`Facture libellée à l'OPCO ${data.subrogationOpco.nomOpco} dans le cadre de la subrogation de paiement — N° dossier : ${data.subrogationOpco.numeroDossier}.`}
          </LegalCallout>
        ) : null}

        {/* RIB */}
        {data.rib ? (
          <View
            style={{
              marginTop: S.lg,
              padding: S.lg,
              borderWidth: 1,
              borderColor: brandColor("border-strong"),
              borderRadius: S.radius,
            }}
          >
            <Text style={styles.ribTitle}>Coordonnées bancaires</Text>
            <FieldRow label="Titulaire" value={data.rib.titulaire} />
            {data.rib.banque ? <FieldRow label="Banque" value={data.rib.banque} /> : null}
            <FieldRow label="IBAN" value={data.rib.iban} />
            <FieldRow label="BIC" value={data.rib.bic} />
          </View>
        ) : null}

        {/* Conditions de règlement + mentions légales obligatoires */}
        <LegalCallout variant="legal" title="Conditions de règlement et mentions légales">
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.factureExonerationTva}</Text>
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.facturePenalitesRetard}</Text>
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.factureIndemniteRecouvrement}</Text>
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.factureEscompte}</Text>
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
