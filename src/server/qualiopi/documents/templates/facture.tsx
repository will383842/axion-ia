/**
 * Qualiopi — Facture de prestation de formation professionnelle (et AVOIR : même gabarit,
 * `estAvoir`) — version 2, style de la charte 2027 (`charte/v1`).
 *
 * Conformité mentions obligatoires :
 *   - Identité + adresse du siège du vendeur (bandeau + pied via `PageCharte`).
 *   - SIRET / NDA / Qualiopi (carte « Informations de facturation », `required`).
 *   - Date d'émission, date d'échéance, date de réalisation de la prestation
 *     (art. 242 nonies A CGI).
 *   - TVA : mention DÉRIVÉE du régime configuré (`regime_tva`), jamais figée.
 *     Assujetti → aucune mention ; exonération 261-4-4° ou franchise 293 B →
 *     mention correspondante. Voir F25.
 *   - Pénalités de retard (art. L.441-10), indemnité forfaitaire 40 €
 *     (art. D.441-5), absence d'escompte (art. L.441-9) — C. commerce, B2B.
 *
 * 🔑 v2 (18/11/2026) : seule la MISE EN PAGE change. Intitulés, montants, TVA, mentions
 * légales et numérotation sont repris MOT POUR MOT de la v1 (archivée :
 * `archives/facture.v1.tsx`, qui porte aussi l'historique complet des commentaires de
 * conformité F25 / F26 / D9-3-02). Seul le taux de TVA s'écrit à la française (« 5,5 % »).
 * Une facture ou un avoir émis sous la v1 se re-rend par l'archive, jamais par ce fichier
 * (`__tests__/facture-v1-reproductible.spec.tsx`).
 *
 * Montants en centimes d'euro (prixUnitaireHtCents, totalHtCents) pour éviter
 * les erreurs d'arrondi flottant.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatEurosFromCents } from "@/server/qualiopi/documents/base-layout";
import {
  Carte,
  CarteTotaux,
  CHARTE_COULEURS as C,
  CHARTE_ESPACES as E,
  CHARTE_TYPO as T,
  EncadreDoux,
  LigneChamp,
  PageCharte,
  Tableau,
  Titre,
  Tuile,
  type LigneTotal,
} from "@/server/qualiopi/documents/charte/v1";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import {
  computeTotauxFacture,
  mentionTva,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";

const G = T.graisses;

// ============================================================
// Styles spécifiques — palette, espaces et typo : uniquement ceux de la charte
// ============================================================

const styles = StyleSheet.create({
  rangee: { flexDirection: "row", marginBottom: E.ecartCartes },
  separateur: { width: 8 },
  colonne: { flex: 1 },
  sectionTitre: {
    fontSize: T.titre2.taille,
    fontWeight: G.grasse,
    letterSpacing: T.titre2.interlettrage,
    color: C.texte,
    marginTop: 8,
    marginBottom: 6,
  },
  legalLine: {
    fontSize: T.petit.taille,
    color: C.texte,
    lineHeight: T.corps.interligne,
    marginBottom: 4,
  },
  noteRib: {
    fontSize: T.petit.taille,
    color: C.texte,
    marginTop: 4,
  },
});

const FORMAT_TAUX_FR = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
/** Taux affiché à la française : « 5,5 », « 20 », « 2,1 » (le « % » est ajouté par l'appelant). */
const pct = (n: number): string => FORMAT_TAUX_FR.format(n);

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
  /**
   * Le destinataire est-il une PERSONNE PHYSIQUE (particulier, ou beneficiaire
   * facture de son reste a charge) ?
   *
   * 🔴 Ce champ manquait, et c'est tout ce qui manquait : les trois mentions du
   * Code de commerce ENTRE PROFESSIONNELS partaient a un particulier. Il est
   * derive au serveur par `destinataireEstPersonnePhysique()` — jamais decide
   * ici : un gabarit qui interrogerait la base rendrait deux pieces
   * differentes pour la meme facture selon l'endroit d'ou on la regenere.
   *
   * Absent = professionnel, qui est le refus PRUDENT.
   */
  estPersonnePhysique?: boolean;
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
  const estAvoir = data.estAvoir === true;

  const tauxStandard = data.tauxTvaStandardPercent ?? TAUX_TVA_STANDARD;
  const totaux = computeTotauxFacture(data.lignes, data.regimeTva, tauxStandard);
  const tauxLigne = (ligne: LigneFacture): number =>
    typeof ligne.tauxTvaPercent === "number"
      ? ligne.tauxTvaPercent
      : data.regimeTva === "assujetti"
        ? tauxStandard
        : 0;
  const mentionRegimeTva = mentionTva(data.regimeTva);

  // 🔑 Totaux : UNE seule liste, construite UNE fois. Le Total TTC mis en grand par
  // `CarteTotaux` est la dernière ligne de cette liste — la même valeur, jamais un second calcul.
  const lignesTotaux: LigneTotal[] = [
    { libelle: "Total HT", montant: formatEurosFromCents(totaux.totalHtCents) },
    ...totaux.ventilation.map((v) => ({
      libelle:
        totaux.ventilation.length > 1
          ? `TVA ${pct(v.tauxPercent)} % (base ${formatEurosFromCents(v.baseHtCents)})`
          : `TVA (${pct(v.tauxPercent)} %)`,
      montant: formatEurosFromCents(v.montantTvaCents),
    })),
    { libelle: "Total TTC", montant: formatEurosFromCents(totaux.totalTtcCents) },
  ];

  return (
    <Document>
      <PageCharte
        docTitle={estAvoir ? "Avoir" : "Facture"}
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        <Titre>{estAvoir ? "Avoir" : "Facture"}</Titre>

        {/* Tuiles : numéro, dates d'émission et d'échéance (mêmes intitulés qu'en v1) */}
        <View style={styles.rangee}>
          <Tuile libelle={estAvoir ? "N° d'avoir" : "N° de facture"} valeur={data.numero} />
          <View style={styles.separateur} />
          <Tuile libelle="Date d'émission" valeur={data.dateEmission} />
          <View style={styles.separateur} />
          <Tuile libelle="Date d'échéance" valeur={data.dateEcheance} />
        </View>

        {/* Deux cartes côte à côte : identifiants de facturation et client */}
        <View style={styles.rangee}>
          <View style={styles.colonne}>
            {/* Identifiants de facturation — SIRET/NDA en `required` (jamais masqués) */}
            <Carte titre="Informations de facturation">
              <View>
                {estAvoir && data.avoirSurNumero !== undefined && (
                  <LigneChamp label="Avoir sur facture" value={data.avoirSurNumero} required />
                )}
                {estAvoir && data.motifAvoir !== undefined && (
                  <LigneChamp label="Motif de la rectification" value={data.motifAvoir} />
                )}
                {data.refClient !== undefined && data.refClient !== "" && (
                  <LigneChamp label="Référence client / commande" value={data.refClient} />
                )}
                <LigneChamp
                  label="Date de réalisation de la prestation"
                  value={data.periodePrestation ?? data.dateEmission}
                />
                <LigneChamp label="SIRET de l'organisme" value={identite.siret} required />
                {/* F26 / D9-3-02 : forme juridique, capital, RCS, TVA intracom — `required`, jamais
                masqués (une mention absente est une irrégularité, pas une donnée perdue). La TVA
                intracommunautaire n'est exigée qu'en régime assujetti. Historique complet :
                `archives/facture.v1.tsx`. */}
                <LigneChamp
                  label="Forme juridique"
                  value={identite.formeJuridique ?? ""}
                  required
                />
                <LigneChamp label="Capital social" value={identite.capitalSocial ?? ""} required />
                <LigneChamp
                  label="RCS"
                  value={
                    identite.rcsVille
                      ? identite.siren
                        ? `${identite.rcsVille} ${identite.siren}`
                        : identite.rcsVille
                      : ""
                  }
                  required
                />
                {data.regimeTva === "assujetti" ? (
                  <LigneChamp
                    label="N° TVA intracommunautaire"
                    value={identite.tvaIntracom ?? ""}
                    required
                  />
                ) : null}
                {typeof identite.nda === "string" && identite.nda.trim() !== "" ? (
                  <LigneChamp label="N° déclaration activité (NDA)" value={identite.nda.trim()} />
                ) : null}
                {identite.qualiopi ? (
                  <LigneChamp label="Certification Qualiopi" value={identite.qualiopi} />
                ) : null}
              </View>
            </Carte>
          </View>
          <View style={styles.separateur} />
          <View style={styles.colonne}>
            {/* Client — l'adresse est `required` (art. L.441-9 C. com.) : « Non renseigné » plutôt
            qu'une ligne masquée. Le SIRET de l'acheteur reste conditionnel. */}
            <Carte titre="Client" insecable>
              <View>
                <LigneChamp
                  label={
                    data.client.estPersonnePhysique === true ? "Nom et prénom" : "Raison sociale"
                  }
                  value={data.client.raisonSociale}
                  required
                />
                {data.client.siret ? <LigneChamp label="SIRET" value={data.client.siret} /> : null}
                <LigneChamp label="Adresse" value={data.client.adresse ?? ""} required />
                {data.client.numeroTvaIntracom ? (
                  <LigneChamp
                    label="N° TVA intracommunautaire"
                    value={data.client.numeroTvaIntracom}
                  />
                ) : null}
                {data.client.email ? <LigneChamp label="Email" value={data.client.email} /> : null}
              </View>
            </Carte>
          </View>
        </View>

        {/* Détail des prestations */}
        <Text style={styles.sectionTitre} minPresenceAhead={60}>
          Détail des prestations
        </Text>
        <Tableau
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
            tva: `${pct(tauxLigne(ligne))} %`,
            total: formatEurosFromCents(ligne.quantite * ligne.prixUnitaireHtCents),
          }))}
        />

        {/* Totaux — ventilation TVA par taux (régime de TVA appliqué) */}
        <CarteTotaux lignes={lignesTotaux} />

        {/* Subrogation OPCO */}
        {data.subrogationOpco ? (
          <EncadreDoux titre="Subrogation de paiement OPCO">
            <Text style={styles.legalLine}>
              {`Facture libellée à l'OPCO ${data.subrogationOpco.nomOpco} dans le cadre de la subrogation de paiement — N° dossier : ${data.subrogationOpco.numeroDossier}.`}
            </Text>
          </EncadreDoux>
        ) : null}

        {/* RIB */}
        {data.rib ? (
          <Carte titre="Coordonnées bancaires" insecable>
            <View>
              <LigneChamp label="Titulaire" value={data.rib.titulaire} />
              {data.rib.banque ? <LigneChamp label="Banque" value={data.rib.banque} /> : null}
              <LigneChamp label="IBAN" value={data.rib.iban} />
              <LigneChamp label="BIC" value={data.rib.bic} />
              {/* 🔴 La consigne de RÉFÉRENCE, sans laquelle tout rapprochement est une devinette :
                  rendue DANS le bloc RIB (sans coordonnées, la demande n'aurait aucun sens). */}
              <Text style={styles.noteRib}>
                {`Merci de rappeler la référence « ${data.numero} » dans le libellé de votre virement.`}
              </Text>
            </View>
          </Carte>
        ) : null}

        {/* Conditions de règlement + mentions légales obligatoires */}
        <EncadreDoux titre="Conditions de règlement et mentions légales">
          {/* Mention de TVA selon le régime (exonération 261-4-4° ou franchise 293 B). En régime
              assujetti : pas de mention d'exonération, la TVA figure dans les totaux. */}
          {mentionRegimeTva ? <Text style={styles.legalLine}>{mentionRegimeTva}</Text> : null}
          {/* 🔴 Les trois mentions ci-dessous relèvent du Code de commerce ENTRE PROFESSIONNELS
              (L.441-10, D.441-5, L.441-9) : pour un particulier elles sont OMISES, pas
              remplacées — on n'invente pas de texte consumériste ici. */}
          {data.client.estPersonnePhysique === true ? null : (
            <>
              <Text style={styles.legalLine}>{LEGAL_MENTIONS.facturePenalitesRetard}</Text>
              <Text style={styles.legalLine}>{LEGAL_MENTIONS.factureIndemniteRecouvrement}</Text>
              <Text style={styles.legalLine}>{LEGAL_MENTIONS.factureEscompte}</Text>
            </>
          )}
        </EncadreDoux>
      </PageCharte>
    </Document>
  );
}
