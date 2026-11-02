/**
 * Collecte INTERNE du rapport d'analyse avant audit (2026-11-02) — module PUR, sans base, sans IA.
 *
 * Rôle : transformer les réponses d'un ou plusieurs questionnaires avant audit d'un client en un
 * dossier de données COMPLET et classé, que les agents liront ensuite :
 *   · l'ANNEXE INTÉGRALE : chaque réponse de chaque personne, mot pour mot, avec la question en
 *     français, sa rubrique et l'état du pré-remplissage (rien n'est résumé, rien n'est perdu) ;
 *   · la matrice de COUVERTURE : ce qui n'a PAS été répondu (par personne, avec le caractère
 *     « essentiel » de la question) et quelles personnes manquent ;
 *   · les alertes (réponse illisible, écartée, dirigeant sans son code…).
 *
 * Générique : aucun identifiant de champ n'est codé en dur. Les questions viennent du HTML déposé
 * (`libellesDuHtml`, `squeletteDuHtml`) ; un questionnaire dont le HTML manque ou n'est pas lisible
 * donne quand même toute l'annexe (libellés de repli) et une couverture « estimée ».
 *
 * Confidentialité : le code personnel du dirigeant n'apparaît jamais ; celui d'un collaborateur
 * est réduit à « …abcd ». Une réponse mise à l'écart n'est jamais lue.
 */

import type { EtatPrefill, ReponseLisible } from "../questionnaire-preaudit/donnees";
import {
  libelleDe,
  libellesDuHtml,
  rubriqueDe,
  type Libelles,
} from "../questionnaire-preaudit/libelles";
import {
  estRempliePourLaPage,
  squeletteDuHtml,
  tauxDeReponses,
  type ParcoursSquelette,
  type Squelette,
  type TauxDeReponses,
} from "../questionnaire-preaudit/squelette";
import type { Tableau } from "../questionnaire-preaudit/lecture";

// ── Entrées ─────────────────────────────────────────────────────────────────

export interface QuestionnaireACollecter {
  readonly id: string;
  readonly ref: string;
  readonly envoyeLe: Date | null;
  readonly closLe: Date | null;
  /** Le HTML déposé (celui que les personnes ont rempli) ; `null` s'il manque. */
  readonly html: string | null;
  /** Toutes les lignes reçues (renvois compris), telles que `lireReponses` les rend. */
  readonly reponses: ReadonlyArray<ReponseLisible>;
}

// ── Sorties ─────────────────────────────────────────────────────────────────

export type StatutPersonne = "recue" | "illisible" | "ecartee";

export interface ChampCollecte {
  readonly cle: string;
  /** La question, en français, telle que la personne l'a lue. */
  readonly question: string;
  /** Rubrique de la question (« Entreprise », « Outils »…), ou `null`. */
  readonly rubrique: string | null;
  /** La réponse, mot pour mot. */
  readonly reponse: string;
  /** Présent seulement si la case avait été pré-remplie par Axion. */
  readonly prefill?: EtatPrefill;
}

export interface ChampNonRepondu {
  readonly cle: string;
  readonly question: string;
  readonly rubrique: string | null;
  /** Question visible sans « Aller plus loin » (parcours de base). */
  readonly essentielle: boolean;
}

export interface PersonneCollectee {
  /** `main`, `it` ou `emp:<…abcd>` : stable pour un même questionnaire. */
  readonly cle: string;
  readonly mode: "main" | "emp" | "it";
  /** « …abcd » pour un collaborateur ; `null` pour le dirigeant et le référent sans code. */
  readonly codeCourt: string | null;
  readonly questionnaireId: string;
  readonly statut: StatutPersonne;
  /** Nombre de versions reçues (renvois corrigés compris) ; la plus récente non écartée est lue. */
  readonly nbVersions: number;
  readonly recuLe: Date;
  /** Réponse du dirigeant reçue sans son code : peut venir d'un salarié. */
  readonly aVerifier: boolean;
  /** Service déclaré (collaborateur), ou `null`. */
  readonly service: string | null;
  /** Toutes les réponses remplies, dans l'ordre reçu. */
  readonly champs: ReadonlyArray<ChampCollecte>;
  /** Champs répétables (équipe, tâches, logiciels…), lisibles. */
  readonly tableaux: ReadonlyArray<Tableau>;
  /** Questions du parcours restées sans réponse (vide si le squelette est illisible). */
  readonly nonRepondus: ReadonlyArray<ChampNonRepondu>;
  /** Cases pré-remplies par Axion : combien confirmées, modifiées, non vérifiées, vidées. */
  readonly prefill: Readonly<Record<EtatPrefill, number>>;
  /** Taux de réponses (essentielles), ou `null` sans squelette. */
  readonly taux: TauxDeReponses | null;
}

