/**
 * Content Generator — Auteur Manon (admin /content-gen/author/manon).
 *
 * § 12.1bis + § 9.8 doctrine v2.1 (Option A IA disclosed, zéro réseau social).
 * Édition displayName / jobTitle / bio markdown / photoAlt / disclaimer.
 * Le JSON-LD Person est reconstruit à chaque save via la table AuthorProfile.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAuthor } from "@/server/actions/content-gen/author";
import { AuthorManonV2 } from "./_v2/AuthorManonV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function AuthorManonPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const author = await getAuthor("manon");

  if (author) {
    return <AuthorManonV2 author={author} />;
  }

  if (!author) {
    return (
      <section>
        <div className="admin-card">
          <h1 className="admin-h1-large">Profil Manon — introuvable</h1>
          <p>
            Le row <code>slug=&quot;manon&quot;</code> n&apos;existe pas dans{" "}
            <code>AuthorProfile</code>. Lance le seed Sprint 1 Day 1 (commit <code>d174f83</code>) :{" "}
            <code>pnpm tsx prisma/seeds/content-gen/author-manon.ts</code>.
          </p>
        </div>
      </section>
    );
  }
}
