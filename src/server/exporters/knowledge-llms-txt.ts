/**
 * KB-8 — Génère llms.txt enrichi des entries KB publiques.
 * Format llms.txt : https://llmstxt.org/
 */

import { prisma } from "@/lib/prisma";
import type { Locale } from "../../../prisma/generated/client";
import { buildKbPublicUrl } from "@/content/knowledge/routes";

const SITE_NAME = "Axion-IA";
const SITE_TAGLINE_FR = "Cabinet IA opérationnel B2B premium";
const SITE_TAGLINE_EN = "Operational AI consultancy B2B premium";

export async function buildLlmsTxt(locale: Locale, baseUrl: string): Promise<string> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      audience: "public",
      status: { in: ["published", "deprecated"] },
      deletedAt: null,
    },
    include: { translations: { where: { locale } } },
    orderBy: [{ type: "asc" }, { publishedAt: "desc" }],
    take: 500,
  });

  const tagline = locale === "fr" ? SITE_TAGLINE_FR : SITE_TAGLINE_EN;
  const intro =
    locale === "fr"
      ? `${SITE_NAME} — ${tagline}. Interventions IA sur site, audit, implémentation.`
      : `${SITE_NAME} — ${tagline}. On-site AI sessions, audits, implementation.`;

  const byType = new Map<string, string[]>();
  for (const e of entries) {
    const t = e.translations[0];
    if (!t) continue;
    const url = buildKbPublicUrl(e.type, locale, t.slug);
    if (!url) continue;
    const fullUrl = `${baseUrl}${url}`;
    const line = `- [${t.title}](${fullUrl}): ${(t.excerpt ?? "").slice(0, 160).replace(/\n/g, " ")}`;
    const list = byType.get(e.type) ?? [];
    list.push(line);
    byType.set(e.type, list);
  }

  let out = `# ${SITE_NAME}\n\n> ${intro}\n\n`;
  for (const [type, lines] of byType.entries()) {
    out += `## ${type}\n\n`;
    out += lines.join("\n");
    out += "\n\n";
  }
  return out;
}
