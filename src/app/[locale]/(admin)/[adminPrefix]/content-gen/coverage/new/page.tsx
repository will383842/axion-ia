/**
 * Redirect 308 (permanent) — MORT→REDIR (DECISION-IA §5-E, 2026-06-16).
 *
 * Ancien wizard `/coverage/new` remplacé par le wizard unique 4 étapes
 * `/campaigns/new` (point d'entrée unique de lancement). On garde cette route
 * comme stub `permanentRedirect` pour préserver les bookmarks et liens externes,
 * en PROPAGEANT la query (?preset=, ?ville=, etc.) vers le wizard pré-rempli.
 *
 * Aucune capacité perdue : la création de campagne vit désormais dans
 * `/campaigns/new`.
 */

import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CoverageNewLegacyRedirect({
  params,
  searchParams,
}: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = await searchParams;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) {
      for (const v of value) query.append(key, v);
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }
  const qs = query.toString();

  permanentRedirect(
    `/${locale}/${adminPrefix}/content-gen/campaigns/new${qs ? `?${qs}` : ""}`,
  );
}
