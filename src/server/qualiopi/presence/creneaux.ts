/**
 * Génération des créneaux planifiés d'une session de formation.
 *
 * Deux régimes, et le premier doit toujours l'emporter :
 *
 * 1. **Journées DÉCLARÉES** (`jours`, décision D14) — la session dit quels jours
 *    elle est réellement animée, et à quelles heures. Rien n'est déduit.
 * 2. **Repli** sur `dateDebut..dateFin` — comportement historique, conservé pour
 *    les sessions qui n'ont pas encore déclaré leurs journées.
 *
 * Le repli n'est correct que si les journées se suivent. Or elles ne se suivent
 * pas toujours : un parcours de 4 journées réparties sur 3 mois y produit 66
 * jours ouvrés au lieu de 4, soit un dénominateur multiplié par 16 et un taux de
 * présence à ≈ 3 %. C'est pour cela que le repli est un repli, et non le mode
 * normal — et que `sessionTropEtaleePourLeRepli` existe.
 *
 * Aucun import Prisma / accès DB.
 */

import type { CreneauPlan, DemiJourneeLabel } from "./types";
import { parisDateISO, parisDateLabel } from "./time";

/** Durée journalière par défaut en heures (7 h de formation = 420 min/jour). */
const HEURES_PAR_JOUR_DEFAUT = 7;

/** Plafond horaire journalier — miroir de la borne Zod de `generateSessionCreneauxSchema`. */
const HEURES_PAR_JOUR_MAX = 12;

/**
 * Bascule matin / après-midi.
 *
 * ⚠️ C'est une CONVENTION, pas une donnée : la table ne déclare les horaires
 * qu'au grain de la journée. Elle ne sert qu'à décider si une journée courte
 * produit un créneau ou deux — jamais à inventer l'heure d'un créneau, qui
 * porte toujours les horaires RÉELS de sa journée.
 */
const PIVOT_DEMI_JOURNEE = "13:00";

/**
 * Écart au-delà duquel le repli `dateDebut..dateFin` n'est plus crédible.
 *
 * 31 jours : au-delà, une session sans journées déclarées est presque
 * certainement un parcours étalé, et générer les créneaux de tous les jours
 * ouvrés traversés produirait un dénominateur faux. Mieux vaut refuser et
 * demander la saisie que produire des dizaines de créneaux en silence.
 */
export const ECART_MAX_REPLI_JOURS = 31;

/** Journée réellement animée, telle que déclarée dans `session_jours`. */
export interface JourSession {
  /** Jour civil ISO `YYYY-MM-DD` (heure de Paris). */
  date: string;
  /** Horaires RÉELS de la journée, `HH:MM`. */
  heureDebut: string;
  heureFin: string;
}

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Vrai si la session ne déclare aucune journée ET s'étale trop pour que le
 * repli soit honnête.
 *
 * Exposée séparément parce que la décision d'ALERTER appartient à l'appelant :
 * une fonction pure ne doit pas décider seule d'interrompre un flux admin.
 */
export function sessionTropEtaleePourLeRepli(input: {
  dateDebut: Date;
  dateFin: Date;
  jours?: JourSession[] | undefined;
}): boolean {
  if (input.jours !== undefined && input.jours.length > 0) return false;
  const debut = new Date(`${parisDateISO(input.dateDebut)}T00:00:00Z`).getTime();
  const fin = new Date(`${parisDateISO(input.dateFin)}T00:00:00Z`).getTime();
  const ecartJours = Math.round((fin - debut) / (24 * 60 * 60 * 1000));
  return ecartJours > ECART_MAX_REPLI_JOURS;
}

