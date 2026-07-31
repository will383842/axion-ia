/**
 * Qualiopi — Devis de prestation (CRM).
 *
 * Miroir commercial de la facture (facture.tsx) :
 *   - Identité + adresse du siège de l'émetteur (en-tête + pied via QualiopiPage).
 *   - SIRET / NDA / Qualiopi (bloc émetteur, `required`).
 *   - N° de devis, date d'émission, date de validité, référence client.
 *   - Lignes avec taux de TVA par ligne (devis mixtes formation 0 % + conseil 20 %).
 *   - Totaux HT / TVA (ventilation par taux) / TTC via computeTotauxFacture.
 *   - Estimation OPCO / reste à charge (indicative, non contractuelle).
 *   - Mention TVA dérivée du régime (exonération 261-4-4° / franchise 293 B).
 *   - Bloc signature « Bon pour accord » (nom/fonction, date, signature).
 *   - Mention « Devis gratuit, valable jusqu'au {dateValidite} ».
 *
 * Montants en centimes d'euro (prixUnitaireHtCents) pour éviter les erreurs
 * d'arrondi flottant. Le numéro affiché est celui du Devis CRM (pré-construit
 * par l'appelant — PAS le numéro du registre DocumentGenere).
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  NdaFieldRow,
  DataTable,
  LegalCallout,
  SignatureZone,
  formatEurosFromCents,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";
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
// Styles spécifiques (totaux + signature « Bon pour accord »)
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
  legalLine: {
    fontSize: T.xs,
    color: brandColor("fg"),
    lineHeight: T.lineNormal,
    marginBottom: S.xs,
  },
  // Bloc « Bon pour accord » — signature manuscrite du client.
  accordBox: {
    marginTop: S.xxl,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    borderRadius: S.radius,
    backgroundColor: brandColor("bg"),
    padding: S.lg,
  },
  accordTitle: {
    fontSize: T.md,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: S.xs,
  },
  accordHint: {
    fontSize: T.xs,
    fontStyle: "italic",
    color: brandColor("fg-muted"),
    marginBottom: S.lg,
  },
  // ⚠️ `accordLine` a été retiré avec les trois lignes « Nom / Date / Signature »
  // à remplir au stylo : `SignatureZone` porte désormais les cadres, vides ou
  // renseignés. Le laisser aurait été du style mort.
});

// ============================================================
// Types de données
// ============================================================

export interface ClientDevis {
  raisonSociale: string;
  siret?: string;
  adresse?: string;
  email?: string;
}

export interface DevisData {
  numero: string;
  dateEmission: string;
  /** Date limite de validité du devis (formatée fr-FR). */
  dateValidite: string;
  /** Référence client / n° de bon de commande (exigé ETI/grands comptes/OPCO). */
  refClient?: string;
  identite: OrganismeIdentite;
  client: ClientDevis;
  lignes: LigneFacture[];
  /**
   * Régime de TVA appliqué (assujetti 20 % / exonération 261-4-4° / franchise
   * 293 B). Capturé depuis la config au moment de l'émission (instantané).
   */
  regimeTva: RegimeTva;
  /** Taux standard appliqué en régime assujetti (%). Défaut 20. */
  tauxTvaStandardPercent?: number;
  /** Libellé de l'activité facturée (SSOT ACTIVITE_LABELS). */
  activiteLabel?: string;
  /** Libellé du financement suggéré (OPCO, CPF, France Travail…). */
  financementSuggere?: string;
  /** Prise en charge financeur estimée (centimes) — indicative. */
  montantOpcoEstimeCents?: number;
  /** Reste à charge client estimé (centimes) — indicatif. */
  resteAChargeCents?: number;
  estCopie?: boolean;
  /**
   * Preuves de signature RÉELLEMENT apposées, par partie.
   *
   * 🔴 ABSENTES = cadres vides à remplir au stylo, comportement historique
   * INCHANGÉ. Ce n'est pas un état dégradé : le circuit papier reste un chemin
   * de plein droit — c'est le seul qui fonctionne quand le client veut imprimer,
   * signer et scanner. Supprimer les cadres vides serait une régression.
   *
   * Renseignées, elles font rendre le tracé, l'horodatage et l'empreinte au bas
   * du devis, SOUS les totaux. C'est ce qui fait que le client signe la pièce
   * qu'il a lue, et non un document séparé à trois champs.
   */
  signatures?: PreuvesParPartie;
}

// ============================================================
// Composant principal
// ============================================================

