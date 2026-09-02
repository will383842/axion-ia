/**
 * **LE PONT D'IDENTITÉ** (§ 19 bis) — au nom de quel rôle l'adaptateur agit-il ?
 *
 * ═══ DÉCISION W-6 : NON PRISE. LE DÉFAUT S'APPLIQUE. ═══
 *
 * Le cahier des charges pose la question à Will et fixe le défaut si elle
 * reste sans réponse : **le rôle le plus faible**, donc `peutVoirAppels: false`
 * et coordonnées masquées. Si la réponse est un jour `super_admin`, le § 18 du
 * cahier doit être repris — « toute injection réussie s'exécute au plus haut
 * rôle de la console » change la parade.
 *
 * ⚠️ RIEN ICI NE LIT LA CHARGE UTILE. Une habilitation qui viendrait de
 *    `params` serait une décision de droit prise par l'appelant : c'est le
 *    défaut que le contrôle 7 du harnais interdit au niveau du schéma, et que
 *    ce fichier interdit au niveau du code en n'acceptant aucun argument qui
 *    puisse la porter.
 *
 * 🔑 DÉRIVÉ, PAS RECOPIÉ. `peutVoirAppels` est calculé par la fonction que la
 *    console utilise elle-même (`peutVoirLesAppels`), sur le rôle déclaré ici.
 *    Si la liste `ROLES_APPELS` change un jour au point d'y admettre `reader`,
 *    cette valeur suit — et le test qui affirme `false` rougit, ce qui est le
 *    moment de reposer la question W-6.
 */

import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import type { RoleAdmin } from "@/server/auth/habilitations";

import type { ContexteOutil, Habilitations } from "./contrat";

/** Le rôle le plus faible de la console. Défaut W-6. */
export const ROLE_DE_L_ADAPTATEUR: RoleAdmin = "reader";

/** Le délai au-delà duquel un appel est considéré perdu par le socle (§ 26). */
export const DELAI_D_APPEL_MS = 8_000;

export function habilitationsDeLAdaptateur(): Habilitations {
  return { peutVoirAppels: peutVoirLesAppels(ROLE_DE_L_ADAPTATEUR) };
}

/** Ce que l'enveloppe JSON-RPC peut porter en `_meta` — des identifiants OPAQUES. */
export interface MetaDAppel {
  readonly requestId?: string | null;
  readonly principal?: string | null;
}

/**
 * Le contexte d'un appel. Les identifiants viennent de `_meta` s'ils y sont —
 * pour le JOURNAL, jamais pour une décision. Les habilitations viennent d'ici.
 */
export function contexteDAppel(metaDAppel: MetaDAppel, maintenant = new Date()): ContexteOutil {
  return {
    principal: metaDAppel.principal?.trim() || "socle",
    requestId: metaDAppel.requestId?.trim() || `local-${maintenant.getTime().toString(36)}`,
    deadline: new Date(maintenant.getTime() + DELAI_D_APPEL_MS),
    habilitations: habilitationsDeLAdaptateur(),
  };
}
