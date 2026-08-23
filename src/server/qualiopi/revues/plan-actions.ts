/**
 * Qualiopi — Plan d'actions d'amélioration continue (indicateur 32 ⭐, NC majeure).
 *
 * ## Pourquoi ce module existe (mesuré le 2026-08-23)
 *
 * L'indicateur 32 demande la **mise en œuvre** de mesures d'amélioration. L'outil
 * savait montrer qu'une revue de direction avait eu lieu et ce qui y avait été
 * décidé ; il ne savait **pas** montrer qu'une action décidée avait été confiée à
 * quelqu'un, datée, puis close. « Responsable » et « échéance » n'existaient que
 * dans le `placeholder` d'un `<textarea>` (`RevueDirectionRowActions.tsx`) : une
 * suggestion de mise en forme, jamais une donnée.
 *
 * Et la règle de couverture était `nbRevues > 0`. Une revue validée **vide**
 * — `participants: []`, `decisions: []`, `planActions: []` — verdissait donc un
 * super-indicateur, pendant que le libellé de preuve affichait « N réclamations
 * **+ plan d'actions** » : un plan **affirmé, jamais mesuré**. C'est exactement la
 * famille de faux positifs corrigée en août sur off.4, 8, 18, 21 et 30, et elle
 * subsistait ici, sur la mine.
 *
 * ## Ce que ce module apporte
 *
 * `RevueDirection.planActions` est une colonne **`Json`** (`schema.prisma`), pas
 * une table : le suivi complet d'une action (responsable · échéance · statut ·
 * date de clôture) tient dans la forme de l'entrée, **sans aucune migration**.
 * Ce fichier définit cette forme, la normalise (les entrées historiques — chaînes
 * nues, ou `{ action, source, ajouteAt }` posées par `reporterConstatRevue` — sont
 * relues sans perte), et en tire le seul prédicat de couverture d'off.32.
 *
 * ## Le prédicat, et pourquoi il est sévère
 *
 * Une action d'amélioration **sans responsable ni échéance n'est pas une mesure
 * mise en œuvre** : c'est une intention. L'auditeur qui demande « et cette
 * action-là, où en est-elle ? » attend un nom et une date. Le prédicat exige donc
 * que **toute** entrée du plan porte les deux, et les preuves nomment précisément
 * ce qui manque, action par action — pour que l'écran dise quoi remplir plutôt que
 * de se contenter de rougir.
 *
 * Ce qu'il **n'exige pas** : qu'une action soit déjà close. Une revue tenue en
 * janvier a légitimement un plan entièrement ouvert. Le nombre d'actions closes et
 * le nombre d'actions **en retard** sont *rapportés* dans les preuves, pas opposés
 * à la couverture — l'outil dit la vérité, il ne la maquille dans aucun sens.
 *
 * Module PUR : aucun appel Prisma, aucune date implicite (`maintenant` est
 * toujours injecté). Testable sans base.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Statuts de suivi d'une action d'amélioration, du constat à la clôture. */
export const STATUTS_ACTION_AMELIORATION = ["a_faire", "en_cours", "faite", "abandonnee"] as const;

export type StatutActionAmelioration = (typeof STATUTS_ACTION_AMELIORATION)[number];

export const LIBELLES_STATUT_ACTION: Record<StatutActionAmelioration, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  faite: "Faite",
  abandonnee: "Abandonnée",
};

/** Les statuts qui referment une action : elle ne peut plus être « en retard ». */
const STATUTS_CLOS: ReadonlySet<string> = new Set<StatutActionAmelioration>([
  "faite",
  "abandonnee",
]);

/**
 * Une action d'amélioration, telle qu'elle est stockée dans
 * `RevueDirection.planActions` (colonne `Json`).
 *
 * Tous les champs sont présents après normalisation : `responsable` vaut `""` et
 * `echeance` vaut `null` quand ils ne sont pas renseignés — un champ **absent**
 * et un champ **vide** doivent se lire pareil, sinon le compte de « ce qui
 * manque » dépend de la façon dont la ligne a été écrite.
 */
