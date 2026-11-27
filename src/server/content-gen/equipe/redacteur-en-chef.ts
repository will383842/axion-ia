/**
 * Rédacteur en chef de l'équipe éditoriale (PR 11).
 *
 * Dans ce circuit, le juge Opus existant (`reviewer/llm-judge.ts`) EST le rédacteur en chef :
 * il note l'utilité pour un dirigeant (Q12). Il n'y a pas de second juge. Tout le reste de la
 * grille Q1-Q13 et toutes les règles de décision sont du code pur, testé, sans modèle.
 *
 * Éteint par défaut : seul `CONTENT_EQUIPE_EDITORIALE="true"` l'allume. Éteint, `jugerPourCircuit`
 * appelle le juge actuel avec exactement les mêmes arguments (comportement d'avant).
 */

import {
  equipeEditorialeActive,
  type EnvEquipeEditoriale,
} from "../fact-check/equipe-editoriale-drapeau";
import {
  reviewArticle,
  JUDGE_THRESHOLDS,
  type ArticleForReview,
  type JudgeResult,
  type JudgeThresholds,
} from "../reviewer/llm-judge";
import { exigeRelectureHumaine, type ContenuARelire } from "../quality/relecture-journee-ia";
import {
  PLANCHER_MOTS_RELECTURE,
  TYPES_PLANCHER_MOTS,
  TYPES_SANS_FAIT_DE_BASE,
} from "../quality/barrieres-publication";
import { detecterTutoiement } from "../quality/vouvoiement";
import {
  PASSAGES_CITABLES_MIN,
  compterMots,
  detecterPassagesCitables,
  extraireBlocs,
  texteSansBalises,
} from "../quality/passages-citables";
import { normaliserTitre } from "../quality/outline-validator";
import { MOTS_REPONSE_MAX, MOTS_REPONSE_MIN } from "./plan";
import { MOTS_PAR_PHRASE_MAX } from "./redaction";
import type { Brief } from "./brief";
import type { DecisionGardien } from "./gardien";
import type { ResultatConformite } from "./conformite";

// ── Constantes ──────────────────────────────────────────────────────────────

export const PLAFOND_COUT_ARTICLE_USD = 3;
export const RENVOIS_MAX = 2;
export const NOTE_PUBLICATION_MIN = 8.5;
export const NOTE_UTILITE_DIRIGEANT_MIN = 8.5;
export const MOTS_REPONSE_FENETRE = 100;

export type CodeCritere =
  "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8" | "Q9" | "Q10" | "Q11" | "Q12" | "Q13";

/** `bloquant` : renvoi ou arrêt. `renvoi` : un renvoi groupé. `relecture` : relecture humaine. */
export type NatureCritere = "bloquant" | "renvoi" | "relecture";

export type Role = "redacteur" | "verificateur" | "mailleur" | "architecte" | "editeur-seo";

export const NATURE: Readonly<Record<CodeCritere, NatureCritere>> = {
  Q1: "bloquant",
  Q2: "bloquant",
  Q3: "bloquant",
  Q4: "bloquant",
  Q5: "bloquant",
  Q6: "bloquant",
  Q7: "relecture",
  Q8: "renvoi",
  Q9: "renvoi",
  Q10: "renvoi",
  Q11: "renvoi",
  Q12: "renvoi",
  Q13: "relecture",
};

/** Rôle(s) à qui renvoyer, dans l'ordre. Q3 : arrêt, aucun rôle. */
export const ROLES_RESPONSABLES: Readonly<Record<CodeCritere, ReadonlyArray<Role>>> = {
  Q1: ["redacteur"],
  Q2: ["verificateur", "redacteur"],
  Q3: [],
  Q4: ["mailleur"],
  Q5: ["architecte"],
  Q6: ["editeur-seo"],
  Q7: [],
  Q8: ["architecte"],
  Q9: ["redacteur"],
  Q10: ["editeur-seo"],
  Q11: ["editeur-seo"],
  Q12: ["redacteur"],
  Q13: [],
};

