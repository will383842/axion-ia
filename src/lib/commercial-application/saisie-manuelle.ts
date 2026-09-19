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
export const ORIGINES_SAISIE: ReadonlyArray<{
  readonly id: string;
  readonly libelle: string;
  /** Plus proposée dans le formulaire ; l'id reste lisible sur les anciennes lignes. */
  readonly masquee?: true;
}> = [
  { id: "email-direct", libelle: "A écrit par e-mail" },
  { id: "telephone", libelle: "A appelé" },
  { id: "salon", libelle: "Rencontré sur un salon ou un événement" },
  { id: "reponse-annonce", libelle: "A répondu à notre annonce" },
  { id: "recommandation", libelle: "Recommandé par quelqu'un" },
  // 🔴 2026-09-19 — une adresse RELEVÉE sur l'annonce d'un tiers n'a pas été
  // donnée à Axion-IA : la personne n'a rien demandé, et lui écrire serait une
  // prospection sans base (art. 14 RGPD, L.34-5 CPCE). Toute nouvelle saisie
  // est refusée ; l'id reste pour les lignes déjà enregistrées. À ne pas
  // confondre avec `reponse-annonce` : la personne a répondu à NOTRE annonce.
  { id: "site-annonces", libelle: "Adresse relevée sur l'annonce d'un tiers", masquee: true },
  { id: "autre", libelle: "Autre" },
];

/** L'origine refusée à la saisie, et à l'invitation pour les lignes anciennes. */
export const ORIGINE_INTERDITE = "site-annonces";

/**
 * Origines où la PERSONNE a donné son adresse à Axion-IA elle-même : e-mail,
 * appel, salon, réponse à notre annonce. L'invitation lui dit simplement
 * comment elle nous l'a donnée.
 */
export const ORIGINES_DIRECTES: ReadonlyArray<string> = [
  "email-direct",
  "telephone",
  "salon",
  "reponse-annonce",
];

/**
 * Origines où l'adresse vient d'AILLEURS (une personne qui recommande, autre
 * chose). La personne n'a rien demandé : aucune invitation ne part sans que
 * l'administrateur atteste qu'elle a accepté d'être contactée (L.34-5 CPCE), et
 * le message lui donne l'information de l'art. 14 RGPD.
 */
export const ORIGINES_ACCORD_REQUIS: ReadonlyArray<string> = ["recommandation", "autre"];

/**
 * D'où vient l'adresse, dit À LA PERSONNE dans l'invitation — tutoiement,
 * comme le reste du tunnel. Fragments qui complètent « Tu nous as donné ton
 * adresse … » (directe) ou « Nous avons ton adresse … » (indirecte).
 */
export const PROVENANCE_ADRESSE: Readonly<
  Record<string, { readonly fr: string; readonly en: string }>
> = {
  "email-direct": { fr: "par e-mail", en: "by email" },
  telephone: { fr: "par téléphone", en: "by phone" },
  salon: { fr: "lors d'un salon ou d'un événement", en: "at a trade show or an event" },
  "reponse-annonce": { fr: "en répondant à notre annonce", en: "by answering our ad" },
  recommandation: {
    fr: "par une personne qui te recommande",
    en: "from someone who recommends you",
  },
  autre: { fr: "hors de ce site", en: "outside this website" },
};

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
    /**
     * Envoyer, en même temps, l'invitation à l'échange de 15 minutes (lien
     * Calendly + document de présentation + catalogue). DÉCOCHÉE par défaut :
     * l'envoi est un geste explicite de l'administrateur, jamais un effet de
     * bord de l'enregistrement (décision Will 2026-09-19).
     */
    envoyerInvitation: z.boolean().optional(),
    /** Le lien Calendly de l'invitation — exigé seulement si elle part. */
    calendlyUrl: z.string().trim().max(500).optional(),
    /**
     * « La personne a accepté d'être contactée » — attestée par
     * l'administrateur, pour une origine de `ORIGINES_ACCORD_REQUIS`. Exigée si
     * l'invitation part ; datée sur la fiche (`details.accordContactAt`).
     */
    accordContact: z.boolean().optional(),
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

/** Ce qu'il est advenu de l'invitation demandée à la saisie, si elle l'a été. */
export type IssueInvitation =
  { envoyee: true; enValidation?: true } | { envoyee: false; message: string };

export type SaisieState =
  | { ok: true; submissionId: string; invitation?: IssueInvitation }
  | { ok: false; erreur: "doublon"; traces: TraceExistante[] }
  | { ok: false; erreur: "champs-invalides" | "non-autorise" | "echec"; message: string };
