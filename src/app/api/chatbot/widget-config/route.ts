// GET /api/chatbot/widget-config — config d'affichage RUNTIME du widget.
//
// Lue par ChatWidgetMount à l'idle → on/off + canary par page pilotés depuis la
// console admin (ChatTenant.actif + reglages.pages), SANS redéploiement.
//
// Kill-switch maître = `CHATBOT_ENABLED` (env serveur) : s'il n'est pas "true",
// l'endpoint renvoie enabled:false quoi qu'il arrive (ceinture + bretelles).
// Léger + caché 30 s (CDN) pour ne pas marteler l'origine. Fail-soft → désactivé.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { CHATBOT_TENANT_KEY } from "@/server/chatbot/constants";
import { mergeSettings } from "@/server/chatbot/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface WidgetConfig {
  readonly enabled: boolean;
  /** Préfixes de pages autorisés ; ["*"] = toutes. */
  readonly pages: ReadonlyArray<string>;
}

export async function GET(_req: NextRequest): Promise<Response> {
  let config: WidgetConfig = { enabled: false, pages: ["*"] };

  // Kill-switch maître serveur.
  if (process.env.CHATBOT_ENABLED === "true") {
    try {
      const t = await prisma.chatTenant.findUnique({
        where: { cle: CHATBOT_TENANT_KEY },
        select: { actif: true, reglages: true },
      });
      if (t) {
        config = { enabled: t.actif, pages: mergeSettings(t.reglages).pages };
      }
    } catch {
      /* fail-soft → désactivé */
    }
  }

  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
  });
}