/** Écarts mineurs tolérés si la note atteint le seuil de publication. */
export const ECARTS_MINEURS: ReadonlySet<CodeCritere> = new Set<CodeCritere>(["Q9", "Q10", "Q11"]);

const LIBELLES: Readonly<Record<CodeCritere, string>> = {
  Q1: "Conformité : écart relevé",
  Q2: "Chiffre sans source dans le dossier de preuves",
  Q3: "Doublon avec un article existant",
  Q4: "Lien invalide",
  Q5: "Structure des titres défaillante",
  Q6: "Réponse directe absente ou hors format (40-60 mots, mot-clé, début de page)",
  Q7: "Aucun fait de la base de connaissances",
  Q8: "Question du brief non couverte",
  Q9: "Lisibilité ou tutoiement",
  Q10: "Moins de 3 passages citables",
  Q11: "Entité du brief absente",
  Q12: "Utilité pour un dirigeant sous le seuil",
  Q13: "Article trop court",
};

// ── Grille ──────────────────────────────────────────────────────────────────

export interface EntreeGrille {
  readonly html: string;
  readonly h1?: string | undefined;
  readonly brief: Pick<Brief, "motCle" | "entites" | "questions">;
  readonly faq?: ReadonlyArray<{ readonly q: string; readonly a?: string | undefined }> | undefined;
  /** Rapport de `conformite.ts` (`undefined` = non contrôlé : critère non rempli). */
  readonly conformite?: ResultatConformite | undefined;
  /** Passages avec un chiffre hors dossier (rapport du vérificateur / `chiffresHorsDossier`). */
  readonly chiffresHorsDossier: ReadonlyArray<string>;
  /** Décision du gardien de doublons. */
  readonly gardien?: DecisionGardien | undefined;
  /** Rapport du mailleur : un verdict par lien. */
  readonly liens: ReadonlyArray<{
    readonly url: string;
    readonly verdict: { readonly ok: boolean };
  }>;
  readonly kbEntryIds?: ReadonlyArray<string> | null | undefined;
  readonly contentType?: string | undefined;
  /** Q12 : note /10 d'utilité pour un dirigeant, donnée par le modèle. `undefined` = non évaluée. */
  readonly noteUtilite?: number | undefined;
}

export interface ResultatCritere {
  readonly code: CodeCritere;
  readonly nature: NatureCritere;
  readonly ok: boolean;
  /** Faux : critère non évalué (ex. Q12 quand un bloquant a déjà échoué). */
  readonly evalue: boolean;
  readonly libelle: string;
  /** Passages exacts à corriger (Q1, Q2…). */
  readonly passages: ReadonlyArray<string>;
  /** Vrai : le contrôle lui-même est en panne (rapport absent, erreur, arbitrage incertain) : relecture humaine. */
  readonly panne?: boolean;
}

const resultat = (
  code: CodeCritere,
  ok: boolean,
  passages: ReadonlyArray<string> = [],
  evalue = true,
  panne = false,
): ResultatCritere => ({
  code,
  nature: NATURE[code],
  ok: ok || !evalue,
  evalue,
  libelle: LIBELLES[code],
  passages,
  ...(panne ? { panne } : {}),
});

const contient = (texte: string, motif: string): boolean => {
  const m = normaliserTitre(motif);
  return m.length > 0 && ` ${normaliserTitre(texte)} `.includes(` ${m} `);
};

/** Niveaux des titres dans l'ordre du document (`h1` fourni compté en tête). */
function niveauxTitres(html: string): Array<{ niveau: number; texte: string }> {
  return [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    niveau: Number(m[1]),
    texte: texteSansBalises(m[2] ?? ""),
  }));
}

