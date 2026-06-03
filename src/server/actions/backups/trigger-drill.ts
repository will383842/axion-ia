/**
 * Backups & DR (ADR 0032) — déclenchement manuel d'un drill de restauration.
 *
 * Le SEUL canal d'exécution distant disponible est GitHub workflow_dispatch
 * (lancer un backup côté VPS nécessiterait un accès SSH, hors périmètre web).
 * On dispatch donc le workflow `restore-drill-monthly.yml`.
 *
 * Dégrade proprement si `GH_DISPATCH_TOKEN` (token GitHub actions:write) absent.
 */

"use server";

import { requireAdminWrite } from "./_guards";

export interface TriggerResult {
  ok: boolean;
  message: string;
}

export async function triggerRestoreDrill(): Promise<TriggerResult> {
  await requireAdminWrite();

  const token = process.env.GH_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY ?? "will383842/axion-ia";
  if (!token) {
    return {
      ok: false,
      message:
        "Déclenchement non configuré : définir GH_DISPATCH_TOKEN (token GitHub actions:write) côté Coolify.",
    };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/restore-drill-monthly.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main" }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      },
    );
    if (res.status === 204) {
      return { ok: true, message: "Drill de restauration déclenché (workflow GitHub Actions)." };
    }
    return { ok: false, message: `Échec dispatch GitHub : HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "erreur inconnue" };
  }
}
