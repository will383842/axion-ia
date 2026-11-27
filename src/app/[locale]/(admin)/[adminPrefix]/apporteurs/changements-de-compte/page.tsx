// Lot 6 : les demandes de changement de compte bancaire des apporteurs (liste).
// Lecture : tous les rôles admin. Décision : super_admin seul (page de détail). Aucun IBAN entier.

import Link from "next/link";

import { AdminBadge, AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { jourParis } from "@/features/apporteurs-reseau/autofacture-donnees";
import {
  etatConsole,
  listerDemandesConsole,
} from "@/features/apporteurs-reseau/requetes-changements-iban";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

const LIBELLE: Record<string, string> = {
  a_confirmer: "À confirmer par l'apporteur",
  confirmee: "Confirmée",
  validee: "Validée",
  refusee: "Refusée",
  opposee: "Contestée par l'apporteur",
  annulee: "Annulée",
  expiree: "Expirée",
};

export default async function ChangementsDeComptePage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const etat = etatConsole();
  const lignes = await listerDemandesConsole();
  const base = `/fr/${adminPrefix}/apporteurs/changements-de-compte`;
  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Changements de compte bancaire"
        description="Les demandes des apporteurs. Seul le super administrateur décide."
      />
      {etat.secretAbsent ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          Le secret d&apos;empreinte n&apos;est pas posé sur l&apos;application : aucune demande ne
          peut s&apos;enregistrer ni se valider.
        </p>
      ) : null}
      {!etat.interrupteurAllume ? (
        <p>
          Le service est éteint : les demandes déjà reçues restent visibles, aucune ne se valide.
        </p>
      ) : null}
      <AdminCard as="section">
        {lignes.length === 0 ? <p>Aucune demande.</p> : null}
        <ul className="flex flex-col gap-[var(--space-admin-3)]">
          {lignes.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
              <Link href={`${base}/${d.id}`} className="underline">
                Demande du {jourParis(d.demandeeAt)}
              </Link>
              <span>compte se terminant par {d.fin4}</span>
              <AdminBadge>{LIBELLE[d.statut] ?? d.statut}</AdminBadge>
              {d.decidable ? <AdminBadge>À décider</AdminBadge> : null}
            </li>
          ))}
        </ul>
      </AdminCard>
    </div>
  );
}
