/**
 * Redirect 308 (permanent) — MORT→REDIR (DECISION-IA §5-E, 2026-06-16).
 *
 * Page fantôme (détail de lot géo) sans contenu propre. Le détail d'une
 * campagne — y compris ses lots géo — vit dans `/coverage/[id]`. On redirige
 * sur le même `id` pour préserver les liens existants.
 *
 * Aucune capacité perdue : tout est dans `/coverage/[id]`.
 */

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function GeoBatchDetailRedirect({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  permanentRedirect(`/${locale}/${adminPrefix}/content-gen/coverage/${id}`);
}