export function defautsStructure(html: string, h1?: string): string[] {
  const defauts: string[] = [];
  const titres = niveauxTitres(html);
  const nbH1 = titres.filter((t) => t.niveau === 1).length + (h1 && h1.trim() ? 1 : 0);
  if (nbH1 !== 1) defauts.push(`${nbH1} titre(s) de niveau 1 (un seul attendu)`);
  if (!titres.some((t) => t.niveau === 2)) defauts.push("aucun titre de niveau 2");
  let precedent = h1 && h1.trim() ? 1 : 0;
  const vusH2 = new Set<string>();
  for (const t of titres) {
    if (t.texte.trim() === "") defauts.push(`titre de niveau ${t.niveau} vide`);
    if (precedent > 0 && t.niveau > precedent + 1) {
      defauts.push(`saut de niveau h${precedent} → h${t.niveau} (« ${t.texte} »)`);
    }
    if (precedent === 0 && t.niveau > 2)
      defauts.push(`h${t.niveau} avant tout h2 (« ${t.texte} »)`);
    if (t.niveau === 2) {
      const k = normaliserTitre(t.texte);
      if (vusH2.has(k)) defauts.push(`titre de niveau 2 en double (« ${t.texte} »)`);
      vusH2.add(k);
    }
    precedent = t.niveau;
  }
  return defauts;
}

/** Première réponse directe : premier paragraphe de 40 à 60 mots, dans les 100 premiers mots, avec le mot-clé. */
export function reponseDirecteConforme(html: string, motCle: string): boolean {
  const premier = extraireBlocs(html, "p")[0];
  if (!premier) return false;
  const n = compterMots(premier);
  if (n < MOTS_REPONSE_MIN || n > MOTS_REPONSE_MAX || n > MOTS_REPONSE_FENETRE) return false;
  const debutP = html.search(/<p\b/i);
  const avant = debutP > 0 ? html.slice(0, debutP) : "";
  if (compterMots(texteSansBalises(avant)) + n > MOTS_REPONSE_FENETRE) return false;
  return contient(premier, motCle);
}

function moyenneMotsParPhrase(texte: string): number {
  const phrases = texte.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0);
  if (phrases.length === 0) return 0;
  return compterMots(texte) / phrases.length;
}

function questionsNonCouvertes(
  questions: EntreeGrille["brief"]["questions"],
  html: string,
  faq: EntreeGrille["faq"],
): string[] {
  const titres = [...niveauxTitres(html).map((t) => t.texte), ...(faq ?? []).map((f) => f.q)];
  const corpus = new Set(normaliserTitre(titres.join(" ")).split(" ").filter(Boolean));
  return questions
    .map((q) => q.question)
    .filter((q) => {
      const jetons = normaliserTitre(q)
        .split(" ")
        .filter((j) => j.length > 3);
      if (jetons.length === 0) return false;
      const presents = jetons.filter((j) => corpus.has(j)).length;
      return presents / jetons.length < 0.6;
    });
}

