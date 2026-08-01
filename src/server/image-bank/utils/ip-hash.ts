// Hash IP dédié image-bank — extrait de `[locale]/galerie/[slug]/telecharger/route.ts`
// (correctif P0 audit UX 2026-08, page RGPD) pour être réutilisable côté
// Server Action sans dupliquer une 3ᵉ variante de "hashIp" dans le repo.
//
// ⚠️ IMPORTANT — ce n'est PAS la même fonction que `src/lib/security/ip-hash.ts`
// (`hashIp`) : celle-ci tronque à 16 hex avec un séparateur `salt::ip` et sert
// un tout autre domaine (formulaires de contact, signatures Qualiopi, chatbot).
// `ImageUsageLog.ipHash` et `ImageDownloadLog.ipHash` sont peuplés par CETTE
// fonction (SHA-256 complet 64 hex, séparateur `salt:ip`) depuis le début du
// module image-bank — la réutiliser est nécessaire pour qu'une recherche RGPD
// (IP en clair → hash) retombe sur les valeurs déjà stockées en base.

import { createHash } from "node:crypto";
import { env } from "@/env";

/** SHA-256(salt:ip) complet (64 hex) — format historique image-bank. */
export function hashImageBankIp(ip: string): string {
  const salt = env.IP_HASH_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
