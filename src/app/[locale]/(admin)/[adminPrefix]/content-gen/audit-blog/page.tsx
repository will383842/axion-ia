/**
 * Admin — Audit de l'existant du blog (lot L10, audit blog/RAG du 24/10/2026).
 *
 * Liste les articles publiés qui violent les nouvelles règles de publication,
 * par catégorie. La page n'exécute RIEN d'elle-même : chaque geste réversible
 * (retirer de Google, archiver) part d'un clic d'un administrateur sur un
 * article, jamais en masse. Server Component, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { chargerAuditBlog } from "@/server/content-gen/lecture-audit-blog";
import { AuditBlogV2 } from "./_v2/AuditBlogV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Audit de l'existant du blog | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function AuditBlogPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  // Les boutons modifient des articles : il faut un rôle d'écriture. Sans session,
  // la garde redirige vers la connexion ; sans le bon rôle, elle dit pourquoi.
  const acces = await gardePage("ecriture", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}/content-gen`} />;
  }

  const audit = await chargerAuditBlog();
  return <AuditBlogV2 adminPrefix={adminPrefix} audit={audit} />;
}