export function evaluerGrille(e: EntreeGrille): ResultatCritere[] {
  const texte = texteSansBalises(e.html);
  const out: ResultatCritere[] = [];

  // Q1 — conformité : aucun constat (un rapport absent n'est pas un feu vert).
  const panneQ1 =
    !e.conformite ||
    e.conformite.constats.some(
      (c) => c.code === "erreur-conformite" || /sortie vide/i.test(c.libelle),
    );
  out.push(
    e.conformite
      ? resultat(
          "Q1",
          e.conformite.constats.length === 0,
          e.conformite.constats.map((c) => c.libelle),
          true,
          panneQ1,
        )
      : resultat("Q1", false, ["rapport de conformité absent"], true, true),
  );
  // Q2 — chiffres sourcés à 100 %.
  out.push(resultat("Q2", e.chiffresHorsDossier.length === 0, e.chiffresHorsDossier));
  // Q3 — doublon : le gardien a écarté ou renvoyé vers une mise à jour.
  const doublon = e.gardien?.decision === "ecarter" || e.gardien?.decision === "mettre_a_jour";
  const panneQ3 = !e.gardien || e.gardien.decision === "relecture_humaine";
  out.push(
    resultat(
      "Q3",
      !doublon && !panneQ3,
      e.gardien && (doublon || panneQ3)
        ? [e.gardien.raison]
        : panneQ3
          ? ["décision du gardien absente"]
          : [],
      true,
      panneQ3 && !doublon,
    ),
  );
  // Q4 — liens valides à 100 %.
  const liensKo = e.liens.filter((l) => !l.verdict.ok).map((l) => l.url);
  out.push(resultat("Q4", liensKo.length === 0, liensKo));
  // Q5 — structure des titres.
  const defauts = defautsStructure(e.html, e.h1);
  out.push(resultat("Q5", defauts.length === 0, defauts));
  // Q6 — réponse directe.
  out.push(resultat("Q6", reponseDirecteConforme(e.html, e.brief.motCle)));
  // Q7 — un fait de la base (sauf types qui n'en ont pas).
  const sansBase = e.contentType !== undefined && TYPES_SANS_FAIT_DE_BASE.has(e.contentType);
  out.push(resultat("Q7", sansBase || (e.kbEntryIds?.length ?? 0) > 0));
  // Q8 — couverture des questions.
  const nonCouv = questionsNonCouvertes(e.brief.questions, e.html, e.faq);
  out.push(resultat("Q8", nonCouv.length === 0, nonCouv));
  // Q9 — lisibilité et tutoiement.
  const tutoie = detecterTutoiement(e.html).tutoie;
  const phrases = moyenneMotsParPhrase(texte);
  out.push(
    resultat("Q9", !tutoie && phrases <= MOTS_PAR_PHRASE_MAX, [
      ...(tutoie ? ["tutoiement"] : []),
      ...(phrases > MOTS_PAR_PHRASE_MAX
        ? [`phrases trop longues (${phrases.toFixed(1)} mots en moyenne)`]
        : []),
    ]),
  );
  // Q10 — passages citables.
  out.push(
    resultat("Q10", detecterPassagesCitables(e.html).citables.length >= PASSAGES_CITABLES_MIN),
  );
  // Q11 — entités.
  const absentes = e.brief.entites.filter((en) => !contient(texte, en));
  out.push(resultat("Q11", absentes.length === 0, absentes));
  // Q12 — utilité pour un dirigeant (modèle).
  out.push(
    e.noteUtilite === undefined
      ? resultat("Q12", false, [], false)
      : resultat("Q12", e.noteUtilite >= NOTE_UTILITE_DIRIGEANT_MIN),
  );
  // Q13 — longueur minimale (types concernés seulement).
  const exigePlancher = e.contentType === undefined || TYPES_PLANCHER_MOTS.has(e.contentType);
  out.push(resultat("Q13", !exigePlancher || compterMots(texte) >= PLANCHER_MOTS_RELECTURE));
  return out;
}

// ── Décision (code pur) ─────────────────────────────────────────────────────

export interface Renvoi {
  readonly role: Role;
  /** Rôles qui reprennent ensuite, dans l'ordre (Q2 : le rédacteur après le vérificateur). */
  readonly suite: ReadonlyArray<Role>;
  readonly criteres: ReadonlyArray<CodeCritere>;
  readonly passages: ReadonlyArray<string>;
}

export type DecisionEnChef =
  | { readonly type: "inchange" }
  | { readonly type: "publier" }
  | { readonly type: "a_relire"; readonly blockCauses: ReadonlyArray<string> }
  | { readonly type: "arret"; readonly blockCauses: ReadonlyArray<string> }
  | { readonly type: "relecture_humaine"; readonly blockCauses: ReadonlyArray<string> }
  | { readonly type: "renvoi"; readonly renvois: ReadonlyArray<Renvoi> };

export interface ContexteDecision {
  /** Nombre de renvois déjà faits pour cet article. */
  readonly renvoisFaits: number;
  readonly coutDepenseUsd: number;
  readonly sujetJourneeIA: boolean;
  /** Note globale du modèle /10 (`undefined` = non notée). */
  readonly noteGlobale?: number | undefined;
  readonly erreurModele?: boolean | undefined;
}

