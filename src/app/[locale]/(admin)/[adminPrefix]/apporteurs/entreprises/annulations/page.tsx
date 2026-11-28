// Contrat 2.8, art. 3.2 — « Rendez-vous annulés à qualifier ».
// Calendly renvoie `canceler_type: host` quel que soit l'auteur : on ne le déduit jamais, on le demande.

import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  LierReport,
  QualifierAnnulation,
} from "@/components/admin/apporteurs/entreprises/AnnulationRendezVous";
import { lireAnnulationsConsole } from "@/features/apporteurs-reseau/annulations-console";
import { heureConsole } from "@/features/apporteurs-reseau/statut-rendez-vous";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function AnnulationsRendezVousPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const administrateur = acces.role === "super_admin" || acces.role === "admin";
  const { aQualifier, enAttenteDeReport } = await lireAnnulationsConsole(new Date());
  return (
    <div className="flex flex-col gap-[var(--space-admin-4)]">
      <AdminPageHeader
        title="Rendez-vous annulés à qualifier"
        description="Dites qui a annulé chaque rendez-vous. Tant que ce n'est pas fait, la réservation reste retenue."
      />
      <AdminCard>
        <h2>À qualifier ({aQualifier.length})</h2>
        {aQualifier.length === 0 ? <p>Aucun rendez-vous annulé en attente.</p> : null}
        <ul className="flex flex-col gap-[var(--space-admin-4)]">
          {aQualifier.map((a) => (
            <li key={a.id}>
              <strong>{a.denomination}</strong> — fixé le{" "}
              {a.prevuAt ? heureConsole(a.prevuAt) : "date inconnue"}, constaté le{" "}
              {heureConsole(a.constateeAt)}, rappel le {heureConsole(a.echeance)}.
              {administrateur ? <QualifierAnnulation id={a.id} /> : null}
            </li>
          ))}
        </ul>
      </AdminCard>
      <AdminCard>
        <h2>
          Annulés par l&apos;entreprise, encore dans leurs 15 jours ({enAttenteDeReport.length})
        </h2>
        <ul className="flex flex-col gap-[var(--space-admin-4)]">
          {enAttenteDeReport.map((a) => (
            <li key={a.id}>
              <strong>{a.denomination}</strong> — la réservation cesse d&apos;être retenue après le{" "}
              {heureConsole(a.echeance)} sans report convenu.
              {administrateur ? <LierReport id={a.id} options={a.autresRendezVous} /> : null}
            </li>
          ))}
        </ul>
      </AdminCard>
    </div>
  );
}
