/**
 * Champs d'un devis CLASSIQUE (lignes libres) calculés à partir de la saisie : total HT, estimation
 * de prise en charge OPCO, mention TVA. EXTRAIT de `createDevisAction` (chantier assistant, fiche
 * S09) sans changement de comportement : la création et la modification d'un brouillon passent par
 * les MÊMES fonctions, donc la même entrée donne les mêmes champs.
 *
 * Ce module n'écrit rien en base (lectures seulement). Montants en CENTIMES.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  dateDeReferenceDevis,
  estimateOpcoCoverage,
  type OrigineEstimationOpco,
} from "@/server/qualiopi/crm/devis";
import {
  anneeParis,
  consommationOpcoAnnee,
} from "@/server/qualiopi/financements/consommation-opco";
import { opcoDuClient } from "@/server/qualiopi/financements/opco-referentiel";
import { effectifDuClient, idccValide } from "@/server/qualiopi/financements/bareme-opco-branche";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { regimeTvaDepuisConfig, mentionTva } from "@/server/qualiopi/legal/tva";

// ─────────────────────────────────────────────────────────────────────────────

export const ligneSchema = z.object({
  designation: z.string().min(1).max(500),
  quantite: z.number().positive(),
  prixUnitaireHtCents: z.number().int().min(0),
  /** Taux de TVA de la ligne (%) — devis mixtes (formation 0 % + conseil 20 %). */
  tauxTvaPercent: z.number().min(0).max(100).optional(),
  /**
   * Référence à une offre du catalogue par son `tier_id` pricing.ts.
   * Ne vaut QUE pour les offres legacy qui en ont un ; les offres du catalogue
   * V2 ont `tier_id = NULL` et ne sont identifiables que par `offreCode`.
   */
  offreTierId: z.string().max(80).optional(),
  /**
   * Code AXI-OFF-NNN de l'offre catalogue — la référence qui vaut pour TOUTES
   * les offres. Sans cette clé, Zod la STRIPPERAIT en silence (l'objet n'est pas
   * `.strict()`) : la ligne serait persistée sans sa référence, sans erreur.
   *
   * Les lignes émises avant ce correctif rangeaient ce code dans `offreTierId`
   * (le <select> émettait `tierId ?? code`), à côté de vrais tierId pour les
   * offres legacy : la colonne est donc MIXTE. Aucune n'est réécrite — un devis
   * émis est une pièce immuable. Tout futur reporting qui joint
   * `lignes->>'offreTierId'` sur `offres_site.tier_id` doit tolérer les deux.
   */
  offreCode: z.string().max(40).optional(),
});

export const FINANCEMENTS = ["direct", "opco", "cpf", "france_travail"] as const;

/** Miroir de l'enum Prisma ActiviteFacturation (sélecteur du Hub). */
export const ACTIVITES = ["formation", "un_a_un", "audit", "implementation", "site_web"] as const;

/**
 * Lot A7d (relecture) — `AAAA-MM-JJ` relu en date UTC et comparé à lui-même, puis
 * borné à [aujourd'hui − 1 an ; aujourd'hui + 3 ans]. Hors bornes, l'année du
 * barème et de l'enveloppe n'a plus de sens (an 1 → année NaN, an 9999).
 */
