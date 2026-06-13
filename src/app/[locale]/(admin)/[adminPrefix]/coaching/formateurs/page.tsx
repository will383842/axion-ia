// Coaching 1-to-1 — comptes formateurs (activer/désactiver, envoyer un lien de
// connexion passwordless). La fiche riche reste dans Formation / Qualiopi.

import { listFormateurs } from "@/server/coaching-admin/queries";
import { FormateurAccountManager } from "@/components/admin/coaching/FormateurAccountManager";

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
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-mocha text-xl font-semibold">Comptes formateurs</h1>
      <p className="text-fg-muted text-sm">
        Les formateurs se connectent à leur espace <strong>sans mot de passe</strong> (lien magique
        par e-mail). Désactiver un compte coupe l&apos;accès immédiatement. Vous pouvez aussi leur
        envoyer un lien de connexion directement.
      </p>
      <FormateurAccountManager formateurs={formateurs} />
    </div>
  );
}
