/**
 * Qualiopi — Facture d'honoraires établie par MANDAT (autofacturation).
 *
 * 🔴 CE GABARIT N'EST PAS UNE VARIANTE DE `facture.tsx`, ET LE CONFONDRE COÛTE.
 *
 * Sur une facture de formation, le vendeur est l'organisme. Ici le vendeur est
 * le FORMATEUR : nous établissons SA facture, en son nom et pour son compte,
 * sous mandat. L'acheteur, c'est nous. Réutiliser l'autre gabarit aurait imprimé
 * notre SIRET et notre numéro de TVA à la place des siens — une pièce impeccable
 * et irrégulière, dont la TVA n'aurait pas été déductible.
 *
 * ── Les quatre éléments de régularité, et où ils sont dans la pièce ─────────
 *
 *   1. mandat écrit et PRÉALABLE → vérifié en amont
 *      (`verifierEligibiliteAutofacture`), rappelé dans l'encart de mandat ;
 *   2. mention « Autofacturation » → titre du document ET encart, la constante
 *      `MENTION_AUTOFACTURATION` étant la source des deux ;
 *   3. émission au nom et pour le compte du sous-traitant → encart de mandat +
 *      section « Fournisseur », qui porte SON identité fiscale complète ;
 *   4. droit de contestation → encart, avec la date limite CALCULÉE, jamais un
 *      « sous huitaine » que le lecteur devrait convertir lui-même.
 *
 * ── Pourquoi l'en-tête reste celui de l'organisme ───────────────────────────
 *
 * `QualiopiPage` imprime en pied « Déclaration d'activité non encore
 * enregistrée (art. L.6351-1) » quand le NDA manque. Fabriquer une identité de
 * synthèse à partir du formateur pour la lui passer aurait donc fait AFFIRMER,
 * sur la facture d'un tiers, quelque chose que nous ne savons pas de lui. On
 * garde donc l'en-tête de l'émetteur — ce que nous sommes réellement, le
 * mandataire — et l'identité du vendeur est portée par le corps, en `required`,
 * là où un manque se voit au lieu de disparaître.
 *
 * ── Les mentions de retard sont contre NOUS ─────────────────────────────────
 *
 * ⚠️ Elles ne changent pas de texte, elles changent de sens : sur cette pièce,
 * le débiteur est l'organisme. Les imprimer n'est pas une formalité recopiée,
 * c'est écrire noir sur blanc ce que notre propre retard coûterait. Les omettre
 * « parce qu'elles nous visent » aurait rendu la facture non conforme à
 * l'art. L.441-9 — et aurait été un choix intéressé.
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
import { computeTotauxFacture, mentionTva, TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import {
  brandColor,
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";
import {
  lignesFacture,
  mentionsAutofacture,
  regimeFactureDepuisHonoraires,
  type IdentiteSousTraitant,
  type LigneHonoraires,
} from "@/server/qualiopi/remuneration/autofacture-pieces";
import { DELAI_CONTESTATION_JOURS } from "@/server/qualiopi/remuneration/autofacturation";
import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";

const styles = StyleSheet.create({
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
  totalsBlock: { marginTop: S.xl, alignItems: "flex-end" },
  totalTtcRow: {
    flexDirection: "row",
    width: 240,
    paddingVertical: S.md,
    backgroundColor: brandColor("mocha"),
    paddingHorizontal: S.md,
    marginTop: S.xs,
    borderRadius: S.radius,
  },
  totalTtcLabel: { fontSize: T.lg, flex: 1, color: brandColor("primary-fg"), fontWeight: "bold" },
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
});

export interface AutofactureData {
  /** Numéro de la pièce, série `AXI-AUTOF` (jamais la série des ventes). */
  numero: string;
  dateEmission: string;
  dateEcheance: string;
  /** Date limite de contestation, déjà calculée (jamais « sous 8 jours » brut). */
  contestationAvant: string;
  /** Période des honoraires — la prestation que la facture rémunère. */
  periodeLabel: string;
  sousTraitant: IdentiteSousTraitant;
  /** L'acheteur : nous. */
  identite: OrganismeIdentite;
  lignes: readonly LigneHonoraires[];
  regimeHonoraires: TvaRegimeHonoraires;
  estCopie?: boolean;
  estSpecimen?: boolean;
  specimenMotif?: string;
}