/**
 * Génère la liste des créneaux planifiés pour une session.
 *
 * - Un créneau par demi-journée (matin + après-midi) pour chaque **jour ouvré**
 *   entre `dateDebut` et `dateFin` inclus.
 * - Si `dateDebut === dateFin` (session < 1 jour), un seul jour est produit.
 * - Les dates sont calculées en fuseau Europe/Paris pour éviter les décalages
 *   DST autour de minuit UTC.
 *
 * Les samedis et dimanches **traversés** sont exclus : une session du vendredi au
 * lundi représente 2 jours de formation, pas 4. Sans ce filtre, les créneaux du
 * week-end — jamais cochés — divisaient le taux de présence et déclenchaient des
 * attestations « partielles » à tort (seuils 80 % / 60 %, cf. `taux.ts`).
 *
 * Les BORNES sont en revanche toujours conservées, même en week-end : une session
 * qui commence ou finit un samedi le fait délibérément, et supprimer ces jours
 * rendrait la présence impossible à prouver sur des journées réellement animées.
 * `inclureWeekends` force la conservation de toute la plage.
 *
 * ⭐ **Si `jours` est fourni, tout ce qui précède ne s'applique pas** : les
 * journées déclarées sont retenues telles quelles, y compris un samedi — une
 * journée qu'on a pris la peine de déclarer est animée par définition, il n'y a
 * plus rien à deviner. Et les horaires déclarés décident si la journée produit
 * une demi-journée ou deux : une matinée seule ne doit pas produire un créneau
 * d'après-midi que personne ne signera jamais.
 *
 * Durée : `heuresParJour` prime ; sinon `dureeTotaleHeures` est **répartie sur les
 * demi-journées retenues** ; sinon 7 h/jour. ⚠️ Ne JAMAIS passer une durée totale de
 * session dans `heuresParJour` : c'était le bug corrigé ici — une session de 2 jours
 * / 14 h produisait 28 h prévues, donc un taux de présence divisé par 2 et des
 * attestations refusées à tort.
 *
 * @param input.dateDebut          - Début de la session (n'importe quelle heure).
 * @param input.dateFin            - Fin de la session (n'importe quelle heure).
 * @param input.jours              - Journées RÉELLEMENT animées (D14). Prioritaire sur tout le reste.
 * @param input.heuresParJour      - Heures effectives par jour (prioritaire sur la durée totale).
 * @param input.dureeTotaleHeures  - Durée TOTALE de la session, répartie sur les demi-journées retenues.
 * @param input.inclureWeekends    - Force l'inclusion des samedis/dimanches (défaut false). Ignoré si `jours`.
 *
 * @throws Si une journée déclarée porte une date ou des horaires malformés.
 *         Volontaire : le domaine lève au lieu de coercer (cf. `canonical.ts`).
 *         Une journée silencieusement écartée fausserait le dénominateur sans
 *         que personne ne le voie — exactement le bug qu'on corrige.
 */
export function genererCreneaux(input: {
  dateDebut: Date;
  dateFin: Date;
  jours?: JourSession[];
  heuresParJour?: number;
  dureeTotaleHeures?: number;
  inclureWeekends?: boolean;
}): CreneauPlan[] {
  const declarees = input.jours !== undefined && input.jours.length > 0;

  // ── Quelles demi-journées existent, et avec quels horaires réels ? ──
  const plan: Array<{ iso: string; demiJournee: DemiJourneeLabel; jour: JourSession | null }> = [];

  if (declarees) {
    for (const jour of trierEtDedupliquer(input.jours as JourSession[])) {
      for (const demiJournee of demiJourneesDe(jour)) {
        plan.push({ iso: jour.date, demiJournee, jour });
      }
    }
  } else {
    const tousLesJours: string[] = [];
    let courant = parseDateISO(parisDateISO(input.dateDebut));
    const fin = parseDateISO(parisDateISO(input.dateFin));
    while (courant <= fin) {
      tousLesJours.push(toISODate(courant));
      courant = new Date(courant.getTime() + 24 * 60 * 60 * 1000);
    }
    const joursRetenus =
      input.inclureWeekends === true ? tousLesJours : filtrerJoursOuvres(tousLesJours);
    for (const iso of joursRetenus) {
      plan.push({ iso, demiJournee: "matin", jour: null });
      plan.push({ iso, demiJournee: "apres_midi", jour: null });
    }
  }

  // ── Durée d'une demi-journée ──
  // La répartition ne peut se faire qu'APRÈS avoir arrêté le plan : 14 h sur
  // 2 jours ouvrés = 7 h/jour, pas 14 h/jour.
  //
  // ⭐ Avec des journées déclarées ET une durée totale, la répartition suit les
  // AMPLITUDES DÉCLARÉES, au prorata. Sans cela, une session de 18 h déclarant
  // une journée 07:00–22:00 et une matinée 09:00–12:00 étalait 6 h sur la
  // matinée : la feuille d'émargement afficherait « 09:00–12:00 » en face de
  // « 6 h », et se contredirait elle-même sur une pièce à valeur probante.
  //
  // Sinon, on raisonne en « jours équivalents » (demi-journées ÷ 2) : dans le
  // repli chaque jour vaut exactement 2 demi-journées, donc le résultat est
  // identique au comportement historique.
  const durees = repartirDurees({
    plan,
    heuresParJour: input.heuresParJour,
    dureeTotaleHeures: input.dureeTotaleHeures,
  });

  return plan.map(({ iso, demiJournee, jour }, index) => ({
    date: iso,
    demiJournee,
    libelle: parisDateLabel(iso, demiJournee),
    dureePrevueMinutes: durees[index] as number,
    // ⚠️ Ce sont les horaires de la JOURNÉE, pas ceux du créneau : la table ne
    // déclare rien de plus fin. Les laisser tels quels est honnête ; découper
    // « 09:00–17:00 » en un matin 09:00–12:30 inventerait une pause que
    // personne n'a saisie, sur une pièce à valeur probante.
    ...(jour !== null ? { jourHeureDebut: jour.heureDebut, jourHeureFin: jour.heureFin } : {}),
  }));
}

