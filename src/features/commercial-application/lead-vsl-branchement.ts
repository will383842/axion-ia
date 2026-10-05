"use server";
// use-server: actions serveur PROVISOIRES de la page VSL apporteurs — remplacées par `lead-vsl-actions.ts` (PR capture).

/**
 * ⚠️ BRANCHEMENT PROVISOIRE — « à brancher après la PR capture ».
 *
 * La page `/apporteur-affaires/video` reçoit ses deux actions par props (voir
 * `lead-vsl-contrat.ts`). La vraie capture (`lead-vsl-actions.ts`, branche
 * `feat/vsl-apporteurs-capture` du développeur « back ») n'était pas encore sur
 * `origin/main` quand cette page a été écrite. Ces deux fonctions ne
 * ENREGISTRENT RIEN : elles répondent `unknown`, donc le formulaire affiche
 * « Une erreur est survenue… » et personne n'est perdu en silence.
 *
 * 🔴 Tant que ce fichier est branché, la page ne doit recevoir AUCUN trafic payant
 * (elle est `noindex`, hors sitemap, liée de nulle part).
 *
 * POUR BRANCHER (dernier point de la PR, ≈ 2 lignes) : dans
 * `src/app/[locale]/apporteur-affaires/video/page.tsx`, remplacer
 *     import { capturerLeadVslProvisoire as capturerLeadVsl, ... } from "…/lead-vsl-branchement"
 * par
 *     import { capturerLeadVsl, completerLeadVsl } from "…/lead-vsl-actions"
 * puis supprimer ce fichier. Les signatures sont celles du contrat.
 */

import type {
  CapturerLeadVslInput,
  CapturerLeadVslResultat,
  CompleterLeadVslInput,
  CompleterLeadVslResultat,
} from "./lead-vsl-contrat";

export async function capturerLeadVslProvisoire(
  _input: CapturerLeadVslInput,
): Promise<CapturerLeadVslResultat> {
  return { ok: false, error: "unknown" };
}

export async function completerLeadVslProvisoire(
  _input: CompleterLeadVslInput,
): Promise<CompleterLeadVslResultat> {
  return { ok: false, error: "unknown" };
}
