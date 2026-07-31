/**
 * Qualiopi — Facture de prestation de formation professionnelle.
 *
 * Conformité mentions obligatoires :
 *   - Identité + adresse du siège du vendeur (en-tête + pied via QualiopiPage).
 *   - SIRET / NDA / Qualiopi (en-tête + bloc facturation, `required`).
 *   - Date d'émission, date d'échéance, date de réalisation de la prestation
 *     (art. 242 nonies A CGI).
 *   - TVA : mention DÉRIVÉE du régime configuré (`regime_tva`), jamais figée.
 *     Assujetti → aucune mention ; exonération 261-4-4° ou franchise 293 B →
 *     mention correspondante. Voir F25.
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
  DocSection,
  FieldRow,
  DataTable,
  LegalCallout,
  formatEurosFromCents,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import {
  computeTotauxFacture,
  mentionTva,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
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
  /**
   * Taux de TVA de la ligne (%). Override pour les factures MIXTES (ex. ligne
   * de conseil/audit à 20 % sur une facture sinon exonérée). Sinon, le taux est
   * dérivé du régime de TVA de la facture.
   */
  tauxTvaPercent?: number;
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
  /** Référence client / n° de bon de commande (exigé ETI/grands comptes/OPCO). */
  refClient?: string;
  /**
   * Régime de TVA appliqué (assujetti 20 % / exonération 261-4-4° / franchise
   * 293 B). Capturé depuis la config au moment de l'émission (instantané).
   */
  regimeTva: RegimeTva;
  /** Taux standard appliqué en régime assujetti (%). Défaut 20. */
  tauxTvaStandardPercent?: number;
  subrogationOpco?: SubrogationOpco;
  rib?: RibFacture;
  estCopie?: boolean;
  /** Injecte par `generateDocument` quand l'identite de l'OF est incomplete. */
  estSpecimen?: boolean;
  specimenMotif?: string;
  /** Avoir (facture rectificative, montants négatifs) — change le titre du document. */
  estAvoir?: boolean;
  /** Numéro de la facture d'origine rectifiée (obligatoire sur un avoir). */
  avoirSurNumero?: string;
  /** Motif de la rectification (affiché sur l'avoir). */
  motifAvoir?: string;
}

// ============================================================
// Composant principal
// ============================================================

