/**
 * R5 · Expert métier critique, « le dirigeant de PME exigeant » (conception § 3 ; PR C8). Modèle : Opus.
 *
 * Il lit le texte comme un dirigeant de PME du secteur ciblé, sans indulgence, sur une grille de
 * 6 questions. INDÉPENDANT du rédacteur par instruction et par contexte : il ne reçoit que le
 * texte final et le titre, jamais le brief détaillé ni le raisonnement de R4 (parade au « juge
 * partial »). Le modèle note ; le CODE tranche :
 *  - une note < 3 sur Q1 (apprend-on quelque chose ?) ou Q3 (ordres de grandeur crédibles et
 *    sourcés ?) refuse, même si le modèle écrit « ok » ;
 *  - un « ok » accompagné de corrections n'est pas un « ok » ;
 *  - le conseil de « le faire soi-même » est détecté par le code (la mise en place revient à Axion-IA) ;
 *  - une correction vers une section inexistante devient globale.
 * Q5 (remplissage) et Q6 (que manque-t-il ?) reçoivent les mesures d'équilibre du code (§ 7.4).
 * Aucune entrée-sortie : l'appel au modèle est injecté.
 */

import { z } from "zod";
import type { CodeRefus } from "../codes-refus";
import {
  CONSIGNE_DONNEES,
  REGLES_MARQUE_PROMPT,
  appelerRole,
  encadrerDonnees,
  lireJson,
  type AppelModele,
  type CompteurCout,
  type Correction,
} from "./commun";
import { mesurerEquilibre } from "./equilibre-sections";
import type { Gabarit, TypeSection } from "./structure-hn";

export const NOTE_MIN_REFUS = 3;
export const MAX_CORRECTIONS = 10;

export type CodeRefusExpert = Extract<
  CodeRefus,
  "generique" | "non_actionnable" | "fait_non_source"
>;

export interface EntreeExpert {
  readonly titre: string;
  readonly lecteur: { readonly profil: "pme" | "tpe"; readonly metier: string };
  /** Secteur du dirigeant à incarner (ex. « services », « BTP »). */
  readonly secteur: string;
  readonly directAnswer: string;
  readonly bodyHtml: string;
  readonly faq: ReadonlyArray<{ readonly question: string; readonly answer: string }>;
  readonly types: ReadonlyArray<TypeSection>;
  readonly gabarit: Gabarit;
}

export interface NotesExpert {
  readonly q1: number;
  readonly q2: number;
  readonly q3: number;
  readonly q4: number;
  readonly q5: number;
  readonly q6: number;
}

export type ResultatExpert =
  | {
      readonly verdict: "ok" | "reecrire" | "abandonner";
      readonly notes: NotesExpert;
      readonly corrections: ReadonlyArray<Correction>;
      /** Code de raison de refus quand le verdict n'est pas « ok » ; `null` sinon. */
      readonly codeRefus: CodeRefusExpert | null;
    }
  | { readonly verdict: "illisible"; readonly raison: string };