const cause = (r: ResultatCritere): string =>
  `${r.code} — ${r.libelle}${r.passages.length > 0 ? ` : ${r.passages.slice(0, 3).join(" | ")}` : ""}`;

function renvoisPour(echecs: ReadonlyArray<ResultatCritere>): Renvoi[] {
  const parRole = new Map<Role, { criteres: CodeCritere[]; passages: string[] }>();
  for (const r of echecs) {
    // Q2 : le vérificateur d'abord ; le rédacteur reprend ensuite (même renvoi, rôles en file).
    const role = ROLES_RESPONSABLES[r.code][0];
    if (!role) continue;
    const cur = parRole.get(role) ?? { criteres: [], passages: [] };
    cur.criteres.push(r.code);
    cur.passages.push(...r.passages);
    parRole.set(role, cur);
  }
  return [...parRole.entries()].map(([role, v]) => ({
    role,
    suite: ROLES_RESPONSABLES[v.criteres[0]!].slice(1),
    criteres: v.criteres,
    passages: v.passages,
  }));
}

export function decider(
  grille: ReadonlyArray<ResultatCritere>,
  ctx: ContexteDecision,
): DecisionEnChef {
  const echecs = grille.filter((r) => r.evalue && !r.ok);
  const causes = (liste: ReadonlyArray<ResultatCritere>) => liste.map(cause);

  if (ctx.erreurModele) {
    return {
      type: "relecture_humaine",
      blockCauses: ["Erreur du modèle du rédacteur en chef", ...causes(echecs)],
    };
  }
  const q3 = echecs.find((r) => r.code === "Q3");
  if (q3 && !q3.panne) return { type: "arret", blockCauses: causes([q3]) };
  const pannes = echecs.filter((r) => r.panne);
  if (pannes.length > 0) {
    return { type: "relecture_humaine", blockCauses: causes(echecs) };
  }
  if (ctx.coutDepenseUsd >= PLAFOND_COUT_ARTICLE_USD) {
    return {
      type: "relecture_humaine",
      blockCauses: [
        `Plafond de coût par article atteint (${ctx.coutDepenseUsd.toFixed(2)} $ sur ${PLAFOND_COUT_ARTICLE_USD.toFixed(2)} $)`,
        ...causes(echecs),
      ],
    };
  }

  const bloquants = echecs.filter((r) => r.nature === "bloquant");
  const relectures = echecs.filter((r) => r.nature === "relecture");
  const renvoiables = echecs.filter((r) => r.nature === "renvoi");

  if (bloquants.length > 0) {
    if (ctx.renvoisFaits >= RENVOIS_MAX) {
      return { type: "relecture_humaine", blockCauses: causes(echecs) };
    }
    return { type: "renvoi", renvois: renvoisPour(bloquants) };
  }
  if (relectures.length > 0) {
    return { type: "relecture_humaine", blockCauses: causes(echecs) };
  }
  if (renvoiables.length > 0) {
    const mineurs =
      renvoiables.every((r) => ECARTS_MINEURS.has(r.code)) &&
      (ctx.noteGlobale ?? 0) >= NOTE_PUBLICATION_MIN;
    if (!mineurs) {
      if (ctx.renvoisFaits >= RENVOIS_MAX) {
        return { type: "relecture_humaine", blockCauses: causes(echecs) };
      }
      return { type: "renvoi", renvois: renvoisPour(renvoiables) };
    }
  }
  // Tout vert (ou écarts mineurs avec la note requise).
  if (ctx.sujetJourneeIA) {
    return {
      type: "a_relire",
      blockCauses: ["Contenu qui parle de la Journée IA : relecture humaine obligatoire"],
    };
  }
  return { type: "publier" };
}

// ── Circuit complet (juge Opus = rédacteur en chef) ─────────────────────────

export interface DependancesEnChef {
  /** Défaut : `reviewArticle` (le juge Opus existant). Injectable pour les tests. */
  readonly juger?: (
    article: ArticleForReview,
    thresholds: JudgeThresholds,
    options: { readonly typeBlog?: string },
  ) => Promise<JudgeResult>;
}

