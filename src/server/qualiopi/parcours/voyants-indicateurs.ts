/**
 * 🔴 CHANTIER QNC, LOT L12 — LES VOYANTS D'INDICATEURS FONDÉS SUR UNE TRACE RÉELLE.
 * Module PUR : aucune requête, aucune horloge (la date est reçue).
 *
 * ## La cause de l'échec de l'audit, et la règle qui la ferme (exigence orale O13)
 *
 * « 23/23 couvert » mesurait la PRÉSENCE D'UNE DONNÉE, pas l'existence d'un
 * PROCESSUS. Un champ rempli n'est pas une preuve qu'un geste a eu lieu, qu'une
 * personne l'a posé, à telle date, avec telle suite.
 *
 * Ici, un voyant ne passe au vert QU'AVEC LA TRACE que le lot producteur écrit :
 * une validation journalisée, un envoi daté, une signature dans son créneau, une
 * vérification datée, un questionnaire répondu, une décision de veille tracée,
 * une étape de réclamation, une habilitation datée. Chaque prédicat ci-dessous
 * dit quelle trace il lit — `trace` est rendue à l'écran avec sa date.
 *
 * ## Cinq états, dont un qui n'est jamais vert
 *
 *   - `vert`       : la trace réelle existe et satisfait le prédicat ;
 *   - `en_attente` : pas (encore) de trace, l'échéance n'est pas passée ;
 *   - `rouge`      : pas de trace, ou trace incomplète, échéance passée ;
 *   - `non_evalue` : on ne PEUT PAS savoir — le lot qui écrit la trace n'est pas
 *                    sur main, ou éteint, ou la lecture a échoué. **Jamais vert
 *                    par défaut**, et distinct du rouge : il n'accuse personne ;
 *   - `sans_objet` : le voyant ne s'applique pas (session d'ESSAI, ou rien à
 *                    tracer parce que le fait déclencheur n'existe pas).
 *
 * ## Un lot absent ne peut PAS verdir
 *
 * Chaque emplacement de `TracesVoyants` est un `TraceLue<…>` : `lue` (les faits),
 * `lot_eteint` ou `lot_absent` (non évalué). Un emplacement OMIS vaut
 * `lot_absent`. Le compilateur ne permet donc pas d'écrire un vert sans avoir
 * lu quelque chose.
 *
 * ## Les essais n'entrent pas
 *
 * Une session d'essai (`estTestInterne`, ADR 0061) rend tous ses voyants
 * `sans_objet` : ils ne comptent dans aucun voyant réel. Le chargeur écarte de
 * surcroît les inscriptions d'essai des décomptes.
 */

import { appelleUneAction } from "./etat-echeance";

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulaire
// ─────────────────────────────────────────────────────────────────────────────

/** Les quatorze indicateurs qui portent un voyant fondé sur une trace. */
export const INDICATEURS_A_VOYANT = [4, 6, 9, 10, 11, 12, 17, 19, 21, 23, 26, 27, 30, 31] as const;
export type IndicateurAVoyant = (typeof INDICATEURS_A_VOYANT)[number];

export type EtatVoyant = "vert" | "en_attente" | "rouge" | "non_evalue" | "sans_objet";

/** Le lot du chantier qui écrit la trace lue (pour le tableau de la PR et l'écran). */
export type LotSource =
  "L03" | "L04" | "L05" | "L06" | "L07" | "L08" | "L09" | "L10" | "L14" | "L15";

/**
 * La lecture d'une trace : les faits lus, ou la raison de ne rien pouvoir dire.
 * `lot_eteint` : le lot est sur main mais son interrupteur n'est pas allumé pour
 * cette session (il n'écrit donc rien). `lot_absent` : le lot n'est pas sur main.
 */
export type TraceLue<T> =
  | ({ readonly lecture: "lue" } & T)
  | { readonly lecture: "lot_eteint" }
  | { readonly lecture: "lot_absent" }
  | { readonly lecture: "illisible" };

// ─────────────────────────────────────────────────────────────────────────────
// Les traces, une par indicateur
// ─────────────────────────────────────────────────────────────────────────────

