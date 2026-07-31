/**
 * Qualiopi — Moteur PUR du run mensuel de rémunération.
 *
 * `calcul.ts` sait combien vaut UNE ligne. Ce module sait QUELLES lignes
 * existent, à quelle PÉRIODE elles se rattachent, et ce qu'on a le droit de
 * réécrire. Il reste pur (aucun I/O, aucun import Prisma) : le persisteur
 * `statements.ts` lit la base, appelle ces fonctions, écrit le résultat.
 *
 * ── Quatre invariants que le code protège ────────────────────────────────────
 * 1. **Le passé validé ne se recalcule pas.** Dès qu'un relevé quitte l'état
 *    `a_valider`, ses lignes sont figées. Relancer le run ne doit pas les
 *    toucher : une correction se fait par une ligne d'ajustement, jamais par une
 *    réécriture silencieuse. C'est `periodeRecalculable`.
 * 2. **On ne paie jamais sur son propre décompte.** `paye` n'est atteignable que
 *    depuis `facture_recue` : un organisme de formation paie sur la facture du
 *    formateur, pas sur le relevé qu'il a lui-même calculé. C'est le gate dur de
 *    `transitionAutorisee`, doublé d'une contrainte applicative côté action.
 * 3. **On ne devine jamais un régime de TVA.** Un formateur indépendant sans
 *    `regimeTvaHonoraires` renseigné ne reçoit PAS de relevé : `construireReleve`
 *    le signale en anomalie. Choisir un régime par défaut reviendrait à inventer
 *    une mention légale sur une facture.
 * 4. **On ne devine jamais un barème.** Sans règle en vigueur NI tarif de repli,
 *    aucune ligne n'est émise : `construireLignesPrestation` lève l'anomalie
 *    `bareme_absent`. Écrire un `model` arbitraire dans une colonne NOT NULL
 *    ferait passer une lacune de paramétrage pour une donnée comptable.
 *
 * ── Anomalies plutôt que zéros silencieux ────────────────────────────────────
 * `calcul.ts` assume qu'un taux manquant vaut 0 : « mieux vaut une ligne à 0 €
 * visiblement anormale qu'un montant inventé ». Rendre ce 0 VISIBLE est le
 * travail du run. Chaque fonction retourne donc ses `Anomalie[]` à côté de son
 * résultat, à charge du persisteur de les remonter à l'opérateur. Une anomalie
 * n'interrompt jamais le run : les autres formateurs sont payés.
 */

import { dayKeyInParis } from "@/lib/calendar-grid";
import {
  calculerLigne,
  calculerTva,
  repartirCa,
  resolveRegle,
  HEURES_PAR_JOUR_DEFAUT,
  type CompensationModel,
  type FeeLineNature,
  type ParticipantCa,
  type PrestationStatut,
  type PrestationType,
  type RegleRemuneration,
  type RegleSnapshot,
  type TrainerStatutValue,
  type TvaRegimeHonoraires,
} from "./calcul";

/** Miroir de l'enum Prisma `TrainingSessionStatut`. */
export type TrainingSessionStatutValue =
  "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";

/** Miroir de l'enum Prisma `FeeLineStatut`. */
export type FeeLineStatut = "previsionnel" | "calcule" | "valide" | "annule";

/** Miroir de l'enum Prisma `StatementStatut`. */
export type StatementStatut =
  "brouillon" | "a_valider" | "valide" | "facture_recue" | "paye" | "annule";