type EntreePlan = { iso: string; demiJournee: DemiJourneeLabel; jour: JourSession | null };

/** Minutes écoulées depuis minuit pour un `HH:MM`. */
function minutesDe(heure: string): number {
  return Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3, 5));
}

/**
 * Durée prévue de chaque entrée du plan, dans l'ordre.
 *
 * Trois régimes, du plus fidèle au moins :
 *   1. journées déclarées + durée totale → **prorata des amplitudes déclarées** ;
 *   2. `heuresParJour` explicite, ou repli → durée uniforme par demi-journée ;
 *   3. rien → 7 h/jour.
 *
 * Le régime 1 est le seul qui garantisse que la durée affichée sur la feuille
 * soit cohérente avec l'horaire affiché juste à côté.
 */
function repartirDurees(input: {
  plan: EntreePlan[];
  heuresParJour: number | undefined;
  dureeTotaleHeures: number | undefined;
}): number[] {
  const { plan } = input;
  if (plan.length === 0) return [];

  const declarees = plan.every((e) => e.jour !== null);
  const totalMinutes =
    input.dureeTotaleHeures !== undefined && input.dureeTotaleHeures > 0
      ? Math.round(input.dureeTotaleHeures * 60)
      : null;

  if (declarees && totalMinutes !== null && input.heuresParJour === undefined) {
    // Amplitude déclarée de chaque entrée : celle de sa journée, divisée par le
    // nombre de demi-journées que cette journée produit.
    const amplitudes = plan.map((e) => {
      const jour = e.jour as JourSession;
      const span = minutesDe(jour.heureFin) - minutesDe(jour.heureDebut);
      return span / demiJourneesDe(jour).length;
    });
    const sommeAmplitudes = amplitudes.reduce((s, a) => s + a, 0);
    if (sommeAmplitudes > 0) {
      // Le reste d'arrondi est versé sur la DERNIÈRE entrée, pour que la somme
      // vaille exactement la durée de la session. Répartir des minutes entières
      // sans ce rattrapage ferait dériver le dénominateur du taux.
      const durees = amplitudes.map((a) => Math.round((totalMinutes * a) / sommeAmplitudes));
      const ecart = totalMinutes - durees.reduce((s, d) => s + d, 0);
      durees[durees.length - 1] = (durees[durees.length - 1] as number) + ecart;
      return durees;
    }
  }

  const heuresParJour = resoudreHeuresParJour({
    heuresParJour: input.heuresParJour,
    dureeTotaleHeures: input.dureeTotaleHeures,
    nbJours: plan.length / 2,
  });
  const dureeDemiJournee = Math.round((heuresParJour * 60) / 2);
  return plan.map(() => dureeDemiJournee);
}

// ─── Journées déclarées (D14) ───────────────────────────────────────────────

/**
 * Demi-journées produites par une journée, d'après ses horaires RÉELS.
 *
 * C'est ici que se joue la moitié du gain de D14 : une journée déclarée
 * 09:00–12:30 ne doit pas produire de créneau d'après-midi. Sinon ce créneau
 * jamais signé divise le taux par deux — le bug même qu'on corrige, déplacé.
 */
function demiJourneesDe(jour: JourSession): DemiJourneeLabel[] {
  if (jour.heureFin <= PIVOT_DEMI_JOURNEE) return ["matin"];
  if (jour.heureDebut >= PIVOT_DEMI_JOURNEE) return ["apres_midi"];
  return ["matin", "apres_midi"];
}

/**
 * Valide et ordonne les journées déclarées.
 *
 * Une date en double LÈVE, elle n'est pas écrasée en silence : c'est la même
 * doctrine que pour les horaires malformés. `session_jour_unique` rend le cas
 * inatteignable depuis la base, mais cette fonction est pure et appelable avec
 * n'importe quoi — et une journée avalée sans bruit fausserait le dénominateur
 * sans que personne ne le voie.
 */