export interface EntreeEnChef extends Omit<EntreeGrille, "noteUtilite"> {
  readonly article: ArticleForReview;
  readonly renvoisFaits: number;
  readonly coutDepenseUsd: number;
  readonly journeeIA: ContenuARelire;
  readonly thresholds?: JudgeThresholds | undefined;
}

export interface SortieEnChef {
  readonly decision: DecisionEnChef;
  readonly grille: ReadonlyArray<ResultatCritere>;
  readonly jugement?: JudgeResult | undefined;
}

export async function redacteurEnChef(
  entree: EntreeEnChef,
  deps: DependancesEnChef = {},
  env: EnvEquipeEditoriale = process.env,
): Promise<SortieEnChef> {
  if (!equipeEditorialeActive(env)) return { decision: { type: "inchange" }, grille: [] };

  const sujetJourneeIA = exigeRelectureHumaine(entree.journeeIA);
  const ctxBase = {
    renvoisFaits: entree.renvoisFaits,
    coutDepenseUsd: entree.coutDepenseUsd,
    sujetJourneeIA,
  };
  const sansModele = evaluerGrille(entree);

  // Plafond de coût : pas d'appel au modèle une fois atteint.
  if (entree.coutDepenseUsd >= PLAFOND_COUT_ARTICLE_USD) {
    return { decision: decider(sansModele, ctxBase), grille: sansModele };
  }
  // Un bloquant ou une relecture en échec décide sans modèle (renvoi ou arrêt) : on n'achète pas de note inutile.
  const bloquantEnEchec = sansModele.some((r) => r.nature !== "renvoi" && !r.ok);
  if (bloquantEnEchec) return { decision: decider(sansModele, ctxBase), grille: sansModele };

  const juger = deps.juger ?? reviewArticle;
  let jugement: JudgeResult;
  try {
    jugement = await juger(entree.article, entree.thresholds ?? JUDGE_THRESHOLDS, {
      ...(entree.contentType ? { typeBlog: entree.contentType } : {}),
    });
  } catch {
    return {
      decision: decider(sansModele, { ...ctxBase, erreurModele: true }),
      grille: sansModele,
    };
  }
  const noteUtilite = jugement.dimensions.valueToReader.score;
  const grille = evaluerGrille({ ...entree, noteUtilite });
  // Un P0 du modèle (doctrine, erreur factuelle) n'est jamais publié ni « mineur » : relecture humaine.
  const p0 = jugement.issues.filter((i) => i.severity === "P0");
  if (p0.length > 0) {
    return {
      decision: {
        type: "relecture_humaine",
        blockCauses: p0.map((i) => `Rédacteur en chef (P0) [${i.section}] ${i.issue}`),
      },
      grille,
      jugement,
    };
  }
  return {
    decision: decider(grille, { ...ctxBase, noteGlobale: jugement.globalScore }),
    grille,
    jugement,
  };
}

/**
 * Point d'entrée du circuit : interrupteur éteint = le juge actuel, mêmes arguments, résultat
 * rendu tel quel. Allumé, le rédacteur en chef décide (`redacteurEnChef`).
 */
export async function jugerPourCircuit(
  entree: EntreeEnChef,
  deps: DependancesEnChef = {},
  env: EnvEquipeEditoriale = process.env,
): Promise<
  | { readonly mode: "juge-actuel"; readonly jugement: JudgeResult }
  | ({ readonly mode: "en-chef" } & SortieEnChef)
> {
  if (!equipeEditorialeActive(env)) {
    const juger = deps.juger ?? reviewArticle;
    const jugement = await juger(entree.article, entree.thresholds ?? JUDGE_THRESHOLDS, {
      ...(entree.contentType ? { typeBlog: entree.contentType } : {}),
    });
    return { mode: "juge-actuel", jugement };
  }
  return { mode: "en-chef", ...(await redacteurEnChef(entree, deps, env)) };
}
