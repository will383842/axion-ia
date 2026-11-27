// Questionnaire du Baromètre 2027 — schéma serveur (zod, `.strict()`) : toute clé inconnue
// (e-mail, ip…) est refusée. Les filtres du formulaire sont REJOUÉS ici : le navigateur n'est pas cru.

import { z } from "zod";
import {
  Q1,
  Q2,
  Q3,
  Q4,
  Q4_NON,
  Q5,
  Q6,
  Q7,
  Q8,
  Q9,
  Q10,
  Q10_MAX,
  Q11,
  Q12,
  Q12_AVEC_SALARIES,
  Q13,
  Q14,
  type OptionQ,
} from "@/content/barometre-questionnaire/textes";
import { CONSENT_VERSION } from "./constantes";

const valeurs = (o: ReadonlyArray<OptionQ>): [string, ...string[]] => {
  const v = o.map((x) => x.value);
  return v as [string, ...string[]];
};
const exclusives = (o: ReadonlyArray<OptionQ>): ReadonlyArray<string> =>
  o.filter((x) => x.exclusive).map((x) => x.value);

export const REGIONS_QUESTIONNAIRE: ReadonlyArray<string> = Q3.map((o) => o.value);

const unique = (a: ReadonlyArray<string>) => new Set(a).size === a.length;

/** Choix multiple : 1 à `max` valeurs, sans doublon ; une réponse exclusive est seule. */
function multiple(o: ReadonlyArray<OptionQ>, max: number = o.length) {
  const excl = exclusives(o);
  return z
    .array(z.enum(valeurs(o)))
    .min(1)
    .max(max)
    .refine(unique, "doublon")
    .refine((a) => a.length === 1 || !a.some((x) => excl.includes(x)), "réponse exclusive");
}

const texteLibre = z
  .string()
  .trim()
  .max(1000)
  // Un octet nul fait échouer l'INSERT Postgres (varchar) : refusé ici, avant la base.
  .refine((s) => !s.includes("\u0000"), "caractère interdit")
  .optional()
  .transform((s) => (s && s.length > 0 ? s : undefined));

export const reponsesSchema = z
  .object({
    q1: z.enum(valeurs(Q1)),
    q2: z.enum(valeurs(Q2)),
    q3: z.enum(valeurs(Q3)),
    q4: z.enum(valeurs(Q4)),
    q5: multiple(Q5).optional(),
    q6: z.enum(valeurs(Q6)).optional(),
    q7: multiple(Q7).optional(),
    q8: z.enum(valeurs(Q8)).optional(),
    q9: multiple(Q9).optional(),
    q10: multiple(Q10, Q10_MAX),
    q11: z.enum(valeurs(Q11)),
    q12: z.enum(valeurs(Q12)),
    q13: z.enum(valeurs(Q13)),
    q14: multiple(Q14).optional(),
    q15: texteLibre,
    q16: texteLibre,
    // Champs techniques (jamais écrits dans `reponses`).
    consentement: z.literal(true),
    consentVersion: z.literal(CONSENT_VERSION),
    /** SHA-256 (hex) du code de retrait, calculé dans le navigateur. */
    codeRetraitHash: z.string().regex(/^[0-9a-f]{64}$/),
    turnstileToken: z.string().min(1).max(4096),
    /** Pot de miel : jamais rempli par une personne. */
    website: z.string().optional(),
    /** Instant d'ouverture du formulaire (ms) : obligatoire, sinon le délai minimal serait contournable. */
    startedAt: z.number().finite(),
  })
  .strict()
  .superRefine((d, ctx) => {
    const ajouter = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    // q4 « non » : q5 à q9 sont ABSENTS ; sinon ils sont obligatoires.
    const nonUtilisateur = Q4_NON.includes(d.q4);
    for (const k of ["q5", "q6", "q7", "q8", "q9"] as const) {
      if (nonUtilisateur && d[k] !== undefined) ajouter(k, "question non posée");
      if (!nonUtilisateur && d[k] === undefined) ajouter(k, "réponse obligatoire");
    }

    // q1 = 0 : pas de salarié, donc pas de formation « des salariés ».
    if (d.q1 === "0" && Q12_AVEC_SALARIES.includes(d.q12)) {
      ajouter("q12", "incohérent avec 0 salarié");
    }

    // q14 présent si et seulement si q13 = oui.
    if (d.q13 === "oui" && d.q14 === undefined) ajouter("q14", "réponse obligatoire");
    if (d.q13 !== "oui" && d.q14 !== undefined) ajouter("q14", "question non posée");
  });

export type ReponsesQuestionnaire = z.infer<typeof reponsesSchema>;
