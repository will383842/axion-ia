// Admin — la trame imprimable de l'échange avec un candidat apporteur.
//
// 🔒 Interne. Page admin, jamais un fichier de `public/` : sans session
// autorisée, redirection vers la connexion ; avec une session sans le droit de
// voir les appels, 404. `noindex`, absente du sitemap.
//
// Le segment statique `trame-apporteur` passe avant `imprimes/[id]`.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { BoutonImprimer } from "@/features/admin-imprimes/BoutonImprimer";
import {
  prenomPourLaTrame,
  TrameEchangeApporteur,
} from "@/features/admin-imprimes/TrameEchangeApporteur";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trame d'échange apporteur · Axion-IA",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ prenom?: string | string[] }>;
}

export default async function TrameApporteurPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = (await auth()) as { user?: { role?: string | null } | null } | null;
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  if (!peutVoirLesAppels(session.user.role)) notFound();

  const sp = await searchParams;
  const brut = Array.isArray(sp.prenom) ? sp.prenom[0] : sp.prenom;

  return <TrameEchangeApporteur prenom={prenomPourLaTrame(brut)} barre={<BoutonImprimer />} />;
}