/** Ind. 4 — recueil du besoin, temps 1 (L03) : l'analyse VALIDÉE au journal. */
export interface TraceRecueilTemps1 {
  /** Date de la ligne de validation au journal (ajout seul). `null` = jamais validée. */
  readonly analyseValideeLe: Date | null;
  /** Une réponse du client est arrivée (étape qui précède la validation). */
  readonly reponseRecueLe: Date | null;
  /** Une dérogation motivée a ouvert la convention SANS cadrage validé. */
  readonly derogationLe: Date | null;
}

/** Ind. 6 — recueil du besoin, temps 2 (L04) : les stagiaires ont répondu. */
export interface TraceRecueilTemps2 {
  readonly stagiairesActifs: number;
  readonly temps2Repondus: number;
  readonly dernierRepondu: Date | null;
}

/** Ind. 9 — convocation PARTIE (pas seulement générée) et pièces remises. */
export interface TraceConvocation {
  readonly stagiairesActifs: number;
  /** Inscriptions dont `convocationEnvoyeeAt` est posée (écrite après l'envoi). */
  readonly convoques: number;
  readonly derniereConvocation: Date | null;
  /** Remises de pièces enregistrées (`remises_retours`, nature `remise`) — information. */
  readonly piecesRemises: number;
}

/** Ind. 10 — adaptation : chaque besoin déclaré a une réponse CONSIGNÉE. */
export interface TraceAdaptation {
  readonly besoinsDeclares: number;
  readonly reponsesConsignees: number;
  readonly derniereReponse: Date | null;
}

/** Ind. 11 — évaluation des acquis : l'évaluation finale de chaque présent. */
export interface TraceEvaluationAcquis {
  /** Inscriptions actives (hors essai) dont la session est terminée ou en cours. */
  readonly stagiairesActifs: number;
  readonly evalues: number;
  readonly derniereEvaluation: Date | null;
}

/** Ind. 12 — émargement par demi-journée (L06) : signé DANS son créneau. */
export interface TraceEmargementDemiJournee {
  /** Demi-journées échues (créneau clos) × stagiaires actifs. */
  readonly echues: number;
  /** Parmi elles : signées dans le créneau, sans rattrapage. */
  readonly signeesDansLeCreneau: number;
  /** Écarts : non signée, rattrapage de l'organisme, signée hors créneau. */
  readonly ecarts: number;
  /** Demi-journées à venir ou en cours de signature (ne comptent pas encore). */
  readonly aVenir: number;
}

/** Ind. 17 — moyens vérifiés pour CETTE session (L07). */
export interface TraceMoyens {
  /** Dernière vérification journalisée pour la session (`null` = jamais). */
  readonly verifieLe: Date | null;
  /** Moyens actifs de la modalité jamais vérifiés. */
  readonly moyensNonVerifies: number;
  /** Session à distance : le lien a-t-il été testé avec succès ? `null` = sans objet. */
  readonly lienTeste: boolean | null;
}

/** Ind. 19 — ressources pédagogiques mises à disposition (remises tracées, L08). */
export interface TraceRessources {
  readonly stagiairesActifs: number;
  /** Inscriptions ayant au moins une remise de support tracée. */
  readonly avecSupportRemis: number;
  readonly derniereRemise: Date | null;
}

/** Ind. 21 — compétences des intervenants : habilitation ACTIVE et datée (L14). */
export interface TraceIntervenants {
  /** Le formateur principal est désigné. */
  readonly formateurDesigne: boolean;
  /** Habilitation active sur la formation de la session. */
  readonly habilitationActive: boolean;
  readonly habiliteLe: Date | null;
}

/** Ind. 23 — veille légale EXPLOITÉE (L10) : une décision tracée, une revue validée. */
export interface TraceVeille {
  /** Date de la dernière décision de veille tracée au journal (par une personne). */
  readonly derniereDecisionLe: Date | null;
  /** Une revue de direction validée existe pour l'année en cours. */
  readonly revueValidee: boolean;
}

/** Ind. 26 — handicap : référent nommé ET joignable, réponse aux besoins déclarés (L15). */
export interface TraceHandicap {
  readonly referentNommeEtJoignable: boolean;
  /** Réseau handicap : au moins un partenariat actif à ce type. */
  readonly reseauActif: boolean;
}