export function dateDebutSessionPrevueValide(valeur: string, maintenant = new Date()): boolean {
  const d = new Date(`${valeur}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valeur) return false;
  const annee = maintenant.getUTCFullYear();
  const min = new Date(maintenant);
  min.setUTCFullYear(annee - 1);
  const max = new Date(maintenant);
  max.setUTCFullYear(annee + 3);
  return d >= min && d <= max;
}

export const entreeDevisClassiqueSchema = z.object({
  clientId: z.string().uuid(),
  lignes: z.array(ligneSchema).min(1),
  /** Activité facturée (pré-remplit régime TVA + mentions du Hub). */
  activite: z.enum(ACTIVITES).optional(),
  /** Référence client / n° de bon de commande (exigé ETI/grands comptes/OPCO). */
  refClient: z.string().min(1).max(120).optional(),
  financementSuggere: z.enum(FINANCEMENTS).optional(),
  /** Nombre de participants (requis si financementSuggere === "opco"). */
  nbParticipants: z.number().int().min(1).optional(),
  /** Durée en heures (requis si financementSuggere === "opco"). */
  dureeHeures: z.number().positive().optional(),
  /** Modalité OPCO (requis si financementSuggere === "opco"). */
  modaliteOpco: z.enum(["intra", "inter_presentiel", "inter_distanciel"]).optional(),
  /** Enveloppe restante OPCO en centimes (optionnel). */
  opcoEnveloppeRestanteCents: z.number().int().min(0).optional(),
  /**
   * Lot A7d — date de début PRÉVUE de la session (AAAA-MM-JJ, optionnel). Choisit
   * le barème et l'année civile de l'enveloppe ; à défaut, la date de validité.
   */
  dateDebutSessionPrevue: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début prévue : format AAAA-MM-JJ attendu.")
    // Date calendaire réelle (pas de 13e mois ni de 31 février) et bornée :
    // l'action serveur est appelable sans le champ `type="date"` (relecture A7d).
    .refine((v) => dateDebutSessionPrevueValide(v), {
      message:
        "Date de début prévue : indiquez une date réelle, au plus un an en arrière et trois ans en avant.",
    })
    .optional(),
  /**
   * Chantier visio (PR 7) : le projet d'où le devis a été ouvert. Seul le LIEN
   * `projet_devis` est écrit, dans la transaction du devis — jamais une valeur
   * pré-remplie (décision de Will du 29/09 : le devis s'ouvre vide).
   */
  projetId: z.string().uuid().optional(),
});

export type EntreeDevisClassique = z.infer<typeof entreeDevisClassiqueSchema>;

/** Σ Math.round(quantité × prix unitaire HT), en centimes (règle historique de la création). */
export function totalHtClassiqueCents(
  lignes: ReadonlyArray<{ quantite: number; prixUnitaireHtCents: number }>,
): number {
  return lignes.reduce((acc, l) => acc + Math.round(l.quantite * l.prixUnitaireHtCents), 0);
}

export interface EstimationOpcoDevis {
  montantOpcoEstimeCents?: number;
  opcoEstimationOrigine?: OrigineEstimationOpco;
  opcoEstimationAvertissement?: string | undefined;
  resteAChargeCents?: number;
}

/**
 * Estimation OPCO si le financement suggéré est « opco » ET que participants, durée et modalité
 * sont fournis ; sinon objet vide. `dateValidite` sert de date de référence quand aucune date de
 * début de session n'est saisie.
 */
export async function estimationOpcoDevis(
  v: Pick<
    EntreeDevisClassique,
    | "clientId"
    | "financementSuggere"
    | "nbParticipants"
    | "dureeHeures"
    | "modaliteOpco"
    | "opcoEnveloppeRestanteCents"
    | "dateDebutSessionPrevue"
  >,
  montantTotalHtCents: number,
  dateValidite: Date,
): Promise<EstimationOpcoDevis> {
  if (!(
    v.financementSuggere === "opco" &&
    v.nbParticipants !== undefined &&
    v.dureeHeures !== undefined &&
    v.modaliteOpco !== undefined
  )) {
    return {};
  }
  // OPCO du client (Lot 5) : oriente la résolution du barème central versionné.
  // Lot A4 : + IDCC (4 chiffres seulement) et effectif, qui choisissent le barème
  // de branche et de tranche. Lecture SANS `select` : `Client.effectif` arrive
  // par une PR parallèle, `effectifDuClient` le lit s'il existe.
  // Fail-soft : null → estimation sur les réglages par défaut (comportement historique).
  const client = await prisma.client.findUnique({ where: { id: v.clientId } }).catch(() => null);
  const idccClient = idccValide(client?.idcc);
  const effectifClient = effectifDuClient(client);
  // Lot A7d — OPCO par la règle unique (typé d'abord, ancien texte à défaut).
  const opcoClient = opcoDuClient(client);
  // Lot A7d — barème et enveloppe de l'année de la SESSION, pas du jour.
  const asOf = dateDeReferenceDevis({
    debutSessionPrevue:
      v.dateDebutSessionPrevue !== undefined
        ? new Date(`${v.dateDebutSessionPrevue}T12:00:00.000Z`)
        : null,
    dateValidite,
    maintenant: new Date(),
  });
  // Enveloppe : saisie sur le devis, sinon (enveloppe de la fiche client, à
  // défaut plafond annuel du barème) − ce que l'OPCO a déjà pris en charge sur
  // l'année. Consommation illisible → `null` → comportement antérieur.
  const consommation =
    v.opcoEnveloppeRestanteCents === undefined && opcoClient !== null
      ? await consommationOpcoAnnee(v.clientId, opcoClient, anneeParis(asOf))
      : null;
  const coverage = await estimateOpcoCoverage({
    nbParticipants: v.nbParticipants,
    dureeHeures: v.dureeHeures,
    modalite: v.modaliteOpco,
    montantHtCents: montantTotalHtCents,
    asOf,
    ...(v.opcoEnveloppeRestanteCents !== undefined
      ? { enveloppeRestanteCents: v.opcoEnveloppeRestanteCents }
      : {}),
    ...(client?.opcoEnveloppeAnnuelleCents != null
      ? { enveloppeAnnuelleClientCents: client.opcoEnveloppeAnnuelleCents }
      : {}),
    ...(consommation !== null ? { consommationAnnee: consommation } : {}),
    ...(opcoClient !== null ? { opco: opcoClient } : {}),
    ...(idccClient ? { idcc: idccClient } : {}),
    ...(effectifClient !== undefined ? { effectif: effectifClient } : {}),
  });
  return {
    montantOpcoEstimeCents: coverage.montantPriseEnChargeCents,
    opcoEstimationOrigine: coverage.origine,
    opcoEstimationAvertissement: coverage.avertissement,
    resteAChargeCents: coverage.resteAChargeCents,
  };
}

/**
 * 🔴 Audit certification 2026-07-26 (F25) — le régime de TVA se LIT, il ne se décrète pas.
 * `Devis.mentionTva` est NOT NULL et fige le régime de la pièce. `mentionTva()` rend `null` pour
 * « assujetti » — correct pour un PDF, mais pas pour une colonne d'archive : une chaîne vide
 * rendrait « assujetti » et « non renseigné » indiscernables plus tard.
 */
export async function mentionTvaDevisClassique(): Promise<string> {
  const regime = await getQualiopiConfig("regime_tva");
  return mentionTva(regimeTvaDepuisConfig(regime)) ?? LEGAL_MENTIONS.factureTvaAssujetti;
}
