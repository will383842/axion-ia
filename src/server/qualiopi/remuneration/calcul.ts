/**
 * Qualiopi — Moteur PUR de calcul de la rémunération des formateurs.
 *
 * Fonctions PURES (aucun I/O, aucun import Prisma, testables). Comme
 * `trainers/conformite.ts`, ce module travaille sur des TYPES MIROIR de l'enum
 * / du schéma Prisma (posé par ailleurs) afin de rester découplé de l'infra et
 * trivialement testable. Tous les montants sont en CENTIMES d'euro (entiers) :
 * jamais de flottant persisté, arrondi au centime le plus proche à la frontière.
 *
 * ── Pourquoi « salarié » vs « indépendant » change la NATURE, pas le calcul ───
 * Le même barème peut produire deux lignes de sens comptable opposé :
 *   - salarié       → ligne `analytique` : valorisation INDICATIVE du coût
 *     formateur. Le salaire réel est en paie externe ; cette ligne ne sera
 *     JAMAIS « payée » ni déclarée au BPF. Elle sert au pilotage de la marge.
 *   - indépendant   → ligne `honoraire_du` : honoraires RÉELLEMENT dus, que le
 *     sous-traitant facturera et que l'OF paiera (avec sa TVA propre).
 * La nature est SNAPSHOTÉE au calcul (copiée depuis le statut du formateur) :
 * si le formateur passe salarié→indépendant plus tard, les lignes passées ne
 * doivent JAMAIS être reclassées (intangibilité comptable).
 *
 * ── Pourquoi un barème VERSIONNÉ (et jamais « modifié ») ──────────────────────
 * Exigence comptable : on ne réécrit jamais un taux. On CLÔT l'ancienne règle
 * (`effectiveTo`) et on en crée une nouvelle. Une prestation résout la règle en
 * vigueur À SA DATE DE RÉALISATION. Effet garanti et testé : augmenter un taux
 * en septembre ne recalcule JAMAIS les sessions de juin.
 */

/** Miroir de l'enum Prisma `TrainerStatut` (cf. conformite.ts). */
export type TrainerStatutValue = "salarie" | "sous_traitant" | "dirigeant";

/** Modèles de rémunération supportés (miroir enum Prisma `CompensationModel`). */
export type CompensationModel =
  | "taux_journalier" // tarif/jour × nb jours (jours = heures animées / heures par jour)
  | "taux_horaire" // tarif/heure × heures animées réelles
  | "commission_ca_pct" // pourcentage du CA HT de la prestation
  | "forfait_prestation"; // montant fixe, quelle que soit la durée

/** Type de prestation (miroir enum Prisma `PrestationType`). */
export type PrestationType = "formation_collective" | "coaching_1to1" | "audit";

/**
 * Nature comptable de la ligne produite. Découle du STATUT du formateur, pas du
 * modèle de rémunération (cf. en-tête). Snapshotée sur la ligne.
 */
export type FeeLineNature = "analytique" | "honoraire_du";

/**
 * Régime de TVA applicable aux HONORAIRES d'un indépendant. ⚠️ Il dépend du
 * régime fiscal DU FORMATEUR (celui qui facture), PAS de l'OF ni du financeur :
 *   - `franchise_293b`   → 0 % — franchise en base (art. 293 B CGI).
 *   - `exonere_formation`→ 0 % — exonération FPC (art. 261-4-4°a CGI). Base
 *     légale DIFFÉRENTE de la franchise : ne pas confondre les mentions.
 *   - `assujetti_20`     → 20 % — taux normal métropole.
 */
export type TvaRegimeHonoraires = "franchise_293b" | "exonere_formation" | "assujetti_20";

/**
 * Statut d'une prestation, vocabulaire PROPRE au moteur — il n'existe aucun enum
 * Prisma de ce nom. C'est le dénominateur commun des trois sources : il coïncide
 * exactement avec `CoachingSessionStatut`, et vaut `TrainingSessionStatut` moins
 * `en_cours` (que `mapStatutSession` ramène à `planifiee`).
 */
export type PrestationStatut = "planifiee" | "realisee" | "annulee" | "reportee";