export function AutofactureHonorairesPdf({ data }: { data: AutofactureData }): React.ReactElement {
  const { identite, sousTraitant } = data;
  const regimeTva = regimeFactureDepuisHonoraires(data.regimeHonoraires);
  const lignes = lignesFacture(data.lignes);
  const totaux = computeTotauxFacture(lignes, regimeTva, TAUX_TVA_STANDARD);
  const mentionRegimeTva = mentionTva(regimeTva);
  const mentions = mentionsAutofacture(sousTraitant.nom);

  return (
    <Document>
      <QualiopiPage
        docTitle={mentions.titre}
        docNumber={`N° ${data.numero}`}
        identite={identite}
        eyebrow="Facture établie par mandat de facturation"
        {...(data.estCopie === true ? { estCopie: true } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        {/*
          L'encart de mandat vient EN PREMIER, avant même les identifiants. Un
          lecteur qui ne lirait que le haut de la page doit déjà savoir que cette
          pièce n'a pas été écrite par celui qui la facture.
        */}
        <LegalCallout variant="legal" title={mentions.titre}>
          <Text style={styles.legalLine}>{mentions.pourLeCompte}</Text>
          <Text style={styles.legalLine}>
            {`Le sous-traitant conserve la qualité de fournisseur et demeure seul redevable, le cas échéant, de la TVA mentionnée sur la présente facture.`}
          </Text>
          <Text style={styles.legalLine}>
            {`Cette facture lui est transmise dès son émission. Il dispose de ${DELAI_CONTESTATION_JOURS} jours pour en contester le contenu, soit jusqu'au ${data.contestationAvant} inclus ; à défaut, elle est réputée acceptée. Le mandat de facturation est révocable à tout moment par écrit, sans effet rétroactif sur les factures déjà émises.`}
          </Text>
        </LegalCallout>

        <DocSection title="Informations de facturation">
          <FieldRow label="N° de facture" value={data.numero} required />
          <FieldRow label="Date d'émission" value={data.dateEmission} required />
          <FieldRow label="Période des prestations" value={data.periodeLabel} required />
          <FieldRow label="Date d'échéance" value={data.dateEcheance} required />
        </DocSection>

        {/*
          🔴 LE VENDEUR EST LE FORMATEUR. Toutes ses lignes sont `required` :
          ce sont les mentions obligatoires de SA facture (art. R123-238 C. com.,
          242 nonies A ann. II CGI), et une mention absente d'une facture n'est
          pas une donnée manquante, c'est une IRRÉGULARITÉ. Affichée
          « Non renseigné », elle se corrige avant l'envoi ; omise, personne ne
          la voit — la doctrine de `documents/conformite.ts`, appliquée ici à
          l'identité d'un tiers.
        */}
        <DocSection title="Fournisseur (vendeur)">
          <FieldRow label="Nom" value={sousTraitant.nom} required />
          <FieldRow
            label="Adresse professionnelle"
            value={sousTraitant.adresseProfessionnelle}
            required
          />
          <FieldRow label="SIRET" value={sousTraitant.siret} required />
          {/*
            ⚠️ Le n° de TVA n'est exigé QUE de l'assujetti. Le réclamer en
            franchise 293 B ou en exonération formation afficherait
            « Non renseigné » sur une facture parfaitement régulière — une fausse
            alerte sur une pièce comptable, ce qui apprend à ignorer les vraies.
          */}
          {data.regimeHonoraires === "assujetti_20" ? (
            <FieldRow
              label="N° TVA intracommunautaire"
              value={sousTraitant.numeroTvaIntracom ?? ""}
              required
            />
          ) : null}
          {sousTraitant.email ? <FieldRow label="Email" value={sousTraitant.email} /> : null}
        </DocSection>

        <DocSection title="Client (acheteur)">
          <FieldRow label="Raison sociale" value={identite.raisonSociale} required />
          <FieldRow label="Adresse" value={identite.adresseSiege} required />
          <FieldRow label="SIRET" value={identite.siret} required />
          {identite.tvaIntracom ? (
            <FieldRow label="N° TVA intracommunautaire" value={identite.tvaIntracom} />
          ) : null}
        </DocSection>

        <DocSection title="Détail des honoraires">
          <DataTable
            columns={[
              { key: "designation", header: "Désignation", flex: 4 },
              { key: "total", header: "Montant HT", flex: 1.6, align: "right" },
            ]}
            rows={lignes.map((l) => ({
              designation: l.designation,
              total: formatEurosFromCents(l.prixUnitaireHtCents),
            }))}
          />
        </DocSection>

        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{formatEurosFromCents(totaux.totalHtCents)}</Text>
          </View>
          {totaux.ventilation.map((v) => (
            <View key={v.tauxPercent} style={styles.totalRow}>
              <Text style={styles.totalLabel}>{`TVA (${v.tauxPercent} %)`}</Text>
              <Text style={styles.totalValue}>{formatEurosFromCents(v.montantTvaCents)}</Text>
            </View>
          ))}
          <View style={styles.totalTtcRow}>
            <Text style={styles.totalTtcLabel}>Total TTC</Text>
            <Text style={styles.totalTtcValue}>{formatEurosFromCents(totaux.totalTtcCents)}</Text>
          </View>
        </View>

        <LegalCallout variant="legal" title="Conditions de règlement et mentions légales">
          {mentionRegimeTva ? <Text style={styles.legalLine}>{mentionRegimeTva}</Text> : null}
          {/*
            ⚠️ Ces trois mentions visent l'ACHETEUR — c'est-à-dire nous. Elles
            restent obligatoires (art. L.441-9, L.441-10, D.441-5 C. com.) et
            elles disent ce que NOTRE retard coûterait. Les omettre parce
            qu'elles nous sont défavorables aurait été un choix intéressé, et
            aurait rendu la pièce non conforme.
          */}
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.facturePenalitesRetard}</Text>
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.factureIndemniteRecouvrement}</Text>
          <Text style={styles.legalLine}>{LEGAL_MENTIONS.factureEscompte}</Text>
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
