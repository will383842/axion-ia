/**
 * KB-9 — Helpers pour surface client connectée `/mes-ressources/`.
 *
 * Authentification : magic-token Booking V1 réutilisé (cf. Agent 7 §07-CLIENT-SURFACE).
 * V1 minimal : liste entries audience IN ('public', 'client') publiées.
 * V1.5 : matching tags par booking (Sprint KB-18).
 */

import { prisma } from "@/lib/prisma";
import type { Locale } from "../../../prisma/generated/client";
import { buildKbPublicUrl } from "@/content/knowledge/routes";

export interface ClientResource {
  readonly entryId: string;
  readonly type: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly url: string;
  readonly publishedAt: Date | null;
  readonly audience: string;
}

/**
 * Liste les ressources accessibles à un client connecté.
 * V1 : public + client audiences (pas de matching booking).
 */
export async function listClientResources(locale: Locale): Promise<readonly ClientResource[]> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      audience: { in: ["public", "client"] },
      status: { in: ["published", "deprecated"] },
      deletedAt: null,
    },
    include: { translations: { where: { locale } } },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return entries
    .map((e): ClientResource | null => {
      const t = e.translations[0];
      if (!t) return null;
      const url = buildKbPublicUrl(e.type, locale, t.slug);
      if (!url) return null;
      return {
        entryId: e.id,
        type: e.type,
        slug: t.slug,
        title: t.title,
        excerpt: t.excerpt,
        url,
        publishedAt: e.publishedAt,
        audience: e.audience,
      };
    })
    .filter((r): r is ClientResource => r !== null);
}
