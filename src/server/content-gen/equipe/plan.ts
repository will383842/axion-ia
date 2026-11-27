/**
 * Architecte du plan (équipe éditoriale, PR 5), derrière `CONTENT_EQUIPE_EDITORIALE`.
 *
 * Module PUR : contrat de plan + vérification. Le plan est converti en squelette HTML puis passé
 * à `validateOutline` en mode BLOQUANT (seulement ici). Interrupteur éteint : mêmes avertissements
 * qu'avant, jamais de blocage, aucun contrôle neuf.
 *
 * Contrat : H1 = la question ; réponse directe de 40 à 60 mots sous le H1 avec le mot-clé ;
 * 5 à 8 H2 répondant chacun à une question du brief (`questionCouverte`, `preuve` facultative) ;
 * H3 seulement si un H2 en a au moins deux ; jamais de saut de niveau ; 100 % des questions du
 * brief couvertes par un H2 ou la FAQ, sans répétition entre les deux.
 */

import { z } from "zod";
import {
  equipeEditorialeActive,
  type EnvEquipeEditoriale,
} from "../fact-check/equipe-editoriale-drapeau";
import { normaliserTitre, validateOutline, type OutlineIssue } from "../quality/outline-validator";
import type { Brief } from "./brief";

const texte = (max: number) => z.string().trim().min(1).max(max);

export const planSchema = z
  .object({
    h1: texte(300),
    reponseDirecte: texte(1000),
    sections: z
      .array(
        z.object({
          h2: texte(300),
          questionCouverte: texte(300),
          /** Texte ou identifiant de preuve : facultatif. */
          preuve: texte(500).optional(),
          /** Titres H3 à H6 suivant ce H2, dans l'ordre. */
          titresSuivants: z
            .array(z.object({ niveau: z.number().int().min(3).max(6), texte: texte(300) }))
            .optional(),
        }),
      )
      .max(20),
    faq: z.array(z.object({ q: texte(300) })).max(20),
  })
  .strict();

export type Plan = z.infer<typeof planSchema>;

export const MOTS_REPONSE_MIN = 40;
export const MOTS_REPONSE_MAX = 60;

export interface ResultatPlan {
  readonly bloque: boolean;
  readonly issues: ReadonlyArray<OutlineIssue>;
}

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Squelette HTML du plan (titres seulement) pour le validateur de structure. */
export function planVersHtml(plan: Plan): string {
  const parties = [`<h1>${echapper(plan.h1)}</h1>`, `<p>${echapper(plan.reponseDirecte)}</p>`];
  for (const s of plan.sections) {
    parties.push(`<h2>${echapper(s.h2)}</h2>`);
    for (const t of s.titresSuivants ?? [])
      parties.push(`<h${t.niveau}>${echapper(t.texte)}</h${t.niveau}>`);
  }
  return parties.join("");
}

const compterMots = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function verifierPlan(
  plan: Plan,
  brief: Brief,
  env: EnvEquipeEditoriale = process.env,
): ResultatPlan {
  const bloquant = equipeEditorialeActive(env);
  const questions = brief.questions.map((q) => q.question);
  const res = validateOutline(planVersHtml(plan), {
    bloquant,
    ...(bloquant
      ? {
          couverture: {
            questions,
            h2: plan.sections.map((s) => s.questionCouverte),
            faq: plan.faq.map((f) => f.q),
          },
        }
      : {}),
  });
  const issues: OutlineIssue[] = [...res.issues];
  if (bloquant) {
    const n = compterMots(plan.reponseDirecte);
    if (n < MOTS_REPONSE_MIN || n > MOTS_REPONSE_MAX) {
      issues.push({
        code: "answer_length",
        message: `réponse directe de ${n} mots (attendu ${MOTS_REPONSE_MIN} à ${MOTS_REPONSE_MAX})`,
      });
    }
    if (
      !` ${normaliserTitre(plan.reponseDirecte)} `.includes(` ${normaliserTitre(brief.motCle)} `)
    ) {
      issues.push({
        code: "keyword_missing",
        message: "mot-clé principal absent de la réponse directe",
      });
    }
  }
  return { bloque: bloquant && issues.length > 0, issues };
}
