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
    // Audit UX 2026-08-01 (Défaut 3, P0) — même correctif que l'étape 2 de
    // l'onboarding : aucun bouton console ne crée ce profil (cette page ne
    // peut qu'éditer une ligne AuthorProfile existante), donc pas de commande
    // terminal affichée à Will.
    return (
      <section>
        <div className="admin-card">
          <h1 className="admin-h1-large">Profil Manon — introuvable</h1>
          <p>
            Le profil auteur Manon n&apos;a pas encore été créé. Contactez l&apos;équipe technique
            pour cette étape.
          </p>
        </div>
      </section>
    );
  }
}
