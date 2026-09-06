// Comptes formateurs — activer/désactiver, envoyer un lien de connexion
// passwordless. Concerne TOUS les formateurs, collectif comme 1-to-1 ; la fiche
// riche reste dans Formation / Qualiopi. L'entrée de menu vit désormais sous
// Formation / Qualiopi (déplacée le 2026-07-28), le chemin d'URL est conservé
// pour ne pas casser les liens existants.

import type { Metadata } from "next";

import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { listFormateurs } from "@/server/coaching-admin/queries";
import { FormateurAccountManager } from "@/components/admin/coaching/FormateurAccountManager";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

// Cet écran était le seul du pôle Qualiopi sans titre : l'onglet du navigateur
// affichait le nom générique du site. Le reste du back-office en manque aussi
// (169 pages sur 254) — on ne corrige QUE celle-ci, parce qu'elle vient de
// rejoindre un pôle où toutes les autres en ont un.
export const metadata: Metadata = {
  title: "Qualiopi — Accès & connexions formateurs | Axion-IA Admin",
  robots: { index: false, follow: false },
};

export default async function CoachingFormateursPage({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const rows = await listFormateurs();
  const formateurs = rows.map((f) => ({
    id: f.id,
    prenom: f.prenom,
    nom: f.nom,
    email: f.email,
    statut: f.statut as string,
    region: f.region,
    actif: f.actif,
    lastFormateurLoginAt: f.lastFormateurLoginAt ? f.lastFormateurLoginAt.toISOString() : null,
    sessionsCount: f._count.coachingSessions,
    formationsCount: f._count.sessionsAnimees,
  }));

  // 🔴 Cette page restait sur les jetons du SITE PUBLIC (`text-mocha`,
  // `text-fg-muted`) avec un `<h1>` nu, sans aucune primitive admin — même
  // défaut que `coaching/seances`, et que `coaching/page.tsx` avant sa refonte.
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Accès & connexions formateurs"
        description="Les formateurs se connectent à leur espace sans mot de passe, par un lien envoyé sur leur e-mail. Désactiver un compte coupe l'accès immédiatement ; vous pouvez aussi envoyer un lien de connexion à la demande."
      />
      <FormateurAccountManager formateurs={formateurs} />
    </AdminPageShell>
  );
}
