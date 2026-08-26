/**
 * Le barème de rôles du module Réservation — et le refus par défaut qui manquait.
 *
 * ## Le défaut que ce fichier ferme
 *
 * Deux gardes du module comparaient les rôles par un rang :
 *
 * ```ts
 * const ROLE_RANK = { reader: 0, editor: 1, admin: 2, super_admin: 3 };
 * if (ROLE_RANK[role] < ROLE_RANK[minRole]) throw forbidden;
 * ```
 *
 * L'enum Prisma `AdminRole` en déclare **six**. Les deux absents du barème sont
 * `responsable_qualite` et `secretaire` — arrivés après lui, sans que rien ne le
 * signale.
 *
 * 🔴 Pour eux, `ROLE_RANK[role]` vaut `undefined`, et **`undefined < 2` est
 * `false`** en JavaScript. La garde ne levait donc rien : **elle laissait
 * passer**. Mesuré le 2026-08-26 :
 *
 * ```
 * reader               rang=0          BLOQUÉ
 * editor               rang=1          BLOQUÉ
 * admin                rang=2          → passe
 * secretaire           rang=undefined  → PASSE
 * responsable_qualite  rang=undefined  → PASSE
 * ```
 *
 * Étaient concernées sept actions de `admin-actions.ts` et trois de
 * `quote-actions.ts` — dont `markNoShowAction` et `markForceMajeureAction`,
 * explicitement réservées `super_admin` **parce qu'elles décident du
 * remboursement**.
 *
 * ## 🔑 Pourquoi un type n'a pas protégé
 *
 * Le rôle vient de la session et il est **casté** (`as AdminContext["role"]`) :
 * le compilateur ne voit qu'une promesse, jamais la valeur. Un type trop étroit
 * ne rétrécit pas le réel — il rend seulement le trou invisible. Et une
 * comparaison numérique avec `undefined` ne lève pas : elle rend `false`, ce qui
 * se lit ici « autorisé ».
 *
 * ## Ce que ce module garantit
 *
 * 1. **Refus par défaut.** Un rôle absent du barème est refusé, jamais toléré.
 *    C'est la même doctrine que `cadrage-actions.ts`, `refund-actions.ts` et
 *    `reschedule-actions.ts`, qui utilisaient déjà une liste blanche explicite et
 *    n'ont jamais été vulnérables.
 * 2. **Le barème ne peut plus se périmer en silence.** `rolesHorsBareme()` dérive
 *    la liste des manquants de l'enum Prisma lui-même ; le test associé échoue le
 *    jour où un septième rôle apparaît sans décision consciente.
 *
 * ⚠️ Le silence n'est pas une décision : `responsable_qualite` (« n'engage JAMAIS
 * sur le contractuel ni le financier ») et `secretaire` (« tout ce qui n'engage
 * pas ») sont **délibérément absents** du barème. Ces actions engagent l'organisme
 * — les leur ouvrir serait un choix à écrire, pas un défaut à laisser filer.
 */

import { AdminRole } from "../../../prisma/generated/client";

/** Rôles autorisés sur les actions engageantes du module, du plus faible au plus fort. */
export const RANG_DE_ROLE = {
  reader: 0,
  editor: 1,
  admin: 2,
  super_admin: 3,
} as const;

export type RoleClasse = keyof typeof RANG_DE_ROLE;

/**
 * Le rôle atteint-il le rang minimum exigé ?
 *
 * **Refuse tout rôle inconnu du barème**, y compris `undefined` — c'est le
 * comportement qui manquait.
 */
export function roleAtteintLeRang(role: string | undefined, minimum: RoleClasse): boolean {
  if (role == null) return false;
  const rang = (RANG_DE_ROLE as Record<string, number | undefined>)[role];
  if (rang === undefined) return false;
  return rang >= RANG_DE_ROLE[minimum];
}

/**
 * Les rôles que l'enum Prisma déclare et que le barème ignore.
 *
 * 🔑 **Dérivé de l'enum, jamais recopié** : une liste en dur aurait exactement le
 * défaut qu'on est en train de corriger. Le test qui lit cette fonction rougit
 * dès qu'un rôle apparaît sans qu'on ait tranché son sort.
 */
export function rolesHorsBareme(): string[] {
  return Object.values(AdminRole).filter((r) => !(r in RANG_DE_ROLE));
}