const note = z.number().int().min(1).max(5);
const sortieSchema = z
  .object({
    verdict: z.enum(["ok", "reecrire", "abandonner"]),
    notes: z.object({ q1: note, q2: note, q3: note, q4: note, q5: note, q6: note }).strict(),
    corrections: z
      .array(
        z
          .object({
            section: z.union([
              z.number().int().min(0),
              z.literal("directAnswer"),
              z.literal("faq"),
              z.literal("global"),
            ]),
            probleme: z.string().trim().min(1).max(300),
            attendu: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .max(MAX_CORRECTIONS),
  })
  .strict();

/** Code de refus par question de la grille (conception § 7.1 : `non_actionnable` est propre à R5). */
const CODE_PAR_QUESTION: Readonly<Record<keyof NotesExpert, CodeRefusExpert>> = {
  q1: "generique",
  q2: "non_actionnable",
  q3: "fait_non_source",
  q4: "generique",
  q5: "generique",
  q6: "non_actionnable",
};

const FAIRE_SEUL =
  /(vous pouvez (?:le |la |les )?(?:faire|mettre en place|déployer|installer)\s+(?:vous[- ]même|seul(?:e)?)|en autonomie complète|faites-le vous[- ]même)/i;

const sansBalises = (h: string) =>
  h
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const SYSTEM = [
  "Tu es un dirigeant de PME du secteur indiqué, exigeant et sans indulgence. Tu lis un article qu'on te soumet. Tu ne connais pas le raisonnement de son auteur : tu juges le texte seul.",
  "Note de 1 à 5 chaque question : q1 apprends-tu quelque chose que tu ne savais pas ? q2 sais-tu quoi décider ou quoi demander cette semaine ? (Axion-IA s'occupe de la mise en place : un texte qui suggère de la faire seul est mauvais) q3 tout ordre de grandeur cité est-il crédible et sourcé ? (jamais un résultat chiffré attribué à Axion-IA) q4 un conseiller sensé dirait-il la même chose ? q5 y a-t-il du remplissage ? (5 = aucun) q6 que manque-t-il pour décider ? (5 = rien).",
  "Verdict : ok, reecrire (corrections localisées : section = index du H2 en partant de 0, ou directAnswer, faq, global ; probleme ; attendu) ou abandonner (texte irrécupérable). Une note inférieure à 3 sur q1 ou q3 refuse l'article.",
  "Règles de marque à faire respecter :\n- " + REGLES_MARQUE_PROMPT,
  CONSIGNE_DONNEES,
  'Réponds uniquement par un objet JSON : {"verdict":"...","notes":{"q1":n,...,"q6":n},"corrections":[...]}.',
].join("\n\n");

function userExpert(e: EntreeExpert, mesures: ReadonlyArray<Correction>): string {
  const faq = e.faq.map((f) => `Q : ${f.question}\nR : ${f.answer}`).join("\n\n");
  const m = mesures.length
    ? mesures.map((c) => `- section ${c.section} : ${c.probleme} (${c.attendu})`).join("\n")
    : "(aucune anomalie mesurée)";
  return [
    `Lecteur : ${e.lecteur.profil === "tpe" ? "dirigeant de TPE" : "dirigeant de PME"}, ${e.lecteur.metier}. Secteur : ${e.secteur}.`,
    `Titre : ${e.titre}`,
    encadrerDonnees("reponse-directe", e.directAnswer),
    encadrerDonnees("article", e.bodyHtml),
    encadrerDonnees("faq", faq || "(aucune)"),
    `Mesures du code (pour q5 et q6) :\n${m}`,
  ].join("\n\n");
}

export async function critiquerArticle(
  e: EntreeExpert,
  appel: AppelModele,
  compteur: CompteurCout,
): Promise<ResultatExpert> {
  const mesures = mesurerEquilibre(e.bodyHtml, e.types, e.gabarit);
  const reponse = await appelerRole(appel, compteur, "expert", {
    system: SYSTEM,
    user: userExpert(e, mesures),
    maxTokens: 3000,
  });
  const lu = lireJson(reponse.texte, sortieSchema);
  if (!lu.ok) return { verdict: "illisible", raison: `Critique illisible (${lu.raison})` };

  const { notes } = lu.valeur;
  const nbSections = (e.bodyHtml.match(/<h2[\s>]/gi) ?? []).length;
  const corrections: Correction[] = lu.valeur.corrections.map((c) =>
    typeof c.section === "number" && c.section >= nbSections
      ? { ...c, section: "global" as const }
      : c,
  );

  // Contrôle déterministe : ne jamais suggérer au lecteur de faire seul ce qu'Axion-IA met en place.
  const texte = `${e.directAnswer} ${sansBalises(e.bodyHtml)}`;
  let faibles = (Object.keys(notes) as Array<keyof NotesExpert>).filter(
    (q) => notes[q] < NOTE_MIN_REFUS,
  );
  const refusDur = (["q1", "q3"] as const).filter((q) => notes[q] < NOTE_MIN_REFUS);
  let forceCode: CodeRefusExpert | null = null;
  if (FAIRE_SEUL.test(texte)) {
    corrections.push({
      section: "global",
      probleme: "conseil_faire_seul",
      attendu:
        "Ne jamais suggérer de faire seul : Axion-IA s'occupe de la mise en place (Diagnostic IA gratuit de 45 minutes)",
    });
    forceCode = "non_actionnable";
  }

  let verdict = lu.valeur.verdict;
  if (verdict === "ok" && (refusDur.length > 0 || corrections.length > 0 || forceCode))
    verdict = "reecrire";
  if (verdict === "ok") {
    return { verdict: "ok", notes, corrections: [], codeRefus: null };
  }

  if (corrections.length === 0) {
    const q = refusDur[0] ?? faibles[0] ?? "q1";
    corrections.push({
      section: "global",
      probleme: `note insuffisante à la question ${q.slice(1)}`,
      attendu:
        "Rendre le texte utile à un dirigeant : apport nouveau, décision claire, chiffres sourcés",
    });
  }
  faibles = faibles.length ? faibles : refusDur;
  const plusFaible = faibles.sort((a, b) => notes[a] - notes[b])[0] ?? "q1";
  const codeRefus = forceCode ?? CODE_PAR_QUESTION[plusFaible];
  return { verdict, notes, corrections: corrections.slice(0, MAX_CORRECTIONS), codeRefus };
}
