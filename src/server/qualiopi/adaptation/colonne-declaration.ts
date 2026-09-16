/**
 * La colonne `enrollments.besoin_adaptation_declare_at` est-elle DÉJÀ posée ?
 *
 * ## Pourquoi cette question se pose
 *
 * 🔴 `AGENTS.md` — deux conteneurs, deux vitesses : le **worker** atterrit ~50 min
 * AVANT l'app, et c'est l'entrypoint de l'**app** qui joue `prisma migrate deploy`.
 * Pendant cette fenêtre, le worker exécute du code qui connaît la colonne sur une
 * base qui ne l'a pas encore. Une règle d'alerte qui la demanderait rendrait une
 * erreur SQL ; le fail-soft de l'évaluateur l'avalerait, et **la résolution
 * automatique de TOUTES les alertes serait suspendue ce tour-là** (le dit
 * `regle-adaptation-reponse.ts` lui-même).
 *
 * 🔑 Le conseil du dépôt est « ajouter avant de lire ». Ici l'ajout et la lecture
 * voyagent ensemble, donc la lecture se rend CONDITIONNELLE : tant que la colonne
 * n'existe pas, la troisième branche du besoin déclaré est simplement absente du
 * filtre, et les deux premières (fiche stagiaire, « oui » au positionnement)
 * continuent de travailler. Le seul effet est qu'une déclaration d'aménagement
 * faite dans l'heure n'est pas encore comptée — elle le sera au balayage suivant,
 * sans geste de personne.
 *
 * ⚠️ Le OUI seul est mis en cache. Mettre le NON en cache figerait un processus
 * pour toute sa vie sur un état d'avant-migration — exactement le défaut que ce
 * module existe pour éviter.
 *
 * ⚠️ Module atteint par le WORKER : aucun import `server-only`, Next ni Server
 * Action.
 */

import { prisma } from "@/lib/prisma";

/** Nom SQL de la colonne — écrit UNE fois, ici et dans `schema.prisma`. */
export const COLONNE_BESOIN_DECLARE = "besoin_adaptation_declare_at";

let vuePresente = false;

/**
 * `true` dès que la colonne existe. `false` tant qu'elle n'est pas migrée, en
 * base stub (build), ou si la question elle-même échoue — un doute vaut « pas
 * encore », jamais une requête qui casse.
 */
export async function colonneDeclarationDisponible(): Promise<boolean> {
  if (vuePresente) return true;
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return false;
  try {
    const lignes = await prisma.$queryRaw<{ existe: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'enrollments'
          AND column_name = 'besoin_adaptation_declare_at'
      ) AS existe`;
    vuePresente = lignes[0]?.existe === true;
  } catch (err) {
    console.error(
      "[colonne-declaration] présence de la colonne non vérifiable :",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
  return vuePresente;
}

/** Remet le cache à zéro. Réservé aux tests : la production n'a aucune raison d'oublier. */
export function oublierPresenceColonne(): void {
  vuePresente = false;
}