function trierEtDedupliquer(jours: JourSession[]): JourSession[] {
  const parDate = new Map<string, JourSession>();
  for (const jour of jours) {
    if (!DATE_ISO_RE.test(jour.date)) {
      throw new Error(`[genererCreneaux] Journée déclarée avec une date invalide : ${jour.date}`);
    }
    if (!HEURE_RE.test(jour.heureDebut) || !HEURE_RE.test(jour.heureFin)) {
      throw new Error(
        `[genererCreneaux] Journée ${jour.date} : horaires invalides (${jour.heureDebut}–${jour.heureFin}), format HH:MM attendu.`,
      );
    }
    if (jour.heureFin <= jour.heureDebut) {
      throw new Error(
        `[genererCreneaux] Journée ${jour.date} : la fin (${jour.heureFin}) n'est pas après le début (${jour.heureDebut}).`,
      );
    }
    if (parDate.has(jour.date)) {
      throw new Error(`[genererCreneaux] La journée du ${jour.date} est déclarée deux fois.`);
    }
    parDate.set(jour.date, jour);
  }
  return [...parDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Helpers internes ───────────────────────────────────────────────────────

/**
 * Résout les heures par jour à partir des entrées disponibles.
 *
 * Ordre de priorité : `heuresParJour` explicite → `dureeTotaleHeures / nbJours`
 * → défaut 7 h. Une durée totale nulle ou négative, ou un nombre de jours nul,
 * retombe sur le défaut plutôt que de produire une division absurde.
 */
function resoudreHeuresParJour(input: {
  // `| undefined` explicite : le projet active `exactOptionalPropertyTypes`,
  // un `?` seul refuserait la valeur `undefined` passée explicitement.
  heuresParJour: number | undefined;
  dureeTotaleHeures: number | undefined;
  nbJours: number;
}): number {
  if (input.heuresParJour !== undefined) return input.heuresParJour;
  if (input.dureeTotaleHeures !== undefined && input.dureeTotaleHeures > 0 && input.nbJours > 0) {
    // Plafonné comme l'entrée explicite (`generateSessionCreneauxSchema` borne
    // `heuresParJour` à 12) : une durée totale saisie sur une plage de dates trop
    // courte produirait sinon des demi-journées de 10 h et plus sur la feuille
    // d'émargement — un document à valeur probante ne doit pas afficher ça.
    return Math.min(input.dureeTotaleHeures / input.nbJours, HEURES_PAR_JOUR_MAX);
  }
  return HEURES_PAR_JOUR_DEFAUT;
}

/** Vrai pour un samedi ou un dimanche (UTC — la conversion Paris est faite en amont). */
function estWeekend(iso: string): boolean {
  const jour = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return jour === 0 || jour === 6; // 0 = dimanche, 6 = samedi
}

/**
 * Retire les samedis et dimanches **intérieurs** à la plage.
 *
 * Les BORNES sont toujours conservées : `dateDebut` et `dateFin` sont saisies
 * explicitement par un humain, donc une session qui commence ou finit un samedi
 * le fait délibérément. Seuls les week-ends *traversés* sont des artefacts de
 * calendrier — une session du vendredi au lundi représente 2 jours de formation,
 * pas 4.
 *
 * Ce compromis évite les deux défaillances symétriques :
 *   - filtrer aveuglément supprimerait des journées RÉELLEMENT animées, rendant
 *     leur présence impossible à prouver (trou de preuve, ind. 12) ;
 *   - ne rien filtrer laisserait des créneaux jamais cochés diviser le taux de
 *     présence et déclencher des attestations « partielles » à tort.
 *
 * ⚠️ Aucune règle ne peut deviner de façon fiable si un week-end traversé est
 * travaillé. En cas de doute, l'appelant dispose de `inclureWeekends`.
 */
function filtrerJoursOuvres(jours: string[]): string[] {
  if (jours.length <= 2) return jours; // que des bornes : rien à filtrer
  const premier = jours[0] as string;
  const dernier = jours[jours.length - 1] as string;
  const interieurs = jours.slice(1, -1).filter((iso) => !estWeekend(iso));
  return [premier, ...interieurs, dernier];
}

/**
 * Parse une date ISO "YYYY-MM-DD" en objet Date UTC minuit.
 * On travaille en UTC pur pour le comptage de jours, la conversion Paris est
 * déjà faite en amont.
 */
function parseDateISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Formatte un objet Date (UTC) en "YYYY-MM-DD". */
function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const j = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}
