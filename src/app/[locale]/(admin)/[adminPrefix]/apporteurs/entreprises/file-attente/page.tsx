// Contrat 2.8, art. 3.5 — « File d'attente » : les déclarations conservées en attente, par entreprise.
// Lecture seule. Deux rangs au plus, triés par date d'horodatage de la déclaration.

import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { lireFilesAttente } from "@/features/apporteurs-reseau/file-attente-console";
import { heureConsole } from "@/features/apporteurs-reseau/statut-rendez-vous";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function FileAttentePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const files = await lireFilesAttente();
  return (
    <div className="flex flex-col gap-[var(--space-admin-4)]">
      <AdminPageHeader
        title="File d'attente (article 3.5)"
        description="Les déclarations conservées en attente, deux au plus par entreprise. Seul le premier rang reçoit un e-mail, puis dispose de quinze jours."
      />
      {files.length === 0 ? (
        <AdminCard>
          <p>Aucune déclaration en attente.</p>
        </AdminCard>
      ) : null}
      {files.map((f) => (
        <AdminCard key={f.cleFile}>
          <h2>
            {f.denomination} <small>({f.cleFile})</small>
          </h2>
          <ul className="flex flex-col gap-[var(--space-admin-2)]">
            {f.rangs.map((r) => (
              <li key={r.presentationId}>
                Rang {r.rang} — {r.apporteur}, déclarée le {heureConsole(r.recueAt)} —{" "}
                {r.statut === "informee"
                  ? `informée le ${r.informeeAt ? heureConsole(r.informeeAt) : "—"}, délai jusqu'au ${
                      r.fenetreFinAt ? heureConsole(r.fenetreFinAt) : "—"
                    }`
                  : "en attente"}
              </li>
            ))}
          </ul>
        </AdminCard>
      ))}
    </div>
  );
}