/** Ind. 27 — sous-traitance : chaque sous-traitant de la session a un contrôle tracé. */
export interface TraceSousTraitance {
  /** Formateurs indépendants (sous-traitants) affectés à la session. */
  readonly sousTraitants: number;
  /** Parmi eux : dernier contrôle au registre tracé ET conforme. */
  readonly controlesConformes: number;
  readonly dernierControle: Date | null;
}

/** Ind. 30 — appréciations : le questionnaire à chaud RÉPONDU. */
export interface TraceAppreciations {
  readonly stagiairesActifs: number;
  readonly chaudRepondus: number;
  readonly dernierRepondu: Date | null;
}

/** Ind. 31 — réclamations rattachées à la session et leurs ÉTAPES (L09). */
export interface TraceReclamations {
  readonly reclamations: ReadonlyArray<{
    readonly numero: string;
    /** Les étapes réellement écrites (ajout seul), dans l'ordre d'écriture. */
    readonly etapes: ReadonlyArray<
      "reception" | "accuse" | "analyse" | "reponse" | "reexamen" | "cloture"
    >;
  }>;
}

export interface TracesVoyants {
  readonly i4?: TraceLue<TraceRecueilTemps1>;
  readonly i6?: TraceLue<TraceRecueilTemps2>;
  readonly i9?: TraceLue<TraceConvocation>;
  readonly i10?: TraceLue<TraceAdaptation>;
  readonly i11?: TraceLue<TraceEvaluationAcquis>;
  readonly i12?: TraceLue<TraceEmargementDemiJournee>;
  readonly i17?: TraceLue<TraceMoyens>;
  readonly i19?: TraceLue<TraceRessources>;
  readonly i21?: TraceLue<TraceIntervenants>;
  readonly i23?: TraceLue<TraceVeille>;
  readonly i26?: TraceLue<TraceHandicap>;
  readonly i27?: TraceLue<TraceSousTraitance>;
  readonly i30?: TraceLue<TraceAppreciations>;
  readonly i31?: TraceLue<TraceReclamations>;
}

// ─────────────────────────────────────────────────────────────────────────────
// La sortie
// ─────────────────────────────────────────────────────────────────────────────

export interface Voyant {
  readonly indicateur: IndicateurAVoyant;
  readonly libelle: string;
  readonly lot: LotSource;
  readonly etat: EtatVoyant;
  /** La trace LUE, datée, en une phrase — vide quand il n'y en a pas. */
  readonly trace: string | null;
  /** Ce qui manque pour verdir, ou pourquoi l'on ne sait pas. */
  readonly manque: string | null;
}

export interface ContexteVoyants {
  readonly dateDebut: Date;
  readonly dateFin: Date;
  /** Session d'essai : tous les voyants sont `sans_objet`. */
  readonly estTestInterne: boolean;
  readonly maintenant: Date;
}

const MS_JOUR = 24 * 60 * 60 * 1000;

/** Délai laissé après la fin de session pour les gestes d'après-séance. */
export const DELAI_APRES_SESSION_JOURS = 7;