export function FacturePdf({ data }: { data: FactureData }): React.ReactElement {
  const { identite } = data;

  const tauxStandard = data.tauxTvaStandardPercent ?? TAUX_TVA_STANDARD;
  const totaux = computeTotauxFacture(data.lignes, data.regimeTva, tauxStandard);
  const tauxLigne = (ligne: LigneFacture): number =>
    typeof ligne.tauxTvaPercent === "number"
      ? ligne.tauxTvaPercent
      : data.regimeTva === "assujetti"
        ? tauxStandard
        : 0;
  const mentionRegimeTva = mentionTva(data.regimeTva);

  return (
    <Document>
      <QualiopiPage
        docTitle={data.estAvoir === true ? "Avoir" : "Facture"}
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        {/* Identifiants de facturation — SIRET/NDA en `required` (jamais masqués) */}
        <DocSection title="Informations de facturation">
          <FieldRow
            label={data.estAvoir === true ? "N° d'avoir" : "N° de facture"}
            value={data.numero}
            required
          />
          {data.estAvoir === true && data.avoirSurNumero !== undefined && (
            <FieldRow label="Avoir sur facture" value={data.avoirSurNumero} required />
          )}
          {data.estAvoir === true && data.motifAvoir !== undefined && (
            <FieldRow label="Motif de la rectification" value={data.motifAvoir} />
          )}
          {data.refClient !== undefined && data.refClient !== "" && (
            <FieldRow label="Référence client / commande" value={data.refClient} />
          )}
          <FieldRow label="Date d'émission" value={data.dateEmission} required />
          <FieldRow
            label="Date de réalisation de la prestation"
            value={data.periodePrestation ?? data.dateEmission}
          />
          <FieldRow label="Date d'échéance" value={data.dateEcheance} required />
          <FieldRow label="SIRET de l'organisme" value={identite.siret} required />
          {/*
            🔴 F26 — mentions obligatoires de toute société commerciale :
            forme juridique, capital social et RCS + ville (art. R123-238 C. com.),
            n° de TVA intracommunautaire dès 150 € (art. 242 nonies A CGI).
            Elles manquaient : la facture n'était pas régulière.

            Chaque bloc est conditionnel — tant que `legal_overrides` n'est pas
            complété, on omet plutôt que d'imprimer un libellé vide, qui se lirait
            comme une donnée perdue.
          */}
          {identite.formeJuridique ? (
            <FieldRow label="Forme juridique" value={identite.formeJuridique} />
          ) : null}
          {identite.capitalSocial ? (
            <FieldRow label="Capital social" value={identite.capitalSocial} />
          ) : null}
          {identite.rcsVille ? (
            <FieldRow
              label="RCS"
              value={identite.siren ? `${identite.rcsVille} ${identite.siren}` : identite.rcsVille}
            />
          ) : null}
          {identite.tvaIntracom ? (
            <FieldRow label="N° TVA intracommunautaire" value={identite.tvaIntracom} />
          ) : null}
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
              { key: "qte", header: "Qté", flex: 0.8, align: "right" },
              { key: "pu", header: "P.U. HT", flex: 1.4, align: "right" },
              { key: "tva", header: "TVA", flex: 0.8, align: "right" },
              { key: "total", header: "Total HT", flex: 1.4, align: "right" },
            ]}
            rows={data.lignes.map((ligne) => ({
              designation: ligne.designation,
              qte: String(ligne.quantite),
              pu: formatEurosFromCents(ligne.prixUnitaireHtCents),
              tva: `${tauxLigne(ligne)} %`,
              total: formatEurosFromCents(ligne.quantite * ligne.prixUnitaireHtCents),
            }))}
          />
        </DocSection>

        {/* Totaux — ventilation TVA par taux (régime de TVA appliqué) */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{formatEurosFromCents(totaux.totalHtCents)}</Text>
          </View>
          {totaux.ventilation.map((v) => (
            <View key={v.tauxPercent} style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {totaux.ventilation.length > 1
                  ? `TVA ${v.tauxPercent} % (base ${formatEurosFromCents(v.baseHtCents)})`
                  : `TVA (${v.tauxPercent} %)`}
              </Text>
              <Text style={styles.totalValue}>{formatEurosFromCents(v.montantTvaCents)}</Text>
            </View>
          ))}
          <View style={styles.totalTtcRow}>
            <Text style={styles.totalTtcLabel}>Total TTC</Text>
            <Text style={styles.totalTtcValue}>{formatEurosFromCents(totaux.totalTtcCents)}</Text>
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
            {/* 🔴 La consigne de RÉFÉRENCE, sans laquelle tout rapprochement est
                une devinette.

                Un virement qui arrive sans référence n'est identifiable que par
                son montant et son émetteur — ce qui suffit pour un client, pas
                pour dix, et surtout pas pour deux factures du même montant. Le
                champ `receivedReference` existe côté encaissement ; encore
                faut-il que le client ait quelque chose à mettre.

                ⚠️ Rendue DANS le bloc RIB : sans coordonnées bancaires, demander
                une référence de virement n'aurait aucun sens. */}
            <Text
              style={{
                fontSize: T.xs,
                color: brandColor("fg-soft"),
                marginTop: S.sm,
              }}
            >
              {`Merci de rappeler la référence « ${data.numero} » dans le libellé de votre virement.`}
            </Text>
          </View>
        ) : null}

        {/* Conditions de règlement + mentions légales obligatoires */}
        <LegalCallout variant="legal" title="Conditions de règlement et mentions légales">
          {/* Mention de TVA selon le régime (exonération 261-4-4° ou franchise
              293 B). En régime assujetti : pas de mention d'exonération, la TVA
              figure dans les totaux. */}
          {mentionRegimeTva ? <Text style={styles.legalLine}>{mentionRegimeTva}</Text> : null}
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.facturePenalitesRetard}</Text>
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.factureIndemniteRecouvrement}</Text>
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.factureEscompte}</Text>
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
