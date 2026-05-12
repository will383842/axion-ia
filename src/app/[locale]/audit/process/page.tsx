import { redirect } from "next/navigation";

// Sprint 14.10.8 (Will 2026-05-12) — rename /audit/process → /audit/cible.
// L'ancien slug retournait du contenu "process" (4 étapes) qui ne correspondait
// pas au tier `audit-cible` de pricing.ts. Renommé pour cohérence SSOT.
// Cette page reste pour redirect 301 (préservation des backlinks externes
// et de l'historique SEO).

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AuditProcessRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/audit/cible`);
}
