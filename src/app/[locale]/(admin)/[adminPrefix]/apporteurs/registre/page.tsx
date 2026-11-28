// PR L (point 20) : les apporteurs dont l'entreprise n'est plus active au registre public.
// Lecture seule. Aucune action automatique : Williams décide (contrat, paiements).

import Link from "next/link";

import { AdminBadge, AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { jourParis } from "@/features/apporteurs-reseau/autofacture-donnees";
import { listerRegistreEnDefaut } from "@/features/apporteurs-reseau/controle-registre";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

const LIBELLE: Record<string, string> = {
  fermee: "Fermée au registre",
  introuvable: "Introuvable au registre",
};

export default async function RegistreApporteursPage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const lignes = await listerRegistreEnDefaut();
  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Contrôle du registre"
        description="Les apporteurs sous contrat dont l'entreprise n'est plus active au registre public. Aucune action automatique."
      />
      <AdminCard as="section">
        {lignes.length === 0 ? <p>Aucun apporteur en défaut.</p> : null}
        <ul className="flex flex-col gap-[var(--space-admin-3)]">
          {lignes.map((l) => (
            <li
              key={l.apporteurId}
              className="flex flex-wrap items-center gap-[var(--space-admin-3)]"
            >
              <Link href={`/fr/${adminPrefix}/apporteurs/${l.apporteurId}`} className="underline">
                Apporteur {l.apporteurId.slice(0, 8)}
              </Link>
              <AdminBadge>{LIBELLE[l.etat] ?? l.etat}</AdminBadge>
              <span>
                depuis le {jourParis(l.etatDepuis)} ({l.consecutifs} contrôle
                {l.consecutifs > 1 ? "s" : ""})
              </span>
              {l.alerteeAt ? <AdminBadge>Alerte envoyée</AdminBadge> : null}
            </li>
          ))}
        </ul>
      </AdminCard>
    </div>
  );
}
