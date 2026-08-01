// Qualiopi — page racine legacy « Vue d'ensemble », redirige vers le pipeline.
//
// Audit UX console du 2026-08-01 (P0 n°3, phase 2) : cette page recréait
// l'ancienne organisation par table (22 cartes-liens + 15 counts Prisma
// qu'aucune autre page n'utilisait) en doublon direct de « Dossiers
// (pipeline) ». L'URL reste accessible (préfixe naturel bookmarké, parent
// visuel de ~40 sous-routes — un 404 ici serait une régression) mais
// matérialise la nouvelle porte d'entrée. Même idiome que submissions/page.tsx.
// Le garde auth() est conservé : sans session, on part vers /login comme
// toutes les pages admin (les tests E2E l'assertent).

import { permanentRedirect, redirect } from "next/navigation";

import { auth } from "@/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LegacyQualiopiHubRedirect({
  params,
  searchParams,
}: PageProps): Promise<never> {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const sp = await searchParams;
  // La cible consomme ?activite=, ?perimetre=, ?archives= — on recopie tout.
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined) qs.set(k, v);
  }
  const suffix = qs.toString();
  permanentRedirect(`/fr/${adminPrefix}/qualiopi/dossiers${suffix ? `?${suffix}` : ""}`);
}