/**
 * Une version de règle de rémunération d'un formateur. On ne mute jamais une
 * règle : on la clôt (`effectiveTo`) et on en crée une nouvelle. Les champs de
 * taux sont optionnels car seul celui correspondant au `model` est renseigné.
 */
export interface RegleRemuneration {
  trainerId: string;
  /** `null` = règle globale du formateur (tous types de prestation). */
  prestationType: PrestationType | null;
  /** `null` = règle non liée à une intervention précise. */
  interventionSlug: string | null;
  model: CompensationModel;
  tauxJourneeHtCents?: number;
  tauxHoraireHtCents?: number;
  /** Pourcentage de commission (Decimal Prisma → number). 30 = 30 %. */
  commissionPct?: number;
  forfaitHtCents?: number;
  /** Date d'entrée en vigueur (incluse). */
  effectiveFrom: Date;
  /** Date de clôture (EXCLUE), ou `null` si la règle est toujours en vigueur. */
  effectiveTo: Date | null;
}

/** Journée de formation standard (heures) — sert à convertir heures→jours. */
export const HEURES_PAR_JOUR_DEFAUT = 7;

/** Taux normal de TVA métropole (%), pour un formateur assujetti. */
export const TAUX_TVA_HONORAIRES_ASSUJETTI = 20;

/**
 * Mentions légales de TVA à porter sur la facture d'honoraires du formateur.
 * Wording aligné sur `legal/legal-mentions.ts` pour cohérence documentaire.
 * `assujetti_20` : aucune mention d'exonération (la TVA apparaît normalement).
 */
export const MENTIONS_TVA_HONORAIRES: Record<TvaRegimeHonoraires, string> = {
  franchise_293b: "TVA non applicable, article 293 B du Code Général des Impôts.",
  exonere_formation:
    "Exonéré de TVA en application de l'article 261-4-4°a du Code Général des Impôts — Prestations de formation professionnelle continue.",
  assujetti_20: "",
};

/* ──────────────────────────────────────────────────────────────────────────────
 * 1. Nature de la ligne (snapshot du statut formateur)
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Nature comptable dérivée du statut du formateur. À appeler AU MOMENT du calcul
 * pour figer la nature sur la ligne (voir en-tête : pas de reclassement du passé).
 */
