// Saisie manuelle d'un contact apporteur — VOCABULAIRE ET SCHÉMA.
//
// 🔴 CE FICHIER N'EST PAS `"use server"`, ET C'EST TOUTE SA RAISON D'ÊTRE.
//
// Un module `"use server"` ne peut exporter QUE des fonctions asynchrones :
// Next remplace chacun de ses exports par une référence appelable à distance.
// Une constante exportée d'un tel module arrive donc côté navigateur sous la
// forme d'une fonction — et `ORIGINES_SAISIE.map(...)` lève
// « map is not a function », au RENDU, dans le navigateur.
//
// Ni `tsc` ni les tests unitaires ne voient ce défaut : le premier ne connaît
// pas la frontière client/serveur, les seconds importent le module directement,
// sans elle. Seule une recette PAR L'INTERFACE l'a montré — l'écran affichait
// « Une erreur est survenue dans la console ».
//
// Le vocabulaire et le schéma vivent donc ici ; les actions restent dans
// `saisie-manuelle-actions.ts`.

import { z } from "zod";

/**
 * D'où vient ce contact. Liste FERMÉE : un champ libre produirait « salon »,
 * « Salon », « salon pro » et « rencontré au salon » pour la même chose, et
 * aucun regroupement ne serait possible ensuite.
 */
export const ORIGINES_SAISIE = [
  { id: "email-direct", libelle: "A écrit par e-mail" },
  { id: "telephone", libelle: "A appelé" },
  { id: "salon", libelle: "Rencontré sur un salon ou un événement" },
  { id: "recommandation", libelle: "Recommandé par quelqu'un" },
  { id: "site-annonces", libelle: "Repéré sur un site d'annonces" },
  { id: "autre", libelle: "Autre" },
] as const;

export const saisieManuelleSchema = z
  .object({
    prenom: z.string().trim().min(1).max(60),
    nom: z.string().trim().max(60).optional(),
    email: z.string().trim().email().max(180),
    telephone: z.string().trim().max(40).optional(),
    ville: z.string().trim().max(120).optional(),
    origine: z.enum(ORIGINES_SAISIE.map((o) => o.id) as [string, ...string[]]),
    note: z.string().trim().max(2000).optional(),
    /**
     * Confirmation explicite quand un doublon a été montré. Sans elle, une
     * seconde ligne pour la même personne est REFUSÉE — le doublon se traite
     * avant l'écriture, jamais après.
     */
    confirmeMalgreDoublon: z.boolean().optional(),
  })
  .strict();

export type SaisieManuelleInput = z.infer<typeof saisieManuelleSchema>;

export interface TraceExistante {
  id: string;
  type: string;
  etape: string | null;
  nom: string | null;
  recuLe: string;
}

export type SaisieState =
  | { ok: true; submissionId: string }
  | { ok: false; erreur: "doublon"; traces: TraceExistante[] }
  | { ok: false; erreur: "champs-invalides" | "non-autorise" | "echec"; message: string };