export interface ActionAmelioration {
  /** Libellé de l'action décidée. Jamais vide (une entrée sans libellé est écartée). */
  action: string;
  /** Origine du constat (« Verbatim satisfaction — … », « saisie manuelle », …). */
  source: string;
  /** Horodatage ISO de l'ajout au plan. */
  ajouteAt: string;
  /** Personne à qui l'action est confiée. `""` = non désignée. */
  responsable: string;
  /** Échéance au format `YYYY-MM-DD`. `null` = non datée. */
  echeance: string | null;
  /** État de suivi. */
  statut: StatutActionAmelioration;
  /** Date de clôture ISO (`YYYY-MM-DD`). `null` tant que l'action n'est pas close. */
  clotureAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

function texte(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

/** `YYYY-MM-DD` si la valeur est une date lisible, `null` sinon. */
export function normaliserDateJour(x: unknown): string | null {
  const brut = texte(x);
  if (brut.length === 0) return null;
  // Les dates ISO complètes (`2026-03-01T00:00:00.000Z`) comme les dates simples
  // passent par `Date` : on ne garde que le jour, seule précision utile ici.
  const d = new Date(brut);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normaliserStatut(x: unknown): StatutActionAmelioration {
  const brut = texte(x);
  return (STATUTS_ACTION_AMELIORATION as readonly string[]).includes(brut)
    ? (brut as StatutActionAmelioration)
    : "a_faire";
}

/**
 * Relit une entrée de `planActions` quelle que soit la forme sous laquelle elle a
 * été écrite. Retourne `null` si aucun libellé d'action n'est identifiable — une
 * ligne sans libellé n'est pas une action, et la compter en fabriquerait une.
 *
 * Formes acceptées, par ordre d'ancienneté :
 *   - `"Refondre le questionnaire"` (chaîne nue) ;
 *   - `{ action, source, ajouteAt }` (`reporterConstatRevue`) ;
 *   - `{ decision | libelle | titre | nom }` (saisie inline d'avant 2026-08-23) ;
 *   - `{ action, source, ajouteAt, responsable, echeance, statut, clotureAt }` (forme courante).
 */
export function normaliserActionAmelioration(x: unknown): ActionAmelioration | null {
  if (typeof x === "string") {
    const libelle = x.trim();
    if (libelle.length === 0) return null;
    return {
      action: libelle,
      source: "",
      ajouteAt: "",
      responsable: "",
      echeance: null,
      statut: "a_faire",
      clotureAt: null,
    };
  }

  if (x === null || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;

  // Mêmes clés de libellé que `libelleEntree` (écran) et `resumeJsonListe` (PDF) :
  // si les trois divergeaient, l'écran, le PDF et le moteur ne compteraient pas
  // les mêmes lignes.
  let libelle = "";
  for (const cle of ["action", "libelle", "titre", "nom", "decision"]) {
    const v = texte(o[cle]);
    if (v.length > 0) {
      libelle = v;
      break;
    }
  }
  if (libelle.length === 0) return null;

  const statut = normaliserStatut(o["statut"]);
  const clotureAt = normaliserDateJour(o["clotureAt"]);

  return {
    action: libelle,
    source: texte(o["source"]),
    ajouteAt: texte(o["ajouteAt"]),
    responsable: texte(o["responsable"]),
    echeance: normaliserDateJour(o["echeance"]),
    statut,
    // Une action close sans date de clôture reste close : on ne fabrique pas la
    // date, on la laisse à `null` et le résumé la signale comme « clôture non datée ».
    clotureAt,
  };
}

/** Relit tout le contenu d'une colonne `planActions`. Tolère `null`, un objet, un scalaire. */
export function normaliserPlanActions(x: unknown): ActionAmelioration[] {
  if (!Array.isArray(x)) return [];
  const out: ActionAmelioration[] = [];
  for (const brut of x) {
    const a = normaliserActionAmelioration(brut);
    if (a !== null) out.push(a);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Résumé du suivi
// ─────────────────────────────────────────────────────────────────────────────

export interface ResumePlanActions {
  total: number;
  /** Actions portant À LA FOIS un responsable et une échéance. */
  suivies: number;
  sansResponsable: number;
  sansEcheance: number;
  /** Actions `faite` ou `abandonnee`. */
  closes: number;
  /** Actions closes dont la date de clôture n'a pas été saisie. */
  closesSansDate: number;
  /** Actions non closes dont l'échéance est dépassée à `maintenant`. */
  enRetard: number;
}

/**
 * Compte ce que le plan d'actions prouve et ce qui lui manque.
 * `maintenant` est injecté : un compteur de retard qui lit l'horloge lui-même
 * n'est pas testable, et un test qui n'est pas écrit ne rougit jamais.
 */
export function resumerPlanActions(
  actions: readonly ActionAmelioration[],
  maintenant: Date,
): ResumePlanActions {
  const jour = maintenant.toISOString().slice(0, 10);
  let suivies = 0;
  let sansResponsable = 0;
  let sansEcheance = 0;
  let closes = 0;
  let closesSansDate = 0;
  let enRetard = 0;

  for (const a of actions) {
    const aResponsable = a.responsable.length > 0;
    const aEcheance = a.echeance !== null;
    if (aResponsable && aEcheance) suivies += 1;
    if (!aResponsable) sansResponsable += 1;
    if (!aEcheance) sansEcheance += 1;

    const close = STATUTS_CLOS.has(a.statut);
    if (close) {
      closes += 1;
      if (a.clotureAt === null) closesSansDate += 1;
    } else if (a.echeance !== null && a.echeance < jour) {
      // Comparaison lexicographique volontaire : `YYYY-MM-DD` s'ordonne comme
      // les dates qu'il représente, et éviter `new Date()` évite le décalage de
      // fuseau qui ferait basculer une échéance du jour.
      enRetard += 1;
    }
  }

  return {
    total: actions.length,
    suivies,
    sansResponsable,
    sansEcheance,
    closes,
    closesSansDate,
    enRetard,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Couverture off.32
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'état d'une revue de direction, tel que le moteur de conformité doit le lire.
 * `null` = aucune revue VALIDÉE pour l'année courante.
 */
export interface RevueAnnuelleLue {
  annee: number;
  participants: unknown;
  decisions: unknown;
  planActions: unknown;
}

export interface CouvertureOff32 {
  couvert: boolean;
  /** Ce que la revue établit ET ce qui lui manque — destiné à la matrice de conformité. */
  preuves: string[];
  /**
   * Les seuls manques bloquants, sans les constats positifs.
   * C'est ce qu'on met sous les yeux de l'opérateur au moment où il tente de
   * valider la revue : un message de refus ne doit contenir que des manques.
   */
  manques: string[];
  resume: ResumePlanActions;
}

function pluriel(n: number, singulier: string, plurielMot = `${singulier}s`): string {
  return n > 1 ? plurielMot : singulier;
}

function compterListe(x: unknown): number {
  if (!Array.isArray(x)) return 0;
  return x.filter((e) =>
    typeof e === "string" ? e.trim().length > 0 : e !== null && e !== undefined,
  ).length;
}

/**
 * Le prédicat de couverture d'off.32 — le SEUL. `conformite-service.ts`,
 * `audit-dossier.ts` et l'écran `/qualiopi/revue-direction` doivent l'appeler,
 * jamais réécrire leur propre version : un prédicat recopié diverge, ce dépôt
 * l'a payé quatre fois.
 *
 * Couvert si, et seulement si :
 *   1. une revue de direction VALIDÉE existe pour l'ANNÉE COURANTE (filtre déjà
 *      en place côté requête, conservé ici comme condition explicite) ;
 *   2. elle nomme au moins un participant ;
 *   3. elle porte au moins une décision ;
 *   4. son plan d'actions porte au moins une action ;
 *   5. CHAQUE action porte un responsable ET une échéance.
 *
 * Les preuves rendues disent, dans tous les cas, ce qui est établi et ce qui
 * manque — y compris quand c'est couvert (nombre d'actions closes, en retard).
 */
export function evaluerCouvertureOff32(
  revue: RevueAnnuelleLue | null,
  maintenant: Date,
): CouvertureOff32 {
  const anneeCourante = maintenant.getFullYear();

  if (revue === null) {
    const manque = `Aucune revue de direction VALIDÉE pour ${anneeCourante} — l'amélioration continue est une exigence annuelle (indicateur 32 ⭐, NC majeure)`;
    return {
      couvert: false,
      preuves: [manque],
      manques: [manque],
      resume: resumerPlanActions([], maintenant),
    };
  }

  const nbParticipants = compterListe(revue.participants);
  const nbDecisions = compterListe(revue.decisions);
  const actions = normaliserPlanActions(revue.planActions);
  const resume = resumerPlanActions(actions, maintenant);

  const preuves: string[] = [`Revue de direction ${revue.annee} validée`];
  const manques: string[] = [];

  /** Ajoute un manque : il compte pour le verdict ET s'affiche en preuve. */
  function manque(message: string): void {
    manques.push(message);
    preuves.push(message);
  }

  if (nbParticipants > 0) {
    preuves.push(`${nbParticipants} ${pluriel(nbParticipants, "participant")} à la revue`);
  } else {
    manque(
      "Aucun participant nommé à la revue — une revue de direction sans participants n'est pas opposable",
    );
  }

  if (nbDecisions > 0) {
    preuves.push(
      `${nbDecisions} ${pluriel(nbDecisions, "décision")} prise${nbDecisions > 1 ? "s" : ""} en revue`,
    );
  } else {
    manque("Aucune décision consignée en revue");
  }

  if (resume.total === 0) {
    manque(
      "Plan d'actions VIDE — aucune mesure d'amélioration décidée. L'indicateur 32 porte sur la MISE EN ŒUVRE de mesures, pas sur la tenue de la revue.",
    );
  } else {
    preuves.push(
      `${resume.total} ${pluriel(resume.total, "action")} d'amélioration au plan, dont ${resume.suivies} ${pluriel(resume.suivies, "suivie")} (responsable ET échéance)`,
    );
    if (resume.sansResponsable > 0) {
      manque(
        `${resume.sansResponsable} ${pluriel(resume.sansResponsable, "action")} sans responsable désigné — une action que personne ne porte n'est pas une mesure mise en œuvre`,
      );
    }
    if (resume.sansEcheance > 0) {
      manque(
        `${resume.sansEcheance} ${pluriel(resume.sansEcheance, "action")} sans échéance — le suivi jusqu'à clôture ne peut pas être démontré`,
      );
    }
    preuves.push(
      `${resume.closes} ${pluriel(resume.closes, "action")} close${resume.closes > 1 ? "s" : ""} (faite ou abandonnée)`,
    );
    if (resume.closesSansDate > 0) {
      // Signalé, mais NON bloquant : l'action est bien close, c'est sa date qui
      // manque. Rougir un super-indicateur là-dessus serait une sur-déclaration.
      preuves.push(
        `${resume.closesSansDate} ${pluriel(resume.closesSansDate, "action")} close${resume.closesSansDate > 1 ? "s" : ""} sans date de clôture saisie`,
      );
    }
    if (resume.enRetard > 0) {
      preuves.push(
        `⚠️ ${resume.enRetard} ${pluriel(resume.enRetard, "action")} en retard (échéance dépassée, action non close)`,
      );
    }
  }

  return { couvert: manques.length === 0, preuves, manques, resume };
}
