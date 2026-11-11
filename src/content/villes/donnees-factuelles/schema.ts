// Données factuelles par ville — schéma du fichier versionné (tâche X-4, vague 3).
//
// Doctrine (docs/knowledge/DONNEES-PAR-VILLE.md) : un fait affiché porte TOUJOURS sa source
// et sa date. Un champ sans source fiable reste ABSENT — jamais estimé. Le schéma refuse donc
// tout fait sans `source`, sans `url` ou sans `date`, et refuse le fichier entier s'il en
// contient un seul.
//
// Ce fichier est produit par `scripts/villes/donnees-factuelles.ts` (hors ligne, jamais au
// build ni au rendu) et relu en PR. Aucune donnée n'est inventée ni écrite en base.
import { z } from "zod";

/** Date ISO courte : `AAAA-MM` (millésime mensuel, ex. Stock Sirene) ou `AAAA-MM-JJ`. */
const DATE_ISO = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;

/**
 * Ce que la date désigne :
 * - `millesime` : la date de la donnée elle-même (ex. fichier Sirene d'octobre 2026) ;
 * - `releve` : la date à laquelle la valeur a été relevée, quand la source ne publie pas de
 *   millésime exploitable (affiché « relevé le … », jamais comme un millésime).
 */
export const natureDateSchema = z.enum(["millesime", "releve"]);

function faitSchema<T extends z.ZodTypeAny>(valeur: T) {
  return z
    .object({
      valeur,
      source: z.string().trim().min(3),
      url: z.string().url().startsWith("https://"),
      date: z.string().regex(DATE_ISO),
      natureDate: natureDateSchema,
    })
    .strict();
}

export const secteurNafSchema = z
  .object({
    /** Division NAF rév. 2 (2 chiffres). */
    division: z.string().regex(/^\d{2}$/),
    /** Libellé officiel de la division, seulement s'il a été lu dans la nomenclature INSEE. */
    libelle: z.string().trim().min(2).optional(),
    etablissements: z.number().int().positive(),
  })
  .strict();

export const villeDonneesFactuellesSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    inseeCode: z.string().regex(/^(\d{5}|2[AB]\d{3})$/),
    population: faitSchema(z.number().int().positive()).optional(),
    departement: faitSchema(z.string().trim().min(1)).optional(),
    region: faitSchema(z.string().trim().min(2)).optional(),
    /** Établissements administrativement actifs (Stock Sirene), arrondissements inclus. */
    etablissementsActifs: faitSchema(z.number().int().positive()).optional(),
    /** Divisions NAF les plus représentées (Stock Sirene), triées par effectif décroissant. */
    secteursDominants: faitSchema(z.array(secteurNafSchema).min(1).max(5)).optional(),
  })
  .strict();

export const fichierDonneesFactuellesSchema = z
  .object({
    /**
     * `ECHANTILLON` : jeu partiel livré sans la source complète (routine sans réseau).
     * `COMPLET` : produit par le script à partir des fichiers publics téléchargés.
     */
    statut: z.enum(["ECHANTILLON", "COMPLET"]),
    genereLe: z.string().regex(DATE_ISO),
    generePar: z.literal("scripts/villes/donnees-factuelles.ts"),
    note: z.string().optional(),
    villes: z.array(villeDonneesFactuellesSchema),
  })
  .strict()
  .superRefine((f, ctx) => {
    const vus = new Set<string>();
    for (const v of f.villes) {
      if (vus.has(v.slug)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `slug en double : ${v.slug}` });
      }
      vus.add(v.slug);
    }
  });

export type NatureDate = z.infer<typeof natureDateSchema>;
export type SecteurNaf = z.infer<typeof secteurNafSchema>;
export type VilleDonneesFactuelles = z.infer<typeof villeDonneesFactuellesSchema>;
export type FichierDonneesFactuelles = z.infer<typeof fichierDonneesFactuellesSchema>;
export interface Fait<T> {
  valeur: T;
  source: string;
  url: string;
  date: string;
  natureDate: NatureDate;
}
