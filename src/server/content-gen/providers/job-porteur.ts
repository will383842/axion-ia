/**
 * Job porteur : rattache un appel Claude qui n'est PAS un job de génération (pilotage SEO, mise à
 * jour d'un article publié) à la porte de coût.
 *
 * Pourquoi : `reserverCout` exige une ligne `content_gen_jobs` existante, d'un type autorisé
 * (`CONTENT_GEN_CLAUDE_TYPES`), faute de quoi il refuse (`config_invalide`). Plutôt qu'ajouter une
 * valeur à l'énumération `ContentType` (migration, risque pendant la fenêtre app/worker), on crée une
 * ligne d'un type EXISTANT au statut terminal `cancelled`, marquée `inputPayload.origine`.
 *
 * Pourquoi `cancelled` (et ni `failed`, ni `published`) :
 *  - `failed` serait repris par le balayage de relance de `recovery` ;
 *  - `queued`/`running`… seraient clos comme « bloqués » par ce même balayage ;
 *  - `published`/`approved` gonfleraient la production vue par le moniteur ;
 *  - `cancelled` est exclu des comptages de l'orchestrateur (`status: { not: "cancelled" }`) et du
 *    budget du jour de la reprise.
 * Les comptages SANS filtre de statut (moniteur « chaîne à l'arrêt ») excluent les porteurs par la
 * clé d'idempotence (`whereHorsPorteurs`).
 *
 * Le coût des appels reste compté dans le cumul commun (10 $/jour, 200 $/mois) : le cumul porte sur
 * toute l'énumération `ContentType`. Les sous-plafonds du pilotage sont appliqués par `reserverCout`
 * (atomique, sous verrou), d'après `inputPayload.origine`.
 *
 * Aucun appel réseau, aucun appel Claude ici.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { BlogClaudeRefusError, ORIGINE_PILOTAGE } from "./blog-claude-ledger";
import { typesClaudeAutorises } from "./types-claude";

/** Préfixe de la clé d'idempotence de tout job porteur (sert à les exclure d'un comptage). */
export const PREFIXE_CLE_PORTEUR = "porteur:";

/** Origines connues. Seule `pilotage` est soumise aux sous-plafonds du pilotage SEO. */
export type OrigineJobPorteur = typeof ORIGINE_PILOTAGE | "equipe_maj";

/** Types essayés dans l'ordre : le premier qui est autorisé est retenu. */
const TYPES_PREFERES = [
  "blog_from_keywords",
  "blog_from_title",
  "blog_article",
  "blog_from_rss",
] as const;

/** À ajouter au `where` d'un comptage de jobs sans filtre de statut pour ignorer les porteurs. */
export const whereHorsPorteurs = {
  NOT: { idempotencyKey: { startsWith: PREFIXE_CLE_PORTEUR } },
} as const;

/** Vrai si la ligne est un job porteur (clé de préfixe `porteur:` ou `inputPayload.porteur`). */
export function estJobPorteur(job: {
  readonly idempotencyKey?: string | null;
  readonly inputPayload?: unknown;
}): boolean {
  if (
    typeof job.idempotencyKey === "string" &&
    job.idempotencyKey.startsWith(PREFIXE_CLE_PORTEUR)
  ) {
    return true;
  }
  const p = job.inputPayload;
  return typeof p === "object" && p !== null && (p as Record<string, unknown>)["porteur"] === true;
}

/** Borne de garde du plafond d'un porteur (même ordre que la borne du jour de la porte). */
export const BORNE_PLAFOND_PORTEUR_USD = 20;

export interface ParamsJobPorteur {
  readonly origine: OrigineJobPorteur;
  /** Plafond de coût cumulé de CE porteur (somme des réservations), en dollars. */
  readonly plafondJobUsd: number;
}

export interface JobPorteur {
  readonly jobId: string;
  /** Type du job : à utiliser comme `contentType` des appels rattachés (il est autorisé). */
  readonly contentType: string;
}

export async function creerJobPorteur(p: ParamsJobPorteur): Promise<JobPorteur> {
  if (!(
    typeof p.plafondJobUsd === "number" &&
    Number.isFinite(p.plafondJobUsd) &&
    p.plafondJobUsd > 0 &&
    p.plafondJobUsd <= BORNE_PLAFOND_PORTEUR_USD
  )) {
    throw new BlogClaudeRefusError("Plafond du job porteur invalide", "config_invalide");
  }
  const autorises = typesClaudeAutorises();
  const contentType = TYPES_PREFERES.find((t) => autorises.has(t));
  if (!contentType) {
    throw new BlogClaudeRefusError(
      "Aucun type de contenu autorisé pour un job porteur",
      "config_invalide",
    );
  }
  try {
    const job = await prisma.contentGenJob.create({
      data: {
        idempotencyKey: `${PREFIXE_CLE_PORTEUR}${p.origine}:${randomUUID()}`,
        contentType,
        status: "cancelled",
        primaryProvider: "anthropic",
        completedAt: new Date(),
        errorMessage: "Job porteur : rattache des appels Claude hors génération à la porte de coût",
        inputPayload: { origine: p.origine, plafondJobUsd: p.plafondJobUsd, porteur: true },
        createdBy: `porteur:${p.origine}`,
      },
      select: { id: true },
    });
    return { jobId: job.id, contentType };
  } catch {
    throw new BlogClaudeRefusError(
      "Création du job porteur impossible (base en erreur) : appel refusé",
      "base_indisponible",
    );
  }
}