export interface QuestionnaireCollecte {
  readonly id: string;
  readonly ref: string;
  readonly envoyeLe: Date | null;
  readonly closLe: Date | null;
  readonly nbLignesRecues: number;
  /** Faux : le HTML manque ou n'a pas été lu en entier → couverture estimée. */
  readonly squeletteLu: boolean;
}

export interface Alerte {
  readonly niveau: "info" | "attention" | "rouge";
  readonly texte: string;
}

export interface CollecteReponses {
  readonly questionnaires: ReadonlyArray<QuestionnaireCollecte>;
  readonly personnes: ReadonlyArray<PersonneCollectee>;
  readonly alertes: ReadonlyArray<Alerte>;
  readonly totaux: {
    readonly personnesAvecReponse: number;
    readonly reponsesDonnees: number;
    readonly questionsSansReponse: number;
  };
}

// ── Petits outils ───────────────────────────────────────────────────────────

const PREFILL_VIDE: Readonly<Record<EtatPrefill, number>> = {
  confirme: 0,
  modifie: 0,
  non_verifie: 0,
  vide: 0,
};

const MODES: ReadonlyArray<ParcoursSquelette> = ["main", "emp", "it"];

function courtDe(membre: string): string {
  return `…${membre.slice(-4)}`;
}

function parcoursValide(m: string): m is ParcoursSquelette {
  return (MODES as ReadonlyArray<string>).includes(m);
}

function donneesDeLaLecture(brut: string): Readonly<Record<string, unknown>> {
  try {
    const o: unknown = JSON.parse(brut);
    if (typeof o === "object" && o !== null && !Array.isArray(o)) {
      const d = (o as Record<string, unknown>)["donnees"];
      if (typeof d === "object" && d !== null && !Array.isArray(d)) {
        return d as Record<string, unknown>;
      }
    }
  } catch {
    // charge illisible : aucune donnée brute
  }
  return {};
}

function valeurEntete(r: ReponseLisible, libelle: string): string | null {
  const p = r.lecture?.entete.find((x) => x.libelle === libelle);
  return p === undefined || p.valeur === "" ? null : p.valeur;
}

// ── Une personne ────────────────────────────────────────────────────────────

function collecterPersonne(
  q: QuestionnaireACollecter,
  versions: ReadonlyArray<ReponseLisible>,
  libelles: Libelles,
  sq: Squelette | null,
): PersonneCollectee {
  // La plus récente version NON écartée ; sinon la plus récente tout court.
  const triees = [...versions].sort((a, b) => b.recuLe.getTime() - a.recuLe.getTime());
  const lue = triees.find((v) => v.ecarteLe === null) ?? (triees[0] as ReponseLisible);
  const mode = lue.mode;
  const membre = lue.membre;
  const cle = mode === "emp" ? `emp:${membre === null ? "sans-code" : courtDe(membre)}` : mode;
  const base = {
    cle,
    mode,
    codeCourt: mode === "emp" && membre !== null ? courtDe(membre) : null,
    questionnaireId: q.id,
    nbVersions: versions.length,
    recuLe: lue.recuLe,
    aVerifier:
      mode === "main" && membre === null && valeurEntete(lue, "Lien personnel (code)") === null,
  };
  if (lue.ecarteLe !== null) {
    return {
      ...base,
      statut: "ecartee",
      service: null,
      champs: [],
      tableaux: [],
      nonRepondus: [],
      prefill: PREFILL_VIDE,
      taux: null,
    };
  }
  if (lue.illisible || lue.lecture === null) {
    return {
      ...base,
      statut: "illisible",
      service: null,
      champs: [],
      tableaux: [],
      nonRepondus: [],
      prefill: PREFILL_VIDE,
      taux: null,
    };
  }

  const lecture = lue.lecture;
  const champs: ChampCollecte[] = lecture.champs
    .filter((c) => c.valeur.trim() !== "")
    .map((c) => ({
      cle: c.cle,
      question: libelleDe(c.cle, libelles, mode),
      rubrique: rubriqueDe(c.cle),
      reponse: c.valeur,
      ...(c.prefill !== undefined ? { prefill: c.prefill } : {}),
    }));

  const donnees = donneesDeLaLecture(lecture.brut);
  const exclus = new Set<string>();
  const prefill: Record<EtatPrefill, number> = { ...PREFILL_VIDE };
  for (const b of lecture.prefill) {
    prefill[b.etat] += b.cles.length;
    // Une case pré-remplie jamais touchée n'est pas une réponse de la personne.
    if (b.etat === "non_verifie") for (const c of b.cles) exclus.add(c);
  }

  let nonRepondus: ChampNonRepondu[] = [];
  let taux: TauxDeReponses | null = null;
  if (sq !== null && parcoursValide(mode)) {
    const p = sq.parcours[mode];
    const remplie = (id: string): boolean =>
      !id.startsWith("_") && !exclus.has(id) && estRempliePourLaPage(donnees[id]);
    nonRepondus = [...p.toutes]
      .filter((id) => !remplie(id))
      .map((id) => ({
        cle: id,
        question: libelleDe(id, libelles, mode),
        rubrique: rubriqueDe(id),
        essentielle: p.essentielles.has(id),
      }));
    taux = tauxDeReponses(donnees, sq, mode, exclus);
  }

  return {
    ...base,
    statut: "recue",
    service: valeurEntete(lue, "Service"),
    champs,
    tableaux: lecture.tableaux,
    nonRepondus,
    prefill,
    taux,
  };
}

