/**
 * « Cette submission est-elle un dossier APPORTEUR ? » — le critère unique.
 *
 * Un dossier apporteur est une `Submission` de type `contact` qui porte, dans
 * son JSON `details`, les DEUX marqueurs posés par le tunnel : `unifiedType:
 * "recrutement"` (la clé de la vue console Contacts → Commercial) et `subType:
 * "candidature-commerciale"`. L'un sans l'autre ne suffit pas : le formulaire
 * `/contact` de type « recrutement » porte le premier sans le second, et ce
 * n'est PAS un dossier apporteur (ADR 0051, § l).
 *
 * Deux formes du même critère, à tenir ensemble :
 *   - `estApporteur(details)` pour trier EN MÉMOIRE une ligne déjà lue — c'est
 *     ce que fait le rapprochement CRM (`crm-sync/reconcile.ts`) ;
 *   - `FILTRE_APPORTEUR_PRISMA` pour SÉLECTIONNER les apporteurs en base.
 *
 * 🔴 Jamais de `NOT: FILTRE_APPORTEUR_PRISMA` pour EXCLURE les apporteurs d'une
 * requête. En SQL, un chemin JSON absent rend NULL, et `NOT (NULL = 'x')` vaut
 * encore NULL : la ligne disparaît. Toutes les submissions SANS `subType` — la
 * plupart des demandes clients — sortiraient du résultat, sans erreur. Pour
 * exclure, on lit puis on filtre avec `estApporteur`.
 *
 * ⚠️ Module PUR, volontairement : il n'importe que `model.ts`, qui n'importe que
 * zod. Il entre dans le graphe du worker par `reconcile.ts` — un import serveur
 * ici (`server-only`, Prisma, Redis) y ferait mourir les crons en silence.
 */

import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "./model";

/** Valeur de `details.unifiedType` que la console lit pour la vue Commercial. */
const UNIFIED_TYPE_RECRUTEMENT = "recrutement";

/**
 * Vrai si `details` (le JSON d'une Submission) décrit un dossier apporteur.
 *
 * Lecture DÉFENSIVE : le JSON vient de la base et peut être n'importe quoi —
 * `null`, un scalaire, un tableau hérité d'un ancien format. Rien de tout cela
 * n'est un apporteur, et rien ne doit lever : ce prédicat tourne dans un batch
 * quotidien qu'une exception ferait échouer en entier.
 */
export function estApporteur(details: unknown): boolean {
  if (!details || typeof details !== "object" || Array.isArray(details)) return false;
  const d = details as Record<string, unknown>;
  return (
    d.unifiedType === UNIFIED_TYPE_RECRUTEMENT && d.subType === CANDIDATURE_COMMERCIALE_SUBTYPE
  );
}

/**
 * Le même critère, en `where` Prisma sur `Submission` — pour SÉLECTIONNER les
 * dossiers apporteurs (jamais pour les exclure, cf. l'en-tête).
 *
 * Écrit sans annotation de type Prisma pour que ce module reste pur ; sa
 * compatibilité avec `Prisma.SubmissionWhereInput` est vérifiée par le typage
 * de `__tests__/est-apporteur.spec.ts`.
 */
export const FILTRE_APPORTEUR_PRISMA = {
  AND: [
    { details: { path: ["unifiedType"], equals: UNIFIED_TYPE_RECRUTEMENT } },
    { details: { path: ["subType"], equals: CANDIDATURE_COMMERCIALE_SUBTYPE } },
  ],
};
