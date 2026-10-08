/**
 * LE SCRIPT DE LA PAGE DE DÉPÔT : `/api/partage/script-depot` (Candidatures unifiées L5b).
 *
 * Fichier statique de même origine (`script-src 'self'` sur la seule page
 * `…/deposer`) : aucun script en ligne, aucun paquet du site. Le contenu est
 * dans `src/server/partages/script-depot.ts`, testé dans un vrai DOM.
 */

import { SCRIPT_DEPOT } from "@/server/partages/script-depot";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(SCRIPT_DEPOT, {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