// ── Le dossier entier ───────────────────────────────────────────────────────

export function collecterReponses(
  questionnaires: ReadonlyArray<QuestionnaireACollecter>,
): CollecteReponses {
  const personnes: PersonneCollectee[] = [];
  const alertes: Alerte[] = [];
  const resume: QuestionnaireCollecte[] = [];

  for (const q of questionnaires) {
    const libelles =
      q.html === null ? { normal: new Map(), it: new Map() } : libellesDuHtml(q.html);
    const sq = q.html === null ? null : squeletteDuHtml(q.html);
    resume.push({
      id: q.id,
      ref: q.ref,
      envoyeLe: q.envoyeLe,
      closLe: q.closLe,
      nbLignesRecues: q.reponses.length,
      squeletteLu: sq !== null,
    });
    if (q.html === null) {
      alertes.push({
        niveau: "attention",
        texte: `Questionnaire ${q.ref} : le texte des questions est introuvable, les libellés sont déduits des rubriques.`,
      });
    } else if (sq === null) {
      alertes.push({
        niveau: "attention",
        texte: `Questionnaire ${q.ref} : la liste des questions n'a pas pu être lue, la couverture est estimée.`,
      });
    }

    const groupes = new Map<string, ReponseLisible[]>();
    for (const r of q.reponses) {
      const k = `${r.mode}|${r.membre ?? ""}`;
      groupes.set(k, [...(groupes.get(k) ?? []), r]);
    }
    for (const versions of groupes.values()) {
      const p = collecterPersonne(q, versions, libelles, sq);
      personnes.push(p);
      if (p.statut === "illisible") {
        alertes.push({
          niveau: "rouge",
          texte: `Une réponse (${p.cle}, reçue le ${p.recuLe.toISOString().slice(0, 10)}) est ILLISIBLE : elle n'est pas dans l'analyse. À vérifier avant de poursuivre.`,
        });
      }
      if (p.statut === "ecartee") {
        alertes.push({
          niveau: "info",
          texte: `Une réponse (${p.cle}) a été mise à l'écart sur demande d'effacement : elle n'est pas lue.`,
        });
      }
      if (p.aVerifier) {
        alertes.push({
          niveau: "attention",
          texte:
            "La réponse « dirigeant » est arrivée sans son code personnel : elle peut venir d'un salarié.",
        });
      }
    }
  }

  const avecReponse = personnes.filter((p) => p.statut === "recue");
  return {
    questionnaires: resume,
    personnes,
    alertes,
    totaux: {
      personnesAvecReponse: avecReponse.length,
      reponsesDonnees: avecReponse.reduce((n, p) => n + p.champs.length, 0),
      questionsSansReponse: avecReponse.reduce((n, p) => n + p.nonRepondus.length, 0),
    },
  };
}
