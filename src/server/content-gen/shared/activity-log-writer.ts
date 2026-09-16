/**
 * Journal `ActivityLog` — le CHEMIN D'ÉCRITURE, sans requête ni session.
 *
 * ── POURQUOI CE MODULE EXISTE ────────────────────────────────────────────────
 *
 * 🔴 `logActivity` (`activity-log.ts`, juste à côté) est une Server Action.
 * Elle ouvrait son unique `try` par `await headers()`, puis écrivait la ligne
 * DANS LE MÊME `try`. Hors d'une requête Next — c'est le cas de tout worker
 * BullMQ, qui tourne `tsx src/server/queue/worker.ts` — `headers()` lève, le
 * `catch` best-effort avale, et **l'écriture n'a jamais lieu**. La trace SOC2
 * `content-gen.campaign.auto-stopped` du `content-gen-deadline-checker`
 * n'existait donc pas en base : aucune campagne arrêtée automatiquement n'a
 * laissé de trace. Même famille que le cron des autofactures (#1098), même
 * remède : un service pur, deux appelants.
 *
 * 🔑 Et il y en avait DEUX, empilés. Le worker passait
 * `userId: "system:deadline-checker"` : `ActivityLog.adminUserId` est un
 * `@db.Uuid` avec clé étrangère vers `AdminUser`. Même si `headers()` avait
 * répondu, le `create` aurait levé — et le même `catch` l'aurait avalé aussi.
 * Un acte du système s'écrit `adminUserId: null`, et son auteur se lit dans
 * `changes.origine` (cf. `acteurSysteme`).
 *
 * ── CE QUI NE CHANGE PAS ─────────────────────────────────────────────────────
 *
 * Les champs écrits, leurs troncatures (`action` 120, `targetType` 80,
 * `ipAddress` 64, `userAgent` 2000) et la forme de `changes` sont repris à
 * l'identique de `logActivity`. La console continue de journaliser exactement
 * comme avant, IP et navigateur compris : c'est l'enveloppe qui les lit, parce
 * qu'elle est la seule à avoir une requête sous la main.
 *
 * ── CE QUI CHANGE, ET À DESSEIN ──────────────────────────────────────────────
 *
 * L'échec n'est plus muet en production. `logActivity` ne prévenait qu'en
 * développement (`NODE_ENV !== "production"`), c'est-à-dire nulle part où ça
 * comptait. Un registre d'audit qui perd des lignes sans rien dire est
 * précisément ce que ce correctif ferme : l'écriture reste best-effort — un
 * journal raté n'annule jamais l'acte — mais elle se plaint, toujours.
 *
 * ⚠️ Ce module ne doit mener, par ses imports, ni à `server-only`, ni à
 * `next/headers`, ni à un fichier `"use server"`. Garde :
 * `src/server/queue/workers/__tests__/content-gen-deadline-checker.graphe-worker.spec.ts`.
 */

import { prisma } from "@/lib/prisma";

/** Qui agit. `adminUserId` vaut `null` quand personne n'est derrière l'acte. */
export interface ActeurJournal {
  /** UUID d'un `AdminUser`, ou `null` pour un acte du système. */
  readonly adminUserId: string | null;
  /** IP du client, si l'appelant a une requête. Jamais devinée. */
  readonly ipAddress?: string | null;
  /** User-Agent du client, si l'appelant a une requête. */
  readonly userAgent?: string | null;
  /**
   * D'où vient un acte SANS administrateur. Fusionnée dans `changes` à
   * l'écriture — sans elle, une ligne à `adminUserId: null` ne dit pas qui a
   * agi. Absente pour un acte humain : la forme de `changes` de la console
   * reste inchangée, octet pour octet.
   */
  readonly origine?: OrigineSysteme;
}

/**
 * Les origines système déclarées. Union fermée à dessein : une chaîne libre
 * laisserait s'installer deux orthographes pour le même cron, et le filtre de
 * `/activity-logs` ne verrait plus qu'une moitié des lignes.
 */
export type OrigineSysteme = "content-gen-deadline-checker";

/** Ce qu'on journalise, sans son auteur : c'est l'appelant qui le connaît. */
export interface EntreeJournal {
  /** Identifiant canonique de l'action ex. "content-gen.review.approve". */
  readonly action: string;
  /** Type de cible ex. "ReviewQueue", "Article", "CoverageCampaign". */
  readonly targetType?: string | undefined;
  /** ID de la cible (uuid). */
  readonly targetId?: string | null | undefined;
  /** Diff/payload sérialisable (anonymisé si PII). */
  readonly changes?: unknown;
}

/**
 * Un acte du SYSTÈME : aucun administrateur, aucune requête, aucune IP.
 *
 * `origine` part dans `changes`, exactement comme `journalSysteme` le fait
 * pour les autofactures (`autofacture-emission.ts`).
 */
export function acteurSysteme(origine: OrigineSysteme): ActeurJournal {
  return { adminUserId: null, ipAddress: null, userAgent: null, origine };
}

/** `changes` + l'origine quand l'acte vient du système. */
function changesAvecOrigine(changes: unknown, origine: OrigineSysteme | undefined): unknown {
  if (origine === undefined) return changes ?? null;
  if (typeof changes === "object" && changes !== null && !Array.isArray(changes)) {
    return { ...(changes as Record<string, unknown>), origine };
  }
  return { origine, ...(changes === undefined || changes === null ? {} : { valeur: changes }) };
}

/**
 * Persiste une entrée `ActivityLog`. Aucun appel à `headers()`, aucune garde de
 * session : utilisable depuis un worker, un script `tsx` ou une Server Action.
 *
 * Best-effort — une ligne d'audit ratée n'invalide jamais l'acte qu'elle
 * décrit — mais l'échec est TOUJOURS rapporté, production comprise.
 */
export async function ecrireJournalActivite(
  acteur: ActeurJournal,
  entree: EntreeJournal,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteur.adminUserId,
        action: entree.action.slice(0, 120),
        targetType: entree.targetType?.slice(0, 80) ?? null,
        targetId: entree.targetId ?? null,
        changes: changesAvecOrigine(entree.changes, acteur.origine) as never,
        ipAddress: acteur.ipAddress?.slice(0, 64) ?? null,
        userAgent: acteur.userAgent?.slice(0, 2000) ?? null,
      },
    });
  } catch (err) {
    console.error(
      `[activity-log] journal « ${entree.action} » non écrit pour ${entree.targetType ?? "?"} ` +
        `${entree.targetId ?? "?"} :`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
