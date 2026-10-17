/**
 * Le contexte de la requête en cours (IP hachée, user-agent), pour le journal.
 *
 * Même composition que `contexteRequete` de `_guards` (mêmes helpers partagés
 * `hashIp` et `ipVisiteurOuNull` : la RÈGLE n'est pas recopiée), exposée pour les
 * écritures qui journalisent DANS leur transaction (chantier QNC, L10) :
 * 75 specs remplacent `_guards` tout entier par un mock, où cette fonction
 * deviendrait `undefined` (cf. le même raisonnement pour `verrou-dossier-garde`).
 *
 * ⚠️ `_guards` garde son propre `import "next/headers"` : les gardes
 * `*.graphe-worker.spec.ts` s'en servent de témoin.
 */

import { headers } from "next/headers";
import { hashIp } from "@/lib/security/ip-hash";
import { ipVisiteurOuNull } from "@/lib/client-ip";
import type { ContexteJournal } from "@/server/journal/journaliser";

export async function contexteRequeteQualiopi(): Promise<ContexteJournal> {
  const h = await headers();
  // IP du visiteur par la règle unique (cf. lib/client-ip-core) : via Cloudflare,
  // x-forwarded-for et x-real-ip ne portaient que le relais Cloudflare.
  // A-02 (RGPD) : hachage de l'IP avant stockage (aligné sur le reste du repo).
  return { ipAddress: hashIp(ipVisiteurOuNull(h)), userAgent: h.get("user-agent") || null };
}