export function DevisPdf({ data }: { data: DevisData }): React.ReactElement {
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
  const afficheEstimation =
    data.montantOpcoEstimeCents !== undefined || data.resteAChargeCents !== undefined;

  return (
    <Document>
      <QualiopiPage
        docTitle="Devis"
        docNumber={`N° ${data.numero}`}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Informations du devis */}
        <DocSection title="Informations du devis">
          <FieldRow label="N° de devis" value={data.numero} required />
          <FieldRow label="Date d'émission" value={data.dateEmission} required />
          <FieldRow label="Valable jusqu'au" value={data.dateValidite} required />
          {data.refClient !== undefined && data.refClient !== "" && (
            <FieldRow label="Référence client / commande" value={data.refClient} />
          )}
          {data.activiteLabel !== undefined && data.activiteLabel !== "" && (
            <FieldRow label="Activité" value={data.activiteLabel} />
          )}
        </DocSection>

        {/* Émetteur — SIRET/NDA en `required` (jamais masqués) */}
        <DocSection title="Émetteur">
          <FieldRow label="Raison sociale" value={identite.raisonSociale} required />
          <FieldRow label="Adresse du siège" value={identite.adresseSiege} required />
          <FieldRow label="SIRET de l'organisme" value={identite.siret} required />
          <NdaFieldRow label="N° déclaration activité (NDA)" nda={identite.nda} />
          {identite.qualiopi ? (
            <FieldRow label="Certification Qualiopi" value={identite.qualiopi} />
          ) : null}
        </DocSection>

        {/* Client */}
        <DocSection title="Client">
          <FieldRow label="Raison sociale" value={data.client.raisonSociale} required />
          {data.client.siret ? <FieldRow label="SIRET" value={data.client.siret} /> : null}
          {data.client.adresse ? <FieldRow label="Adresse" value={data.client.adresse} /> : null}
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

        {/* Estimation de financement (indicative — jamais contractuelle) */}
        {afficheEstimation ? (
          <LegalCallout variant="info" title="Estimation de financement">
            {[
              data.financementSuggere !== undefined && data.financementSuggere !== ""
                ? `Financement suggéré : ${data.financementSuggere}. `
                : "",
              data.montantOpcoEstimeCents !== undefined
                ? `Prise en charge estimée : ${formatEurosFromCents(data.montantOpcoEstimeCents)}. `
                : "",
              data.resteAChargeCents !== undefined
                ? `Reste à charge estimé : ${formatEurosFromCents(data.resteAChargeCents)}. `
                : "",
              "Estimation indicative, non contractuelle — sous réserve de l'accord de prise en charge du financeur.",
            ].join("")}
          </LegalCallout>
        ) : null}

        {/* Mention TVA (régime) + validité du devis */}
        <LegalCallout variant="legal" title="Conditions du devis">
          {/* Mention de TVA selon le régime (exonération 261-4-4° ou franchise
              293 B). En régime assujetti : pas de mention d'exonération, la TVA
              figure dans les totaux. */}
          {mentionRegimeTva ? <Text style={styles.legalLine}>{mentionRegimeTva}</Text> : null}
          <Text style={styles.legalLine}>
            {`Devis gratuit, valable jusqu'au ${data.dateValidite}. Au-delà de cette date, les conditions (tarifs, disponibilités) sont susceptibles d'être révisées.`}
          </Text>
        </LegalCallout>

        {/* ── Bon pour accord — en bas du document, SOUS les totaux ──

            🔴 C'est ICI que la signature doit apparaître, et pas ailleurs : le
            signataire doit avoir les lignes, les quantités, les prix unitaires,
            la TVA et les totaux SOUS LES YEUX au moment où il s'engage. C'était
            précisément le défaut du circuit fournisseur — le client lisait ce
            document-ci et en signait un autre, à trois champs, qui ne désignait
            pas son objet.

            ⚠️ `SignatureZone` rend chaque modalité POUR CE QU'ELLE EST et
            n'affiche jamais une case « signé » sans dire de quoi elle est faite.
            Tant qu'aucune preuve n'existe, elle rend les cadres vides — le
            circuit papier reste ouvert. */}
        <View style={styles.accordBox} wrap={false}>
          <Text style={styles.accordTitle}>Bon pour accord</Text>
          <Text style={styles.accordHint}>
            Le client accepte le présent devis dans son intégralité : désignations, quantités, prix
            unitaires, taux de TVA et totaux ci-dessus.
          </Text>
          {/* 🔴 L'emplacement de DATE n'est affiché que tant que personne n'a
              signé, et il ne doit pas disparaître du chemin papier : sur une
              pièce contractuelle, c'est la date qui prouve QUAND l'engagement a
              été pris — et l'art. L.6353-1 exige que la convention soit conclue
              AVANT le début de l'action. Une fois la signature apposée,
              `SignatureApposee` porte l'horodatage réel, et laisser en plus une
              ligne à remplir inviterait à en écrire une autre, contradictoire. */}
          <SignatureZone
            {...(data.signatures?.client == null && data.signatures?.axionia == null
              ? { faitLe: "……………………………………, le ……………………………" }
              : {})}
            parties={[
              {
                titre: "Pour le client",
                nom: data.client.raisonSociale,
                mention: "Nom, qualité, signature — précédée de la mention « Bon pour accord »",
                signature: data.signatures?.client ?? null,
              },
              {
                // L'organisme CONCLUT : il contresigne ce que le client a
                // accepté. L'ordre suit le SSOT (`parties-requises.ts`), où
                // `axionia` figure en dernier — ce n'est pas décoratif.
                titre: "Pour l'organisme",
                nom: identite.raisonSociale,
                mention: "Nom, qualité, signature et cachet",
                signature: data.signatures?.axionia ?? null,
              },
            ]}
          />
        </View>
      </QualiopiPage>
    </Document>
  );
}