const LIBELLES: Readonly<Record<IndicateurAVoyant, { libelle: string; lot: LotSource }>> = {
  4: { libelle: "Analyse du besoin (recueil temps 1)", lot: "L03" },
  6: { libelle: "Contenus et modalités adaptés (recueil temps 2)", lot: "L04" },
  9: { libelle: "Information sur les conditions de déroulement (convocation)", lot: "L05" },
  10: { libelle: "Adaptation de la prestation aux publics", lot: "L15" },
  11: { libelle: "Évaluation de l'atteinte des objectifs", lot: "L08" },
  12: {
    libelle: "Engagement et prévention des ruptures (émargement par demi-journée)",
    lot: "L06",
  },
  17: { libelle: "Moyens humains et techniques vérifiés", lot: "L07" },
  19: { libelle: "Ressources pédagogiques mises à disposition", lot: "L08" },
  21: { libelle: "Compétences des intervenants", lot: "L14" },
  23: { libelle: "Veille légale et réglementaire exploitée", lot: "L10" },
  26: { libelle: "Handicap : référent joignable et réseau", lot: "L15" },
  27: { libelle: "Sous-traitance : contrôle tracé", lot: "L14" },
  30: { libelle: "Appréciations recueillies (questionnaire à chaud)", lot: "L08" },
  31: { libelle: "Réclamations traitées étape par étape", lot: "L09" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Outils
// ─────────────────────────────────────────────────────────────────────────────

function jour(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short" }).format(
    d,
  );
}

type Verdict = Pick<Voyant, "etat" | "trace" | "manque">;

/** Pas de trace suffisante : `en_attente` avant l'échéance, `rouge` après. */
function sansTrace(
  echeance: Date,
  maintenant: Date,
  manque: string,
  trace: string | null = null,
): Verdict {
  return {
    etat: maintenant.getTime() > echeance.getTime() ? "rouge" : "en_attente",
    trace,
    manque,
  };
}

function vert(trace: string): Verdict {
  return { etat: "vert", trace, manque: null };
}

function nonEvalue(lecture: "lot_eteint" | "lot_absent" | "illisible", lot: LotSource): Verdict {
  const manque =
    lecture === "lot_absent"
      ? `Non évalué : le lot ${lot}, qui écrit cette trace, n'est pas encore livré.`
      : lecture === "lot_eteint"
        ? `Non évalué : le lot ${lot} est éteint pour cette session, il n'écrit aucune trace.`
        : "Non évalué : la trace n'a pas pu être lue.";
  return { etat: "non_evalue", trace: null, manque };
}

function sansObjet(manque: string): Verdict {
  return { etat: "sans_objet", trace: null, manque };
}

// ─────────────────────────────────────────────────────────────────────────────
// Les prédicats — un par indicateur, chacun exige sa trace
// ─────────────────────────────────────────────────────────────────────────────

function p4(t: TraceRecueilTemps1, c: ContexteVoyants): Verdict {
  if (t.analyseValideeLe !== null) {
    return vert(`Analyse du besoin validée le ${jour(t.analyseValideeLe)} (journal).`);
  }
  const manque =
    t.derogationLe !== null
      ? `Dérogation accordée le ${jour(t.derogationLe)} : l'analyse du besoin n'est pas validée, la dérogation n'en tient pas lieu.`
      : t.reponseRecueLe !== null
        ? "Le client a répondu au recueil, mais personne n'a validé l'analyse."
        : "Le recueil du besoin n'a reçu aucune réponse ni validation.";
  return sansTrace(c.dateDebut, c.maintenant, manque);
}

function p6(t: TraceRecueilTemps2, c: ContexteVoyants): Verdict {
  if (t.stagiairesActifs === 0) return sansObjet("Aucun stagiaire actif.");
  if (t.temps2Repondus >= t.stagiairesActifs && t.dernierRepondu !== null) {
    return vert(
      `${t.temps2Repondus}/${t.stagiairesActifs} réponses au recueil temps 2, la dernière le ${jour(t.dernierRepondu)}.`,
    );
  }
  return sansTrace(
    c.dateDebut,
    c.maintenant,
    `${t.stagiairesActifs - t.temps2Repondus} stagiaire(s) n'ont pas répondu au recueil temps 2.`,
    t.temps2Repondus > 0 ? `${t.temps2Repondus}/${t.stagiairesActifs} réponses.` : null,
  );
}

function p9(t: TraceConvocation, c: ContexteVoyants): Verdict {
  if (t.stagiairesActifs === 0) return sansObjet("Aucun stagiaire actif.");
  if (t.convoques >= t.stagiairesActifs && t.derniereConvocation !== null) {
    return vert(
      `${t.convoques}/${t.stagiairesActifs} convocations PARTIES, la dernière le ${jour(t.derniereConvocation)} ; ${t.piecesRemises} remise(s) de pièces tracée(s).`,
    );
  }
  return sansTrace(
    c.dateDebut,
    c.maintenant,
    `${t.stagiairesActifs - t.convoques} stagiaire(s) sans convocation partie.`,
    t.convoques > 0 ? `${t.convoques}/${t.stagiairesActifs} convocations parties.` : null,
  );
}

function p10(t: TraceAdaptation, c: ContexteVoyants): Verdict {
  // Aucun besoin déclaré : rien ne prouve que la question a été posée, donc rien
  // ne peut être « traité ». Ce n'est pas un vert — on ne SAIT pas.
  if (t.besoinsDeclares === 0) {
    return {
      etat: "non_evalue",
      trace: null,
      manque:
        "Non évalué : aucun besoin d'adaptation n'est déclaré, et la trace que la question a été posée au stagiaire (recueil temps 2) n'existe pas encore.",
    };
  }
  if (t.reponsesConsignees >= t.besoinsDeclares && t.derniereReponse !== null) {
    return vert(
      `${t.reponsesConsignees}/${t.besoinsDeclares} besoins d'adaptation ont une réponse consignée, la dernière le ${jour(t.derniereReponse)}.`,
    );
  }
  return sansTrace(
    c.dateDebut,
    c.maintenant,
    `${t.besoinsDeclares - t.reponsesConsignees} besoin(s) d'adaptation déclaré(s) sans réponse de l'organisme consignée.`,
  );
}

function p11(t: TraceEvaluationAcquis, c: ContexteVoyants): Verdict {
  if (t.stagiairesActifs === 0) return sansObjet("Aucun stagiaire actif.");
  if (t.evalues >= t.stagiairesActifs && t.derniereEvaluation !== null) {
    return vert(
      `${t.evalues}/${t.stagiairesActifs} évaluations des acquis datées, la dernière le ${jour(t.derniereEvaluation)}.`,
    );
  }
  return sansTrace(
    new Date(c.dateFin.getTime() + DELAI_APRES_SESSION_JOURS * MS_JOUR),
    c.maintenant,
    `${t.stagiairesActifs - t.evalues} stagiaire(s) sans évaluation des acquis.`,
    t.evalues > 0 ? `${t.evalues}/${t.stagiairesActifs} évaluations.` : null,
  );
}

function p12(t: TraceEmargementDemiJournee): Verdict {
  if (t.echues === 0) {
    return t.aVenir > 0
      ? { etat: "en_attente", trace: null, manque: "Aucune demi-journée n'est encore échue." }
      : sansObjet("Aucune demi-journée à émarger.");
  }
  if (t.ecarts === 0 && t.signeesDansLeCreneau >= t.echues) {
    return vert(
      `${t.signeesDansLeCreneau}/${t.echues} demi-journées signées dans leur créneau, sans rattrapage.`,
    );
  }
  // Une demi-journée échue sans signature dans son créneau est déjà un écart :
  // elle ne se rattrape plus dans le créneau, donc le voyant est rouge sans attendre.
  return {
    etat: "rouge",
    trace: `${t.signeesDansLeCreneau}/${t.echues} demi-journées signées dans leur créneau.`,
    manque: `${t.ecarts} écart(s) : demi-journée non signée, rattrapée par l'organisme ou signée hors créneau.`,
  };
}

function p17(t: TraceMoyens, c: ContexteVoyants): Verdict {
  if (t.verifieLe === null) {
    return sansTrace(
      c.dateDebut,
      c.maintenant,
      "Aucune vérification des moyens n'est journalisée pour cette session.",
    );
  }
  if (t.lienTeste === false) {
    return sansTrace(
      c.dateDebut,
      c.maintenant,
      "Les moyens sont vérifiés, mais le lien de la session à distance n'a pas de test réussi.",
      `Moyens vérifiés le ${jour(t.verifieLe)}.`,
    );
  }
  if (t.moyensNonVerifies > 0) {
    return sansTrace(
      c.dateDebut,
      c.maintenant,
      `${t.moyensNonVerifies} moyen(s) de la modalité n'ont jamais été vérifiés.`,
      `Dernière vérification le ${jour(t.verifieLe)}.`,
    );
  }
  return vert(`Moyens vérifiés pour cette session le ${jour(t.verifieLe)} (journal).`);
}

function p19(t: TraceRessources, c: ContexteVoyants): Verdict {
  if (t.stagiairesActifs === 0) return sansObjet("Aucun stagiaire actif.");
  if (t.avecSupportRemis >= t.stagiairesActifs && t.derniereRemise !== null) {
    return vert(
      `${t.avecSupportRemis}/${t.stagiairesActifs} stagiaires ont une remise de support tracée, la dernière le ${jour(t.derniereRemise)}.`,
    );
  }
  return sansTrace(
    c.dateFin,
    c.maintenant,
    `${t.stagiairesActifs - t.avecSupportRemis} stagiaire(s) sans remise de support tracée.`,
  );
}

function p21(t: TraceIntervenants, c: ContexteVoyants): Verdict {
  if (!t.formateurDesigne) {
    return sansTrace(c.dateDebut, c.maintenant, "Aucun formateur principal n'est désigné.");
  }
  if (t.habilitationActive && t.habiliteLe !== null) {
    return vert(`Formateur habilité sur cette formation depuis le ${jour(t.habiliteLe)}.`);
  }
  return sansTrace(
    c.dateDebut,
    c.maintenant,
    "Le formateur principal n'a pas d'habilitation active sur cette formation.",
  );
}

function p23(t: TraceVeille, c: ContexteVoyants): Verdict {
  const douzeMois = new Date(c.maintenant.getTime() - 365 * MS_JOUR);
  const decisionRecente = t.derniereDecisionLe !== null && t.derniereDecisionLe >= douzeMois;
  if (decisionRecente && t.revueValidee) {
    return vert(
      `Dernière décision de veille tracée le ${jour(t.derniereDecisionLe!)} ; revue de direction validée cette année.`,
    );
  }
  const manques: string[] = [];
  if (!decisionRecente)
    manques.push("aucune décision de veille tracée depuis douze mois (collecter ne suffit pas)");
  if (!t.revueValidee) manques.push("aucune revue de direction validée cette année");
  return {
    etat: "rouge",
    trace:
      t.derniereDecisionLe !== null
        ? `Dernière décision de veille le ${jour(t.derniereDecisionLe)}.`
        : null,
    manque: `Manque : ${manques.join(" ; ")}.`,
  };
}

function p26(t: TraceHandicap): Verdict {
  if (t.referentNommeEtJoignable && t.reseauActif) {
    return vert(
      "Référent handicap nommé et joignable (saisi, pas le défaut) ; réseau handicap actif au registre.",
    );
  }
  const manques: string[] = [];
  if (!t.referentNommeEtJoignable) manques.push("référent handicap non saisi ou injoignable");
  if (!t.reseauActif) manques.push("aucun partenariat réseau handicap actif");
  return { etat: "rouge", trace: null, manque: `Manque : ${manques.join(" ; ")}.` };
}

function p27(t: TraceSousTraitance, c: ContexteVoyants): Verdict {
  if (t.sousTraitants === 0) return sansObjet("Aucun sous-traitant sur cette session.");
  if (t.controlesConformes >= t.sousTraitants && t.dernierControle !== null) {
    return vert(
      `${t.controlesConformes}/${t.sousTraitants} sous-traitants contrôlés conformes, le dernier le ${jour(t.dernierControle)}.`,
    );
  }
  return sansTrace(
    c.dateDebut,
    c.maintenant,
    `${t.sousTraitants - t.controlesConformes} sous-traitant(s) sans contrôle conforme tracé.`,
  );
}

function p30(t: TraceAppreciations, c: ContexteVoyants): Verdict {
  if (t.stagiairesActifs === 0) return sansObjet("Aucun stagiaire actif.");
  if (t.chaudRepondus >= t.stagiairesActifs && t.dernierRepondu !== null) {
    return vert(
      `${t.chaudRepondus}/${t.stagiairesActifs} questionnaires à chaud RÉPONDUS, le dernier le ${jour(t.dernierRepondu)}.`,
    );
  }
  return sansTrace(
    new Date(c.dateFin.getTime() + DELAI_APRES_SESSION_JOURS * MS_JOUR),
    c.maintenant,
    `${t.stagiairesActifs - t.chaudRepondus} questionnaire(s) à chaud sans réponse.`,
    t.chaudRepondus > 0 ? `${t.chaudRepondus}/${t.stagiairesActifs} réponses.` : null,
  );
}

function p31(t: TraceReclamations): Verdict {
  if (t.reclamations.length === 0)
    return sansObjet("Aucune réclamation rattachée à cette session.");
  const incompletes = t.reclamations.filter(
    (r) =>
      !(["reception", "accuse", "reponse", "cloture"] as const).every((e) => r.etapes.includes(e)),
  );
  if (incompletes.length === 0) {
    return vert(
      `${t.reclamations.length} réclamation(s), toutes menées de la réception à la clôture (étapes tracées).`,
    );
  }
  return {
    etat: "rouge",
    trace: null,
    manque: `Réclamation(s) sans traitement complet (réception, accusé, réponse, clôture) : ${incompletes.map((r) => r.numero).join(", ")}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Le calcul
// ─────────────────────────────────────────────────────────────────────────────

function evaluer<T>(
  lue: TraceLue<T> | undefined,
  lot: LotSource,
  predicat: (t: T) => Verdict,
): Verdict {
  if (lue === undefined) return nonEvalue("lot_absent", lot);
  if (lue.lecture !== "lue") return nonEvalue(lue.lecture, lot);
  return predicat(lue);
}

/**
 * Les quatorze voyants d'une session. PURE.
 *
 * Une session d'essai rend quatorze `sans_objet` : elle n'entre dans aucun
 * voyant réel, et ses traces ne sont même pas consultées.
 */
export function construireVoyants(
  traces: TracesVoyants | undefined,
  c: ContexteVoyants,
): ReadonlyArray<Voyant> {
  const t = traces ?? {};
  const verdicts: Record<IndicateurAVoyant, Verdict> = c.estTestInterne
    ? (Object.fromEntries(
        INDICATEURS_A_VOYANT.map((n) => [
          n,
          sansObjet("Session d'essai : exclue des voyants réels."),
        ]),
      ) as Record<IndicateurAVoyant, Verdict>)
    : {
        4: evaluer(t.i4, "L03", (x) => p4(x, c)),
        6: evaluer(t.i6, "L04", (x) => p6(x, c)),
        9: evaluer(t.i9, "L05", (x) => p9(x, c)),
        10: evaluer(t.i10, "L15", (x) => p10(x, c)),
        11: evaluer(t.i11, "L08", (x) => p11(x, c)),
        12: evaluer(t.i12, "L06", p12),
        17: evaluer(t.i17, "L07", (x) => p17(x, c)),
        19: evaluer(t.i19, "L08", (x) => p19(x, c)),
        21: evaluer(t.i21, "L14", (x) => p21(x, c)),
        23: evaluer(t.i23, "L10", (x) => p23(x, c)),
        26: evaluer(t.i26, "L15", (x) => p26(x)),
        27: evaluer(t.i27, "L14", (x) => p27(x, c)),
        30: evaluer(t.i30, "L08", (x) => p30(x, c)),
        31: evaluer(t.i31, "L09", (x) => p31(x)),
      };
  return INDICATEURS_A_VOYANT.map((n) => ({
    indicateur: n,
    libelle: LIBELLES[n].libelle,
    lot: LIBELLES[n].lot,
    ...verdicts[n],
  }));
}

/** Les voyants qui appellent un geste : `rouge`. (`en_attente` n'accuse personne.) */
export function voyantsRouges(voyants: ReadonlyArray<Voyant>): ReadonlyArray<Voyant> {
  return voyants.filter((v) => v.etat === "rouge");
}

/** Le pire état d'une série de voyants, `sans_objet` si rien ne compte. Réutilise la gravité du parcours. */
export function etatGlobalVoyants(voyants: ReadonlyArray<Voyant>): EtatVoyant {
  if (voyants.some((v) => v.etat === "rouge")) return "rouge";
  if (voyants.some((v) => v.etat === "non_evalue")) return "non_evalue";
  if (voyants.some((v) => v.etat === "en_attente")) return "en_attente";
  if (voyants.some((v) => v.etat === "vert")) return "vert";
  return "sans_objet";
}

/** Vrai si le voyant, rouge, mérite un geste (cohérent avec `appelleUneAction` du parcours). */
export function voyantAppelleUneAction(v: Voyant): boolean {
  return v.etat === "rouge" && appelleUneAction("rattrapable");
}
