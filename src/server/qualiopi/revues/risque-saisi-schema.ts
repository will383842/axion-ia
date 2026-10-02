/**
 * Indicateur 32 — ce que le SERVEUR accepte d'écrire dans l'analyse des
 * risques d'une revue de direction.
 *
 * 🔴 2026-10-02 (relecture de la PR #1268) — l'action acceptait
 * `z.array(z.unknown())`, et l'horodatage recopiait l'objet reçu : une gravité
 * à 99, une probabilité à -5 ou une clé arbitraire (`valideParAuditeur: true`)
 * étaient enregistrées telles quelles, dans une pièce remise à l'auditeur.
 *
 * Le schéma est STRICT : champs connus seulement (une clé inconnue fait
 * refuser la saisie, elle n'est jamais persistée), cotes entières de 1 à 4 ou
 * nulles, longueurs bornées. `misAJourLe` est toléré en entrée parce que
 * l'écran peut renvoyer ce qu'il a lu, mais il est toujours IGNORÉ : la date
 * vient du serveur (`horodaterRisques`).
 *
 * Module séparé d'`analyse-risques.ts`, que lit aussi l'écran (client) : zod ne
 * part pas dans le bundle de la console pour une validation qui n'a de valeur
 * que côté serveur.
 */

import { z } from "zod";

const cote = z.number().int().min(1).max(4).nullable().optional();

export const risqueSaisiSchema = z
  .object({
    intitule: z.string().trim().min(1).max(300),
    cause: z.string().trim().max(1000).optional(),
    gravite: cote,
    probabilite: cote,
    maitrise: z.string().trim().max(1000).optional(),
    responsable: z.string().trim().max(200).optional(),
    echeance: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    misAJourLe: z.string().max(40).nullable().optional(),
  })
  .strict();

export const risquesSaisisSchema = z.array(risqueSaisiSchema).max(200);
