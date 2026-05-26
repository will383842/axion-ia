// Contacts admin — sous-onglet RDV Calendly (Sprint Notif Infra 2026-05-26).
//
// V1 placeholder : la table `CalendlyEvent` est créée en Phase 7 (Chantier 3).
// Cette page affiche un bandeau d'information honnête + lien vers le dashboard
// Calendly natif. Le listing réel sera ajouté en Phase 7.

import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default function ContactsCalendlyPage(): React.ReactElement {
  return (
    <>
      <AdminPageHeader
        title="RDV Calendly"
        description="Réservations via le widget Calendly inline sur /appel."
      />
      <div className="admin-card mt-[var(--space-admin-6)] p-[var(--space-admin-6)]">
        <div className="rounded-lg border border-[color:var(--color-admin-warning-border)] bg-[color:var(--color-admin-warning-bg)] p-4 text-sm text-[color:var(--color-admin-fg-default)]">
          <p className="font-semibold">
            ℹ️ La capture Calendly fonctionne en mode client-side gratuit.
          </p>
          <p className="mt-2">
            Seules les <strong>créations depuis /appel</strong> sont captées automatiquement (via
            Embed JS postMessage). Les annulations et déplacements doivent être marqués manuellement
            (consulter votre boîte Gmail pour les notifications Calendly officielles).
          </p>
          <p className="mt-2 text-[color:var(--color-admin-fg-muted)]">
            Listing en cours d&apos;implémentation (Phase 7 du sprint Notif Infra).
          </p>
        </div>
        <div className="mt-[var(--space-admin-6)]">
          <Link
            href="https://calendly.com/event_types/user/me"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-button-ghost"
          >
            Ouvrir Calendly (dashboard natif) →
          </Link>
        </div>
      </div>
    </>
  );
}