export function natureLigne(statutFormateur: TrainerStatutValue): FeeLineNature {
  // Seul l'indépendant génère des honoraires réellement dus à un tiers. Salarié ET
  // dirigeant sont internes à l'OF → coût analytique indicatif (paie/rémunération hors module).
  return statutFormateur === "sous_traitant" ? "honoraire_du" : "analytique";
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 2. Résolution du barème versionné
 * ────────────────────────────────────────────────────────────────────────────── */

/** Une règle couvre-t-elle `date` ? `effectiveFrom` inclus, `effectiveTo` exclu. */
function couvreDate(regle: RegleRemuneration, date: Date): boolean {
  const t = date.getTime();
  if (regle.effectiveFrom.getTime() > t) return false; // règle future
  if (regle.effectiveTo !== null && regle.effectiveTo.getTime() <= t) return false; // règle close
  return true;
}

/**
 * Spécificité d'une règle vis-à-vis d'une requête (plus grand = plus spécifique).
 * Le `prestationType` pèse plus que l'`interventionSlug` pour respecter l'ordre :
 *   (type + slug) > (type, slug null) > (type null = barème global du formateur).
 */
function specificite(regle: RegleRemuneration): number {
  return (regle.prestationType !== null ? 2 : 0) + (regle.interventionSlug !== null ? 1 : 0);
}

/**
 * Résout la règle en vigueur pour un formateur, un type de prestation, une
 * intervention et une date. Du plus spécifique au plus général ; à spécificité
 * égale, la règle au `effectiveFrom` le plus récent ≤ date gagne. Retourne
 * `null` si aucune règle ne s'applique (l'appelant applique alors le fallback
 * legacy `tarifJourneeHtCents` du formateur).
 *
 * Générique sur `R` : la règle retournée est EXACTEMENT celle passée en entrée,
 * champs supplémentaires compris. Le persisteur peut donc y lire l'`id` de la
 * règle résolue (pour `TrainerFeeLine.ruleId`) sans avoir à la retrouver après
 * coup — une seconde recherche par valeur serait ambiguë entre deux versions
 * d'un même barème.
 */
export function resolveRegle<R extends RegleRemuneration>(
  regles: readonly R[],
  query: {
    trainerId: string;
    prestationType: PrestationType;
    interventionSlug: string | null;
    date: Date;
  },
): R | null {
  const candidates = regles.filter(
    (r) =>
      r.trainerId === query.trainerId &&
      // `null` = joker : la règle s'applique à tous les types / toutes les interventions.
      (r.prestationType === null || r.prestationType === query.prestationType) &&
      (r.interventionSlug === null || r.interventionSlug === query.interventionSlug) &&
      couvreDate(r, query.date),
  );

  let best: R | null = null;
  let bestSpec = -1;
  for (const r of candidates) {
    const spec = specificite(r);
    if (
      spec > bestSpec ||
      // À spécificité égale : effectiveFrom le plus récent ≤ date l'emporte.
      (spec === bestSpec &&
        best !== null &&
        r.effectiveFrom.getTime() > best.effectiveFrom.getTime())
    ) {
      best = r;
      bestSpec = spec;
    }
  }
  return best;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 3. Répartition du CA entre co-animateurs
 * ────────────────────────────────────────────────────────────────────────────── */

/** Un formateur participant à la répartition d'une session co-animée. */
export interface ParticipantCa {
  trainerId: string;
  /** Heures réellement animées par ce formateur (prorata par défaut). */
  heuresAnimees?: number;
  /** Quote-part explicite en % (prioritaire si TOUS les participants en ont une). */
  quotePartPct?: number;
}

/** Montant de CA HT alloué à un formateur (centimes). */
export interface PartCa {
  trainerId: string;
  montantCents: number;
}

/**
 * Répartit un CA HT entre co-animateurs. Priorité aux `quotePartPct` explicites
 * SI tous les participants en déclarent une (sinon prorata des `heuresAnimees`).
 * Robustesse assumée :
 *   - somme des quotes-parts ≠ 100 → normalisée sur la somme réelle (on ne
 *     suppose jamais qu'un opérateur a saisi exactement 100) ;
 *   - 0 heure partout (ou poids total nul) → répartition ÉGALE, faute de mieux ;
 *   - AUCUN centime perdu : les parts sont des `floor`, le reliquat d'arrondi va
 *     au PREMIER participant (choix arbitraire mais déterministe et vérifiable :
 *     somme des parts == total exact).
 */
export function repartirCa(caTotalCents: number, participants: readonly ParticipantCa[]): PartCa[] {
  if (participants.length === 0) return [];

  const useQuote = participants.every(
    (p) => typeof p.quotePartPct === "number" && Number.isFinite(p.quotePartPct),
  );

  let poids = useQuote
    ? participants.map((p) => Math.max(0, p.quotePartPct ?? 0))
    : participants.map((p) => Math.max(0, p.heuresAnimees ?? 0));

  // Poids total nul (aucune heure, ou quotes-parts toutes à 0) → répartition égale.
  if (poids.reduce((a, b) => a + b, 0) <= 0) {
    poids = participants.map(() => 1);
  }
  const poidsTotal = poids.reduce((a, b) => a + b, 0);

  const parts = poids.map((w) => Math.floor((caTotalCents * w) / poidsTotal));
  const reliquat = caTotalCents - parts.reduce((a, b) => a + b, 0);
  // Le reliquat d'arrondi va au premier (invariant : somme des parts == total).
  parts[0] = (parts[0] ?? 0) + reliquat;

  return participants.map((p, i) => ({ trainerId: p.trainerId, montantCents: parts[i] ?? 0 }));
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 4. Calcul du montant HT selon le modèle
 * ────────────────────────────────────────────────────────────────────────────── */

export interface CalculMontantInput {
  regle: RegleRemuneration;
  /** Heures réellement animées par ce formateur sur la prestation. */
  heuresAnimees: number;
  /** Nombre d'heures dans une journée-type (conversion heures→jours). */
  heuresParJour: number;
  /** CA HT servant d'assiette à la commission (déjà alloué à ce formateur). */
  caBaseCents: number;
  /** Forfait négocié pour cette prestation, s'il prime sur celui de la règle. */
  forfait?: number;
}

/**
 * Montant HT dû (centimes, arrondi au centime) selon le modèle de la règle.
 * Défensif : un taux manquant vaut 0 (on ne devine pas un montant). C'est un
 * choix assumé — mieux vaut une ligne à 0 € visiblement anormale qu'un montant
 * inventé.
 */
export function calculerMontantCents(input: CalculMontantInput): number {
  const { regle } = input;
  switch (regle.model) {
    case "taux_journalier": {
      // Jours = heures animées / heures par jour. heuresParJour ≤ 0 → 0 jour
      // (garde-fou contre une division par zéro plutôt qu'un Infinity persisté).
      const jours = input.heuresParJour > 0 ? input.heuresAnimees / input.heuresParJour : 0;
      return Math.round((regle.tauxJourneeHtCents ?? 0) * jours);
    }
    case "taux_horaire":
      return Math.round((regle.tauxHoraireHtCents ?? 0) * input.heuresAnimees);
    case "commission_ca_pct":
      return Math.round((input.caBaseCents * (regle.commissionPct ?? 0)) / 100);
    case "forfait_prestation":
      // Forfait de prestation prioritaire (négociation ponctuelle) sinon celui de la règle.
      return Math.round(input.forfait ?? regle.forfaitHtCents ?? 0);
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 5. TVA sur les honoraires (indépendants uniquement)
 * ────────────────────────────────────────────────────────────────────────────── */

export interface ResultatTva {
  tvaCents: number;
  totalTtcCents: number;
  /** Mention légale à porter sur la facture (vide si assujetti standard). */
  mention: string;
}

/**
 * Calcule la TVA d'un total HT d'honoraires selon le régime DU FORMATEUR.
 * Franchise et exonération sont à 0 % mais portent des mentions légales
 * DISTINCTES (bases juridiques différentes, cf. `MENTIONS_TVA_HONORAIRES`).
 */
export function calculerTva(totalHtCents: number, regime: TvaRegimeHonoraires): ResultatTva {
  const taux = regime === "assujetti_20" ? TAUX_TVA_HONORAIRES_ASSUJETTI : 0;
  const tvaCents = Math.round((totalHtCents * taux) / 100);
  return {
    tvaCents,
    totalTtcCents: totalHtCents + tvaCents,
    mention: MENTIONS_TVA_HONORAIRES[regime],
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 6. Ligne de rémunération complète (avec snapshot)
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Snapshot du barème appliqué, figé sur la ligne. On copie le modèle et le
 * SEUL taux pertinent : une règle relue plus tard (taux modifié = nouvelle
 * version) ne doit pas altérer la lecture d'une ligne déjà émise.
 */
export interface RegleSnapshot {
  model: CompensationModel;
  tauxJourneeHtCents?: number;
  tauxHoraireHtCents?: number;
  commissionPct?: number;
  forfaitHtCents?: number;
}

export interface LigneRemuneration {
  trainerId: string;
  /** Nature comptable figée (analytique = coût indicatif ; honoraire_du = dû réel). */
  nature: FeeLineNature;
  statutPrestation: PrestationStatut;
  /** Snapshot du barème appliqué, ou `null` si aucune règle ni fallback. */
  regleSnapshot: RegleSnapshot | null;
  /** Montant HT (centimes). 0 si prestation annulée/reportée. */
  montantHtCents: number;
  /** TVA (centimes). Toujours 0 pour une ligne analytique (pas de facture). */
  tvaCents: number;
  /** Total TTC (centimes). Égal au HT pour une ligne analytique. */
  totalTtcCents: number;
  /** Mention légale de TVA (vide si analytique ou assujetti standard). */
  mentionTva: string;
}

export interface CalculerLigneInput {
  trainerId: string;
  /** Statut du formateur AU MOMENT du calcul (snapshoté en nature). */
  statutFormateur: TrainerStatutValue;
  /** Règle déjà résolue via `resolveRegle`, ou `null` → fallback legacy. */
  regle: RegleRemuneration | null;
  /** Tarif journée legacy du formateur (fallback ultime), ou `null`. */
  tarifJourneeHtCentsFallback: number | null;
  statutPrestation: PrestationStatut;
  heuresAnimees: number;
  /** Heures par jour ; défaut `HEURES_PAR_JOUR_DEFAUT`. */
  heuresParJour?: number;
  /** CA HT alloué à ce formateur (après `repartirCa`). */
  caBaseCents: number;
  /** Régime TVA du formateur (n'a d'effet que sur une ligne honoraire_du). */
  regimeTva: TvaRegimeHonoraires;
  /** Forfait de prestation négocié (prioritaire sur celui de la règle). */
  forfait?: number;
}

/** Copie le seul taux pertinent du modèle (construction conditionnelle : exactOptional). */
function snapshotRegle(regle: RegleRemuneration): RegleSnapshot {
  const snap: RegleSnapshot = { model: regle.model };
  if (regle.model === "taux_journalier" && regle.tauxJourneeHtCents !== undefined) {
    snap.tauxJourneeHtCents = regle.tauxJourneeHtCents;
  }
  if (regle.model === "taux_horaire" && regle.tauxHoraireHtCents !== undefined) {
    snap.tauxHoraireHtCents = regle.tauxHoraireHtCents;
  }
  if (regle.model === "commission_ca_pct" && regle.commissionPct !== undefined) {
    snap.commissionPct = regle.commissionPct;
  }
  if (regle.model === "forfait_prestation" && regle.forfaitHtCents !== undefined) {
    snap.forfaitHtCents = regle.forfaitHtCents;
  }
  return snap;
}

/**
 * Construit une ligne de rémunération complète pour un formateur sur une
 * prestation. Snapshote la nature et le barème appliqué. Une prestation
 * `annulee` / `reportee` produit un montant 0 (rien n'a été animé) tout en
 * conservant le snapshot du barème qui se serait appliqué (traçabilité).
 */
export function calculerLigne(input: CalculerLigneInput): LigneRemuneration {
  const nature = natureLigne(input.statutFormateur);
  const heuresParJour = input.heuresParJour ?? HEURES_PAR_JOUR_DEFAUT;
  const nonAnime = input.statutPrestation === "annulee" || input.statutPrestation === "reportee";

  // Règle effective : la règle résolue, sinon fallback legacy (tarif journée du
  // formateur) matérialisé en règle synthétique `taux_journalier`.
  let regleEffective: RegleRemuneration | null = input.regle;
  if (regleEffective === null && input.tarifJourneeHtCentsFallback !== null) {
    regleEffective = {
      trainerId: input.trainerId,
      prestationType: null,
      interventionSlug: null,
      model: "taux_journalier",
      tauxJourneeHtCents: input.tarifJourneeHtCentsFallback,
      effectiveFrom: new Date(0),
      effectiveTo: null,
    };
  }

  let montantHtCents = 0;
  if (!nonAnime && regleEffective !== null) {
    const montantInput: CalculMontantInput = {
      regle: regleEffective,
      heuresAnimees: input.heuresAnimees,
      heuresParJour,
      caBaseCents: input.caBaseCents,
    };
    // Construction conditionnelle (exactOptionalPropertyTypes).
    if (input.forfait !== undefined) montantInput.forfait = input.forfait;
    montantHtCents = calculerMontantCents(montantInput);
  }

  // TVA UNIQUEMENT sur les honoraires réels d'un indépendant. Une ligne
  // analytique (salarié) n'est pas facturée : ni TVA, ni mention.
  const tva =
    nature === "honoraire_du"
      ? calculerTva(montantHtCents, input.regimeTva)
      : { tvaCents: 0, totalTtcCents: montantHtCents, mention: "" };

  return {
    trainerId: input.trainerId,
    nature,
    statutPrestation: input.statutPrestation,
    regleSnapshot: regleEffective !== null ? snapshotRegle(regleEffective) : null,
    montantHtCents,
    tvaCents: tva.tvaCents,
    totalTtcCents: tva.totalTtcCents,
    mentionTva: tva.mention,
  };
}
