/**
 * KB-4 — State machine `KbStatus` workflow technique.
 *
 * Spec : `_AUDIT/KNOWLEDGE-BASE-2026/08-WORKFLOW-VERSIONING.md` §1.1.
 * Pure (testable sans DB). Valide chaque transition avec la matrice rôle/auteur.
 *
 * Convention rôles : super_admin > admin > editor > reviewer (claim metadata)
 *  > reader (read-only).
 *  - OWNER role = super_admin
 *  - EDITOR role = super_admin/admin/editor
 *  - REVIEWER role = super_admin/admin/editor + claim `kbReviewer` (V1 simplifié)
 */

import type { KbStatus } from "../../../prisma/generated/client";

export type KbTransitionRoleRequirement = "OWNER" | "EDITOR" | "REVIEWER" | "SYSTEM";

export interface KbTransition {
  readonly from: KbStatus;
  readonly to: KbStatus;
  readonly minimumRole: KbTransitionRoleRequirement;
  readonly requireDistinctFromAuthor: boolean;
  readonly description: string;
}

export const KB_TRANSITIONS: readonly KbTransition[] = [
  {
    from: "draft",
    to: "draft",
    minimumRole: "EDITOR",
    requireDistinctFromAuthor: false,
    description: "Autosave draft",
  },
  {
    from: "draft",
    to: "review",
    minimumRole: "EDITOR",
    requireDistinctFromAuthor: false,
    description: "Soumettre en revue",
  },
  {
    from: "draft",
    to: "archived",
    minimumRole: "OWNER",
    requireDistinctFromAuthor: false,
    description: "Force discard",
  },
  {
    from: "review",
    to: "draft",
    minimumRole: "REVIEWER",
    requireDistinctFromAuthor: false,
    description: "Revue rejetée",
  },
  {
    from: "review",
    to: "approved",
    minimumRole: "REVIEWER",
    requireDistinctFromAuthor: true,
    description: "Revue approuvée",
  },
  {
    from: "approved",
    to: "scheduled",
    minimumRole: "EDITOR",
    requireDistinctFromAuthor: false,
    description: "Planifier publication",
  },
  {
    from: "approved",
    to: "published",
    minimumRole: "EDITOR",
    requireDistinctFromAuthor: false,
    description: "Publier maintenant",
  },
  {
    from: "approved",
    to: "draft",
    minimumRole: "REVIEWER",
    requireDistinctFromAuthor: false,
    description: "Recall pour edits",
  },
  {
    from: "scheduled",
    to: "published",
    minimumRole: "SYSTEM",
    requireDistinctFromAuthor: false,
    description: "Cron publication différée",
  },
  {
    from: "scheduled",
    to: "approved",
    minimumRole: "EDITOR",
    requireDistinctFromAuthor: false,
    description: "Annuler planning",
  },
  {
    from: "scheduled",
    to: "archived",
    minimumRole: "OWNER",
    requireDistinctFromAuthor: false,
    description: "Force archive",
  },
  {
    from: "published",
    to: "published",
    minimumRole: "EDITOR",
    requireDistinctFromAuthor: false,
    description: "Hot-fix mineur",
  },
  {
    from: "published",
    to: "archived",
    minimumRole: "OWNER",
    requireDistinctFromAuthor: false,
    description: "Retrait",
  },
  {
    from: "published",
    to: "deprecated",
    minimumRole: "OWNER",
    requireDistinctFromAuthor: false,
    description: "Remplacé (replacedById)",
  },
  {
    from: "deprecated",
    to: "archived",
    minimumRole: "OWNER",
    requireDistinctFromAuthor: false,
    description: "Retrait final",
  },
  {
    from: "deprecated",
    to: "published",
    minimumRole: "OWNER",
    requireDistinctFromAuthor: false,
    description: "Annule deprecate",
  },
  {
    from: "archived",
    to: "draft",
    minimumRole: "OWNER",
    requireDistinctFromAuthor: false,
    description: "Restore édition",
  },
] as const;

export type AdminRoleString = "super_admin" | "admin" | "editor" | "reader" | string;

function roleSatisfies(role: AdminRoleString, requirement: KbTransitionRoleRequirement): boolean {
  if (requirement === "SYSTEM") return false;
  if (requirement === "OWNER") return role === "super_admin";
  if (requirement === "REVIEWER" || requirement === "EDITOR") {
    return role === "super_admin" || role === "admin" || role === "editor";
  }
  return false;
}

export interface TransitionContext {
  readonly userRole: AdminRoleString;
  readonly userId: string;
  readonly authorId?: string | null;
  readonly system?: boolean;
}

export interface TransitionDecision {
  readonly ok: boolean;
  readonly reason?: "not_allowed" | "forbidden_role" | "must_differ_from_author" | "system_only";
  readonly transition?: KbTransition;
}

export function validateTransition(
  from: KbStatus,
  to: KbStatus,
  context: TransitionContext,
): TransitionDecision {
  const transition = KB_TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!transition) return { ok: false, reason: "not_allowed" };

  if (transition.minimumRole === "SYSTEM") {
    if (!context.system) return { ok: false, reason: "system_only", transition };
    return { ok: true, transition };
  }

  if (!roleSatisfies(context.userRole, transition.minimumRole)) {
    return { ok: false, reason: "forbidden_role", transition };
  }

  if (
    transition.requireDistinctFromAuthor &&
    context.authorId &&
    context.authorId === context.userId
  ) {
    return { ok: false, reason: "must_differ_from_author", transition };
  }

  return { ok: true, transition };
}

export function allowedTransitionsFrom(from: KbStatus, role: AdminRoleString): readonly KbStatus[] {
  return KB_TRANSITIONS.filter(
    (t) => t.from === from && t.minimumRole !== "SYSTEM" && roleSatisfies(role, t.minimumRole),
  ).map((t) => t.to);
}
