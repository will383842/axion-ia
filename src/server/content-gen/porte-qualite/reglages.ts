/** Réglages de la porte : un seul schéma Zod (§ 12.1), importé par le back-end et l'écran. */

import { z } from "zod";

/** Change quand un seuil ou une règle change : l'ancienne version reste lisible (§ 3, règle 4). */
export const VERSION_PORTE = "2026-11-28.q5q6";

export const ReglagesPorteSchema = z
  .object({
    /** Note minimale pour publier (§ 4.3). Point de départ à calibrer. */
    seuilPublication: z.number().int().min(0).max(100),
    /** Sous cette note : `bloque`. */
    seuilBloque: z.number().int().min(0).max(100),
    /** Articles longs : mots minimum (B11). */
    motsMinArticleLong: z.number().int().positive(),
    /** Autres pages : plancher « page mince » (B11). */
    motsMinPageMince: z.number().int().positive(),
    /** Réponse directe (B08) : bornes en mots. */
    motsMinReponseDirecte: z.number().int().positive(),
    motsMaxReponseDirecte: z.number().int().positive(),
    /** B11c : la réponse sous le H1 doit finir dans les N premiers mots, et avoir au moins M mots. */
    fenetreReponseMots: z.number().int().positive(),
    motsMinReponseSousH1: z.number().int().positive(),
    /** B11 : bornes du nombre de H2, sources externes, point clé. */
    h2Min: z.number().int().nonnegative(),
    h2Max: z.number().int().positive(),
    citationsMin: z.number().int().nonnegative(),
    motsMinPointCle: z.number().int().nonnegative(),
    /** B13 : liens internes sortants sains. */
    liensInternesMin: z.number().int().nonnegative(),
    /** B06 : cosinus maximal à partir duquel le brouillon double un contenu existant (hypothèse, § 7.2). */
    cosinusBloque: z.number().min(0).max(1),
    /** B06 : à partir de là, alerte « fusion à étudier » sans refus. */
    cosinusAlerte: z.number().min(0).max(1),
    /** B07 : nombre minimal d'apports originaux distincts et vérifiés (§ 8). */
    apportsMin: z.number().int().min(2).max(4),
    /** Note (§ 4.3) : cosinus sous lequel la pénalité de proximité est nulle. */
    cosinusProximiteMin: z.number().min(0).max(1),
  })
  .strict()
  .refine((r) => r.seuilBloque <= r.seuilPublication, {
    message: "seuilBloque doit être inférieur ou égal à seuilPublication",
    path: ["seuilBloque"],
  })
  .refine((r) => r.motsMinReponseDirecte <= r.motsMaxReponseDirecte, {
    message: "motsMinReponseDirecte doit être inférieur ou égal à motsMaxReponseDirecte",
    path: ["motsMinReponseDirecte"],
  })
  .refine((r) => r.cosinusProximiteMin <= r.cosinusAlerte && r.cosinusAlerte <= r.cosinusBloque, {
    message: "cosinusProximiteMin <= cosinusAlerte <= cosinusBloque attendu",
    path: ["cosinusAlerte"],
  })
  .refine((r) => r.h2Min <= r.h2Max, {
    message: "h2Min doit être inférieur ou égal à h2Max",
    path: ["h2Min"],
  });

export type ReglagesPorte = z.infer<typeof ReglagesPorteSchema>;

export const REGLAGES_PAR_DEFAUT: ReglagesPorte = Object.freeze({
  seuilPublication: 85,
  seuilBloque: 70,
  motsMinArticleLong: 850,
  motsMinPageMince: 350,
  motsMinReponseDirecte: 40,
  motsMaxReponseDirecte: 60,
  fenetreReponseMots: 150,
  motsMinReponseSousH1: 20,
  h2Min: 3,
  h2Max: 8,
  citationsMin: 2,
  motsMinPointCle: 5,
  liensInternesMin: 3,
  apportsMin: 2,
  cosinusBloque: 0.85,
  cosinusAlerte: 0.8,
  cosinusProximiteMin: 0.7,
});
