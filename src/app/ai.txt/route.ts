// ai.txt — préférences IA d'Axion-IA (format Spawning.ai / IAB AI Preferences, brouillon).
//
// 🔴 Audit GEO du 2026-11-11 : ce fichier déclarait « ai-training: disallow » pour GPTBot,
// ClaudeBot, Google-Extended et CCBot, alors que robots.txt les AUTORISE (décision du
// fondateur : option « cité partout »). Deux fichiers officiels contradictoires : un
// robot qui lit les deux applique le plus restrictif, et c'est la citation qui se perd.
//
// Les deux fichiers dérivent désormais de la même liste (`src/lib/seo/robots-agents.ts`) :
//   - robots d'IA (citation et entraînement) : autorisés, comme dans robots.txt ;
//   - scrapers parasites (`BOTS_BLOQUES`) : refusés, comme dans robots.txt.
// Verrouillé par `ai.txt/route.spec.ts`.

import { SITE_URL } from "@/lib/seo";
import { AGENTS_IA_AUTORISES, BOTS_BLOQUES } from "@/lib/seo/robots-agents";

export const runtime = "edge";

const bloc = (agent: string, autorise: boolean) =>
  autorise
    ? `User-Agent: ${agent}\nai-training: allow\nai-citation: allow`
    : `User-Agent: ${agent}\nai-training: disallow\nai-citation: disallow`;

export function GET() {
  const body = `# ai.txt — Axion-IA AI preferences
# Standard: Spawning.ai / IAB AI Preferences (draft 2025)
# Source officielle: ${SITE_URL}
# Voir aussi: ${SITE_URL}/robots.txt et ${SITE_URL}/llms.txt
# Même politique que robots.txt : les robots d'IA peuvent lire, citer et apprendre
# du contenu public ; seuls les scrapers parasites sont refusés.

# ─── Préférences globales ─────────────────────────────────────────────────
User-Agent: *
Allow: /
ai-training: allow
ai-citation: allow

# ─── Robots d'IA — autorisés (identiques à robots.txt) ────────────────────
${AGENTS_IA_AUTORISES.map((a) => bloc(a, true)).join("\n\n")}

# ─── Scrapers parasites — refusés (identiques à robots.txt) ───────────────
${BOTS_BLOQUES.map((a) => bloc(a, false)).join("\n\n")}

# ─── Contact ──────────────────────────────────────────────────────────────
# Pour toute question sur la réutilisation du contenu : contact@axion-ia.com
commercial-reuse-license: contact@axion-ia.com
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=86400, stale-while-revalidate=604800, stale-if-error=604800",
    },
  });
}