/** Une règle telle qu'elle sort de la base : identifiée. */
export interface RegleIdentifiee extends RegleRemuneration {
  id: string;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 1. Anomalies
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Ce que le run refuse de faire silencieusement.
 *   - `reference_prestation_invalide` : la prestation ne pointe pas exactement
 *     une référence. La contrainte SQL `ck_fee_line_une_seule_prestation` le
 *     rejetterait à l'INSERT ; on l'attrape avant, avec un message exploitable.
 *   - `formateur_inconnu`             : affectation vers un formateur absent du
 *     contexte de lecture. Incohérence de requête, jamais un cas métier.
 *   - `bareme_absent`                 : ni règle en vigueur, ni tarif de repli.
 *   - `heures_absentes`               : modèle basé sur le temps, mais aucune
 *     heure animée connue → le montant serait 0 € sans que personne ne le voie.
 *   - `assiette_ca_absente`           : commission sur un CA nul. Symétrique du
 *     précédent : un coaching dont le CA n'est pas rattachable à la séance
 *     (le montant vit sur le CONTRAT, qui couvre N séances) rémunérerait le
 *     formateur à 0 € sans un mot.
 *   - `regime_tva_absent`             : indépendant sans régime de TVA (inv. 3).
 */
export type MotifAnomalie =
  | "reference_prestation_invalide"
  | "formateur_inconnu"
  | "bareme_absent"
  | "heures_absentes"
  | "assiette_ca_absente"
  | "regime_tva_absent";

/** Références d'une prestation. Exactement une est renseignée (CHECK SQL). */
export interface PrestationRef {
  type: PrestationType;
  sessionId: string | null;
  coachingSessionId: string | null;
  bookingId: string | null;
  auditMissionId: string | null;
}

export interface Anomalie {
  motif: MotifAnomalie;
  /** Formateur concerné, ou `null` si l'anomalie porte sur la prestation entière. */
  trainerId: string | null;
  /** Prestation concernée, ou `null` pour une anomalie de niveau relevé. */
  prestation: PrestationRef | null;
}

/**
 * Miroir exact de `ck_fee_line_une_seule_prestation` : une ligne se rattache à
 * une session collective, OU un coaching, OU un booking — jamais zéro, jamais deux.
 */
export function referenceUnique(ref: PrestationRef): boolean {
  const refs = [ref.sessionId, ref.coachingSessionId, ref.bookingId, ref.auditMissionId];
  return refs.filter((r) => r !== null).length === 1;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 2. Période de rattachement
 * ────────────────────────────────────────────────────────────────────────────── */

export interface Periode {
  /** Année civile. */
  year: number;
  /** Mois 1-12 (et non 0-11 : la contrainte SQL `periode_month` borne 1..12). */
  month: number;
}

/**
 * Période de rattachement d'une prestation, calculée **à Paris** et non en UTC.
 * Une session qui commence le 1er août à 00h30 heure de Paris est stockée
 * `2026-07-31T22:30:00Z` : la rattacher à juillet la ferait apparaître sur le
 * relevé du mois précédent — et sur la mauvaise facture. `dayKeyInParis`
 * (déjà utilisé par le calendrier) résout ce piège une fois pour toutes.
 */
export function periodeDeRattachement(date: Date): Periode {
  const [y, m] = dayKeyInParis(date).split("-");
  return { year: Number(y), month: Number(m) };
}

/**
 * La prestation datée `date` appartient-elle à `periode` (au sens de Paris) ?
 *
 * Volontairement un PRÉDICAT et non des bornes UTC : convertir « le mois d'août
 * à Paris » en un intervalle UTC demande de résoudre le décalage horaire aux
 * deux extrémités (il change en mars et en octobre). Le persisteur interroge la
 * base sur un intervalle UTC ÉLARGI d'un jour de chaque côté — un filet large,
 * jamais faux — puis affine avec ce prédicat, qui lui est exact par construction.
 */
export function appartientALaPeriode(date: Date, periode: Periode): boolean {
  const p = periodeDeRattachement(date);
  return p.year === periode.year && p.month === periode.month;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 3. Statuts et transitions
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Ramène le statut d'une session de formation au vocabulaire du moteur.
 * `en_cours` devient `planifiee` : la session n'est pas terminée, donc rien
 * n'est encore dû. La ligne existe (prévisionnel, pour le pilotage) mais elle
 * n'engage pas — le montant se figera au passage en `realisee`.
 */
export function mapStatutSession(statut: TrainingSessionStatutValue): PrestationStatut {
  return statut === "en_cours" ? "planifiee" : statut;
}

/**
 * Miroir de l'enum Prisma `CoachingSessionStatut`. Il n'a PAS de `en_cours` : un
 * coaching est court, il ne se pilote pas en cours de séance.
 */
export type CoachingSessionStatutValue = "planifiee" | "realisee" | "annulee" | "reportee";

/**
 * Statut d'un coaching dans le vocabulaire du moteur. L'identité, et non
 * l'oubli : `CoachingSessionStatut` coïncide exactement avec `PrestationStatut`.
 * Cette fonction existe pour que le persisteur n'ait pas à le SUPPOSER — si
 * l'enum Prisma gagne un état un jour, le compilateur cassera ici, à un endroit
 * qui porte l'explication, plutôt que silencieusement au fond du run.
 */
export function mapStatutCoaching(statut: CoachingSessionStatutValue): PrestationStatut {
  return statut;
}

/** Miroir de l'enum Prisma `AuditMissionStatut` (identique à TrainingSessionStatut). */
export type AuditMissionStatutValue =
  "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";

/**
 * Statut d'un audit dans le vocabulaire du moteur. `en_cours` → `planifiee` :
 * l'audit n'est pas terminé, rien n'est encore dû (comme une session collective).
 */
export function mapStatutAudit(statut: AuditMissionStatutValue): PrestationStatut {
  return statut === "en_cours" ? "planifiee" : statut;
}

/**
 * Statut de la ligne déduit du statut de la prestation. Une prestation annulée
 * ou reportée produit une ligne `annule` à 0 € plutôt qu'aucune ligne : on garde
 * la trace que le formateur y était affecté (et le barème qui se serait
 * appliqué), sans qu'elle pèse sur le relevé.
 *
 * `valide` n'est jamais produit ici : une ligne n'est figée qu'au moment où le
 * relevé qui la porte est validé — c'est une transition de relevé, pas un état
 * que le calcul peut déduire d'une prestation.
 */
export function statutLigne(statutPrestation: PrestationStatut): FeeLineStatut {
  switch (statutPrestation) {
    case "realisee":
      return "calcule";
    case "planifiee":
      return "previsionnel";
    case "annulee":
    case "reportee":
      return "annule";
  }
}

/**
 * Transitions autorisées du relevé. `paye` n'est atteignable QUE depuis
 * `facture_recue` (invariant 2). `facture_recue → valide` reste ouvert : une
 * facture non conforme se rejette, on ne bloque pas l'opérateur dans un cul-de-sac.
 * `paye` et `annule` sont terminaux — un paiement ne se « dé-fait » pas ; une
 * erreur se corrige par une ligne d'ajustement sur la période suivante.
 */
const TRANSITIONS: Record<StatementStatut, readonly StatementStatut[]> = {
  brouillon: ["a_valider", "annule"],
  a_valider: ["valide", "brouillon", "annule"],
  valide: ["facture_recue", "a_valider", "annule"],
  facture_recue: ["paye", "valide", "annule"],
  paye: [],
  annule: [],
};

export function transitionAutorisee(from: StatementStatut, to: StatementStatut): boolean {
  return TRANSITIONS[from].includes(to);
}

/** États atteignables depuis `from` (pour n'offrir que des boutons légaux à l'UI). */
export function transitionsPossibles(from: StatementStatut): readonly StatementStatut[] {
  return TRANSITIONS[from];
}

/** Un état terminal ne mène nulle part : le relevé est clos, dans un sens ou l'autre. */
export function estStatutTerminal(statut: StatementStatut): boolean {
  return TRANSITIONS[statut].length === 0;
}

/**
 * Un relevé encore recalculable par le run mensuel. Au-delà de `a_valider`, les
 * montants ont été relus par un humain (voire facturés, voire payés) : le run
 * doit les laisser strictement intacts (invariant 1).
 *
 * `null` = aucun relevé n'existe encore pour cette période → recalcul libre.
 */
export function periodeRecalculable(statutReleve: StatementStatut | null): boolean {
  return statutReleve === null || statutReleve === "brouillon" || statutReleve === "a_valider";
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 4. Construction des lignes d'une prestation
 * ────────────────────────────────────────────────────────────────────────────── */

/** Le formateur, tel que le calcul a besoin de le connaître. */
export interface FormateurContexte {
  trainerId: string;
  statut: TrainerStatutValue;
  /** Tarif journée legacy, fallback quand aucune règle ne couvre la date. */
  tarifJourneeHtCentsFallback: number | null;
  /** `null` = non renseigné → le formateur n'aura pas de relevé (invariant 3). */
  regimeTva: TvaRegimeHonoraires | null;
}

/** Un formateur affecté à une prestation. */
export interface AffectationPrestation extends ParticipantCa {
  /** Heures réellement animées. Défaut = `dureeHeures` de la prestation. */
  heuresAnimees?: number;
}

/** Une prestation à valoriser, quelle que soit sa nature. */
export interface PrestationACalculer extends PrestationRef {
  /** Date de réalisation : résout le barème ET la période de rattachement. */
  date: Date;
  statut: PrestationStatut;
  interventionSlug: string | null;
  /**
   * Durée de la prestation en heures. Sert de défaut aux heures animées : un
   * formateur seul sur une session de 7 h a animé 7 h, personne ne devrait avoir
   * à le ressaisir. Une co-animation renseigne les heures de chacun.
   */
  dureeHeures: number;
  /** CA HT total de la prestation, assiette des commissions. 0 si inconnu. */
  caTotalCents: number;
  affectations: readonly AffectationPrestation[];
}

/** Une ligne prête à persister dans `TrainerFeeLine` (colonnes du schéma). */
export interface LigneAPersister {
  trainerId: string;
  prestationType: PrestationType;
  sessionId: string | null;
  coachingSessionId: string | null;
  bookingId: string | null;
  auditMissionId: string | null;
  ruleId: string | null;
  model: CompensationModel;
  nature: FeeLineNature;
  /**
   * Le SEUL taux monétaire pertinent du modèle, en centimes : tarif journée,
   * tarif horaire, ou forfait. `null` pour une commission (le taux y est un
   * pourcentage, porté par `commissionPctSnapshot`). Colonne unique volontaire :
   * le `model` dit comment la relire.
   */
  tauxSnapshotCents: number | null;
  commissionPctSnapshot: number | null;
  heures: number | null;
  nbJours: number | null;
  caBaseCents: number;
  montantHtCents: number;
  statut: FeeLineStatut;
  periodeYear: number;
  periodeMonth: number;
}

export interface ResultatLignes {
  lignes: LigneAPersister[];
  anomalies: Anomalie[];
}

/** Modèles dont le montant dépend du temps animé (un 0 h y produit un 0 €). */
const MODELES_TEMPORELS: readonly CompensationModel[] = ["taux_journalier", "taux_horaire"];

/**
 * Extrait du SNAPSHOT le seul taux monétaire que la colonne accueille.
 *
 * On lit le snapshot et non la règle résolue : quand aucune règle ne couvre la
 * date, `calculerLigne` fabrique une règle de repli à partir du tarif journée du
 * formateur, et c'est CE taux qui a produit le montant. Lire la règle résolue
 * (nulle) écrirait un montant sans le taux qui l'explique.
 */
function tauxMonetaireCents(snapshot: RegleSnapshot): number | null {
  switch (snapshot.model) {
    case "taux_journalier":
      return snapshot.tauxJourneeHtCents ?? null;
    case "taux_horaire":
      return snapshot.tauxHoraireHtCents ?? null;
    case "forfait_prestation":
      return snapshot.forfaitHtCents ?? null;
    case "commission_ca_pct":
      return null; // porté par commissionPctSnapshot
  }
}

/** Arrondi au centième, comme le fera `Decimal(6,2)` en base. */
function deuxDecimales(n: number): number {
  return Math.round(n * 100) / 100;
}

/** `PrestationRef` seule, pour étiqueter une anomalie. */
function refDe(p: PrestationACalculer): PrestationRef {
  return {
    type: p.type,
    sessionId: p.sessionId,
    coachingSessionId: p.coachingSessionId,
    bookingId: p.bookingId,
    auditMissionId: p.auditMissionId,
  };
}

/**
 * Construit les lignes de rémunération de TOUS les formateurs d'une prestation.
 *
 * Le CA est réparti AVANT le calcul (une commission de 30 % sur une session
 * co-animée porte sur la part du co-animateur, pas sur le CA entier — sinon
 * deux formateurs toucheraient 30 % chacun du même chiffre). `repartirCa`
 * garantit qu'aucun centime ne se perd dans l'arrondi.
 *
 * Une prestation sans affectation ne produit aucune ligne : silence volontaire,
 * ce n'est pas une anomalie (session pas encore staffée).
 */
export function construireLignesPrestation(
  prestation: PrestationACalculer,
  regles: readonly RegleIdentifiee[],
  formateurs: ReadonlyMap<string, FormateurContexte>,
  heuresParJour: number = HEURES_PAR_JOUR_DEFAUT,
): ResultatLignes {
  const anomalies: Anomalie[] = [];

  // Garde AVANT tout calcul : une prestation mal référencée produirait des
  // lignes que `ck_fee_line_une_seule_prestation` rejetterait à l'INSERT.
  if (!referenceUnique(prestation)) {
    anomalies.push({
      motif: "reference_prestation_invalide",
      trainerId: null,
      prestation: refDe(prestation),
    });
    return { lignes: [], anomalies };
  }
  if (prestation.affectations.length === 0) return { lignes: [], anomalies };

  const periode = periodeDeRattachement(prestation.date);
  const nonAnime = prestation.statut === "annulee" || prestation.statut === "reportee";

  // Heures par défaut résolues AVANT la répartition : le prorata d'une
  // co-animation doit voir les mêmes heures que le calcul du montant.
  const heuresDe = (a: AffectationPrestation): number => a.heuresAnimees ?? prestation.dureeHeures;
  const participants: ParticipantCa[] = prestation.affectations.map((a) => {
    const p: ParticipantCa = { trainerId: a.trainerId, heuresAnimees: heuresDe(a) };
    // Construction conditionnelle (exactOptionalPropertyTypes) : une quote-part
    // absente doit le rester — `repartirCa` n'utilise les quotes-parts que si
    // TOUS les participants en déclarent une.
    if (a.quotePartPct !== undefined) p.quotePartPct = a.quotePartPct;
    return p;
  });

  const parts = repartirCa(prestation.caTotalCents, participants);
  const caParFormateur = new Map(parts.map((p) => [p.trainerId, p.montantCents]));

  const lignes: LigneAPersister[] = [];
  for (const affectation of prestation.affectations) {
    const formateur = formateurs.get(affectation.trainerId);
    // Formateur absent du contexte = incohérence de lecture, jamais un cas
    // métier. On ne lui invente pas un statut (donc une nature comptable).
    if (formateur === undefined) {
      anomalies.push({
        motif: "formateur_inconnu",
        trainerId: affectation.trainerId,
        prestation: refDe(prestation),
      });
      continue;
    }

    const regle = resolveRegle(regles, {
      trainerId: affectation.trainerId,
      prestationType: prestation.type,
      interventionSlug: prestation.interventionSlug,
      date: prestation.date,
    });

    const heures = heuresDe(affectation);
    const caBaseCents = caParFormateur.get(affectation.trainerId) ?? 0;

    const ligne = calculerLigne({
      trainerId: affectation.trainerId,
      statutFormateur: formateur.statut,
      regle,
      tarifJourneeHtCentsFallback: formateur.tarifJourneeHtCentsFallback,
      statutPrestation: prestation.statut,
      heuresAnimees: heures,
      heuresParJour,
      caBaseCents,
      // `TrainerFeeLine` ne porte AUCUNE colonne de TVA : la TVA se calcule au
      // niveau du relevé (`construireReleve`), sur le total de la période et
      // avec le régime réel du formateur. Le régime passé ici n'influence donc
      // rien de ce qui sera persisté — le montant HT n'en dépend pas.
      regimeTva: formateur.regimeTva ?? "franchise_293b",
    });

    // Pas de snapshot ⇒ ni règle en vigueur, ni tarif de repli. Écrire un
    // `model` arbitraire dans une colonne NOT NULL maquillerait une lacune de
    // paramétrage en donnée comptable : aucune ligne, une anomalie (invariant 4).
    const snapshot = ligne.regleSnapshot;
    if (snapshot === null) {
      anomalies.push({
        motif: "bareme_absent",
        trainerId: affectation.trainerId,
        prestation: refDe(prestation),
      });
      continue;
    }

    // Un modèle au temps sans heures produit un 0 € parfaitement silencieux.
    // Sur une prestation annulée/reportée, ce 0 est normal : rien n'a été animé.
    if (!nonAnime && MODELES_TEMPORELS.includes(snapshot.model) && heures <= 0) {
      anomalies.push({
        motif: "heures_absentes",
        trainerId: affectation.trainerId,
        prestation: refDe(prestation),
      });
    }

    // Symétrique : une commission sur une assiette nulle vaut 0 €. C'est le cas
    // d'un coaching, dont le montant vit sur le CONTRAT (N séances) et n'est pas
    // rattachable à une séance. Mieux vaut le crier que payer 0 € en silence.
    if (!nonAnime && snapshot.model === "commission_ca_pct" && caBaseCents <= 0) {
      anomalies.push({
        motif: "assiette_ca_absente",
        trainerId: affectation.trainerId,
        prestation: refDe(prestation),
      });
    }

    const aDesHeures = heures > 0;
    lignes.push({
      trainerId: affectation.trainerId,
      prestationType: prestation.type,
      sessionId: prestation.sessionId,
      coachingSessionId: prestation.coachingSessionId,
      bookingId: prestation.bookingId,
      auditMissionId: prestation.auditMissionId,
      ruleId: regle?.id ?? null,
      model: snapshot.model,
      nature: ligne.nature,
      tauxSnapshotCents: tauxMonetaireCents(snapshot),
      commissionPctSnapshot: snapshot.commissionPct ?? null,
      heures: aDesHeures ? heures : null,
      nbJours:
        snapshot.model === "taux_journalier" && aDesHeures && heuresParJour > 0
          ? deuxDecimales(heures / heuresParJour)
          : null,
      caBaseCents,
      montantHtCents: ligne.montantHtCents,
      statut: statutLigne(prestation.statut),
      periodeYear: periode.year,
      periodeMonth: periode.month,
    });
  }
  return { lignes, anomalies };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 5. Relevé mensuel
 * ────────────────────────────────────────────────────────────────────────────── */

export interface TotauxReleve {
  totalHtCents: number;
  tvaCents: number;
  totalTtcCents: number;
  mentionTva: string;
}

/**
 * Statuts de ligne qui pèsent sur un relevé — c'est-à-dire ce qui est DÛ.
 * `previsionnel` en est exclu : une prestation non réalisée n'est pas due, et un
 * relevé sert au formateur à facturer. Ces lignes-là alimentent la vue
 * prévisionnelle du cockpit, pas la facture. `annule` est exclu par nature.
 */
const STATUTS_LIGNE_DUS: readonly FeeLineStatut[] = ["calcule", "valide"];

/**
 * Une ligne qui entre dans le total d'un relevé d'honoraires — et donc la seule
 * qu'on rattache (`statementId`) au relevé qui la facture.
 */
export function estLigneDue(ligne: Pick<LigneAPersister, "nature" | "statut">): boolean {
  // `analytique` = salarié : valorisation d'un coût, jamais un dû. L'inclure
  // reviendrait à facturer un salaire.
  return ligne.nature === "honoraire_du" && STATUTS_LIGNE_DUS.includes(ligne.statut);
}

/**
 * Totaux d'un relevé à partir de ses lignes.
 *
 * La TVA s'applique au TOTAL de la période, pas ligne à ligne : arrondir chaque
 * ligne puis sommer dériverait de quelques centimes du montant qui figurera sur
 * la facture du formateur.
 */
export function totauxReleve(
  lignes: readonly Pick<LigneAPersister, "nature" | "statut" | "montantHtCents">[],
  regime: TvaRegimeHonoraires,
): TotauxReleve {
  const totalHtCents = lignes.filter(estLigneDue).reduce((total, l) => total + l.montantHtCents, 0);

  const tva = calculerTva(totalHtCents, regime);
  return {
    totalHtCents,
    tvaCents: tva.tvaCents,
    totalTtcCents: tva.totalTtcCents,
    mentionTva: tva.mention,
  };
}

/** Un relevé prêt à persister dans `TrainerStatement` (colonnes du schéma). */
export interface ReleveAPersister {
  trainerId: string;
  periodeYear: number;
  periodeMonth: number;
  statut: StatementStatut;
  /** Régime SNAPSHOTÉ : le relevé garde le régime du jour de son calcul. */
  tvaRegime: TvaRegimeHonoraires;
  totalHtCents: number;
  tvaCents: number;
  totalTtcCents: number;
}

export interface ResultatReleve {
  /** `null` = aucun relevé à émettre pour ce formateur sur cette période. */
  releve: ReleveAPersister | null;
  anomalies: Anomalie[];
}

/**
 * Relevé mensuel d'un formateur à partir de ses lignes de la période.
 *
 * Trois raisons de ne rien émettre, dont une seule est une anomalie :
 *   - **interne** (salarié ou dirigeant-formateur) → jamais de relevé (ses lignes
 *     sont analytiques). Cas normal, silencieux : un interne est payé par la paie
 *     ou sa rémunération de dirigeant, pas par une facture. Le garde teste
 *     `!== "sous_traitant"` pour rester aligné sur `natureLigne` (cf. calcul.ts) :
 *     seul un tiers génère un honoraire réellement dû.
 *   - **aucune ligne due** → rien à facturer ce mois-ci (que du prévisionnel, de
 *     l'annulé, ou rien). Cas normal : un relevé à 0 € serait du bruit, et se
 *     heurterait à l'unicité `(trainer, année, mois)` au prochain run.
 *   - **indépendant sans régime de TVA** → ANOMALIE (invariant 3). On ne choisit
 *     pas de régime par défaut : la mention légale portée sur la facture dépend
 *     du régime, et `franchise_293b` comme `exonere_formation` donnent 0 % sur
 *     des bases juridiques différentes. Deviner, c'est inventer une mention.
 *
 * Le relevé naît en `brouillon` : il devra remonter la chaîne de
 * `transitionAutorisee` avant tout paiement.
 */
export function construireReleve(
  formateur: FormateurContexte,
  periode: Periode,
  lignes: readonly Pick<LigneAPersister, "nature" | "statut" | "montantHtCents">[],
): ResultatReleve {
  if (formateur.statut !== "sous_traitant") return { releve: null, anomalies: [] };
  if (!lignes.some(estLigneDue)) return { releve: null, anomalies: [] };

  if (formateur.regimeTva === null) {
    return {
      releve: null,
      anomalies: [{ motif: "regime_tva_absent", trainerId: formateur.trainerId, prestation: null }],
    };
  }

  const totaux = totauxReleve(lignes, formateur.regimeTva);
  return {
    releve: {
      trainerId: formateur.trainerId,
      periodeYear: periode.year,
      periodeMonth: periode.month,
      statut: "brouillon",
      tvaRegime: formateur.regimeTva,
      totalHtCents: totaux.totalHtCents,
      tvaCents: totaux.tvaCents,
      totalTtcCents: totaux.totalTtcCents,
    },
    anomalies: [],
  };
}
