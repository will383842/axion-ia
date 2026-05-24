/**
 * Redirect 308 (permanent) — Sprint v7 Phase 3 commit 2 cleanup (2026-05-23).
 *
 * Ancien wizard 5 étapes `/coverage/new` remplacé par le wizard 4 steps
 * `/campaigns/new` (commit 8f4d0e9d). On garde cette route comme stub
 * permanentRedirect pour préserver les bookmarks et liens externes existants.
 *
 * Cf. §5.1 prompt v7 : "Redirect 308 → /campaigns/new (garder route stub
 * pour bookmarks)".
 */

import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CoverageNewLegacyRedirect({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  permanentRedirect(`/${locale}/${adminPrefix}/content-gen/campaigns/new`);
}
