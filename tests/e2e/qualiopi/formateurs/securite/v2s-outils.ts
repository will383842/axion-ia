// Banc @formateurs, vérification n° 2 (rouge sécurité) — outils COMMUNS des
// scénarios `v2s*`, côté `tsx`.
//
// Rangé à côté de `donnees.ts` : il importe le domaine (session de l'espace
// formateur), que `pnpm qualiopi:isolation-check` cantonne à cette zone.

import { signFormateurSession } from "@/lib/formateur-session";
import {
  empreinteSessionFormateur,
  versionSessionFormateur,
} from "@/server/qualiopi/formateurs-independants/version-session";

export function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

/** L'adresse d'une redirection Next (`redirect()` lève), ou la valeur rendue. */
export async function issue(f: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify(await f());
  } catch (e) {
    const digest = (e as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";")[2] ?? digest;
    }
    return `levee:${e instanceof Error ? e.message : String(e)}`;
  }
}

export interface Http {
  statut: number;
  corps: string;
  location: string | null;
}

export async function reponse(r: Response): Promise<Http> {
  return { statut: r.status, corps: await r.text(), location: r.headers.get("location") };
}

/** Une VRAIE session de l'espace formateur, telle que la route de connexion la signe. */
export function sessionEspace(t: { id: string; email: string }): Promise<string> {
  return signFormateurSession(
    t.id,
    "formateur",
    undefined,
    versionSessionFormateur({ finCollaborationAt: null }),
    empreinteSessionFormateur(t.email) ?? undefined,
  );
}

/** Lecture d'un interrupteur `{ actif }` en base. */
export function estAllume(valeur: unknown): boolean {
  return (valeur as { actif?: unknown } | null)?.actif === true;
}
