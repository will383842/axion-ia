/**
 * Qualiopi — RBAC guards + audit trail pour les Server Actions.
 *
 * Réutilise les guards RBAC de la Knowledge Base (NextAuth 5). Les rôles
 * `responsable_qualite` et `secretaire` ont été AJOUTÉS à `AdminRole` le
 * 2026-08-15 : sans eux, la matrice d'habilitation n'était pas exprimable —
 * la seule façon de donner accès à un poste administratif était `editor`, qui
 * pouvait attester, facturer, conclure un devis et habiliter un formateur.
 * Les rôles applicatifs (formateur interne/externe, auditeur) restent modélisés
 * par-dessus via des tables + token auditeur, pas ici.
 *
 * `logQualiopiActivity()` = miroir du pattern `logActivity()` content-gen
 * (best-effort, fail-silent) → trace toute mutation Qualiopi dans `ActivityLog`
 * (RGPD art. 30 + preuve d'audit Qualiopi). targetType préfixé `qualiopi.`.
 */

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import {
  requireAdminRead,
  requireAdminWrite,
  requireAdminPublish,
  requireAdminDelete,
  requireSuperAdmin,
  type AdminSession,
} from "@/server/actions/knowledge/_guards";
import { peutEngager, MOTIF_REFUS, type ActeEngageant } from "@/server/auth/habilitations";

export {
  requireAdminRead,
  requireAdminWrite,
  requireAdminPublish,
  requireAdminDelete,
  requireSuperAdmin,
};
// NB : PAS de `export type { AdminSession }` ici. Turbopack (Next 16.2) traite à
// tort un `export type { … }` (re-export specifier) dans un module "use server"
// comme un Server Action runtime → `registerServerReference(AdminSession, …)` →
// `ReferenceError: AdminSession is not defined` (500 sur toute la console admin).
// Les consommateurs importent le type depuis sa source : @/server/actions/knowledge/_guards.

/**
 * Garde des actes qui ENGAGENT L'ORGANISME — la seule porte, pour tous.
 *
 * 🔴 À utiliser À LA PLACE de `requireAdminWrite` sur tout acte engageant.
 * `requireAdminWrite` autorise `editor` : c'est correct pour produire un
 * brouillon, envoyer une convocation ou classer une pièce, et c'est faux pour
 * attester, facturer, conclure ou habiliter. La matrice vit dans un module PUR
 * (`@/server/auth/habilitations`), pas ici : une garde recopiée action par
 * action est exactement ce qui a laissé quatre actes engageants ouverts à
 * `editor` jusqu'au 2026-08-15.
 *
 * ⚠️ Le message d'erreur porte le MOTIF, pas un code. Il remonte tel quel à
 * l'écran : « cet acte engage l'organisme — à faire par un responsable
 * habilité » évite l'appel téléphonique que produit un bouton absent sans
 * explication.
 *
 * @param acte  acte engageant, au sens de `ActeEngageant`.
 * @throws `forbidden: <motif>` si le rôle de la session n'est pas habilité.
 */
export async function requireHabilitation(acte: ActeEngageant): Promise<AdminSession> {
  const session = await requireAdminRead();
  if (!peutEngager(session.role, acte)) {
    throw new Error(`forbidden: ${MOTIF_REFUS[acte]}`);
  }
  return session;
}

export interface QualiopiActivityInput {
  /** Action canonique ex. "qualiopi.config.set", "qualiopi.formation.publish". */
  readonly action: string;
  /** Type de cible ex. "SiteSetting", "Formation", "TrainingSession". */
  readonly targetType?: string;
  /** ID de la cible. */
  readonly targetId?: string | null;
  /** Diff/payload sérialisable (anonymisé si PII). */
  readonly changes?: unknown;
  /** Session admin (via requireAdmin*). */
  readonly session: AdminSession;
}

/**
 * Persiste une entrée ActivityLog pour une action Qualiopi. Best-effort :
 * un log raté n'invalide jamais l'action métier.
 */
export async function logQualiopiActivity(input: QualiopiActivityInput): Promise<void> {
  try {
    const h = await headers();
    const rawIp =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      h.get("cf-connecting-ip") ||
      null;
    // A-02 (RGPD) : hachage de l'IP avant stockage (aligné sur le reste du repo).
    const ipAddress = hashIp(rawIp);
    const userAgent = h.get("user-agent") || null;
    await prisma.activityLog.create({
      data: {
        adminUserId: input.session.userId,
        action: input.action.slice(0, 120),
        targetType: (input.targetType ?? "qualiopi").slice(0, 80),
        targetId: input.targetId ?? null,
        changes: (input.changes ?? null) as never,
        ipAddress: ipAddress?.slice(0, 64) ?? null,
        userAgent: userAgent?.slice(0, 2000) ?? null,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[qualiopi-activity-log] persist failed (best-effort):",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
