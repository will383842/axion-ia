// Comptes formateurs — activer/désactiver, envoyer un lien de connexion
// passwordless. Concerne TOUS les formateurs, collectif comme 1-to-1 ; la fiche
// riche reste dans Formation / Qualiopi. L'entrée de menu vit désormais sous
// Formation / Qualiopi (déplacée le 2026-07-28), le chemin d'URL est conservé
// pour ne pas casser les liens existants.

import type { Metadata } from "next";

import { listFormateurs } from "@/server/coaching-admin/queries";
import { FormateurAccountManager } from "@/components/admin/coaching/FormateurAccountManager";

// Cet écran était le seul du pôle Qualiopi sans titre : l'onglet du navigateur
// affichait le nom générique du site. Le reste du back-office en manque aussi
// (169 pages sur 254) — on ne corrige QUE celle-ci, parce qu'elle vient de
// rejoindre un pôle où toutes les autres en ont un.
export const metadata: Metadata = {
  title: "Qualiopi — Accès & connexions formateurs | Axion-IA Admin",
  robots: { index: false, follow: false },
};

export default async function CoachingFormateursPage(): Promise<React.ReactElement> {
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

  return (
    <div className="space-y-4">
      <h1 className="text-mocha text-xl font-semibold">Accès &amp; connexions formateurs</h1>
      <p className="text-fg-muted text-sm">
        Les formateurs se connectent à leur espace <strong>sans mot de passe</strong> (lien magique
        par e-mail). Désactiver un compte coupe l&apos;accès immédiatement. Vous pouvez aussi leur
        envoyer un lien de connexion directement.
      </p>
      <FormateurAccountManager formateurs={formateurs} />
    </div>
  );
}
