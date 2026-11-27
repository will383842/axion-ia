// Lot 9 : ouvrir une demande de changement de compte AU NOM d'un apporteur retiré ou résilié avec de
// l'argent dû. Une personne saisit l'IBAN ; il n'est jamais rendu. Mêmes barrières que la demande de l'espace.

import { redirect } from "next/navigation";

import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { ouvrirDemandeConsoleAction } from "@/features/apporteurs-reseau/actions-changement-iban";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NouvelleDemandePage({
  params,
  searchParams,
}: {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { adminPrefix } = await params;
  const acces = await gardePage("ecriture", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const sp = await searchParams;
  const apporteurId = sp.apporteur && UUID.test(sp.apporteur) ? sp.apporteur.toLowerCase() : "";
  const base = `/fr/${adminPrefix}/apporteurs/changements-de-compte`;

  async function ouvrir(fd: FormData) {
    "use server";
    const r = await ouvrirDemandeConsoleAction(fd);
    if (r.ok) redirect(base);
    redirect(`${base}/nouvelle?apporteur=${apporteurId}&erreur=${encodeURIComponent(r.message)}`);
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Ouvrir une demande de changement de compte"
        description="Pour un apporteur retiré du réseau ou résilié à qui il reste de l'argent dû. L'apporteur reçoit l'e-mail de confirmation à l'adresse de sa fiche ; le super administrateur décide ensuite."
      />
      {sp.erreur ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {sp.erreur.slice(0, 200)}
        </p>
      ) : null}
      <AdminCard as="section">
        {apporteurId ? (
          <form action={ouvrir} className="flex flex-col gap-[var(--space-admin-3)]">
            <input type="hidden" name="apporteurId" value={apporteurId} />
            <label>
              Nouvel IBAN (saisi par vous)
              <input
                name="iban"
                autoComplete="off"
                maxLength={60}
                required
                className="admin-input"
              />
            </label>
            <label>
              RIB du nouveau compte (PDF, PNG ou JPG, 10 Mo au plus)
              <input
                name="rib"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                required
              />
            </label>
            <button type="submit" className="admin-button">
              Ouvrir la demande
            </button>
          </form>
        ) : (
          <p>Ouvrez cette page depuis la fiche de l&apos;apporteur.</p>
        )}
      </AdminCard>
    </div>
  );
}
