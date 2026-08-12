// Tunnels — vue d'ensemble.
//
// Répond à une seule question : combien de personnes entrent, combien
// ressortent en prospect, et où part le reste.
//
// FR uniquement (CLAUDE.md §14 admin FR). `force-dynamic` : la donnée est du
// temps réel, une page mise en cache y serait trompeuse.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AdminPageHeader, AdminStatCard } from "@/components/admin/ui";
import { chargerTunnels, lireFenetre, FENETRES } from "@/features/admin-tunnels/query";
import { EntonnoirVue } from "./_components/EntonnoirVue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tunnels",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function TunnelsPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const jours = lireFenetre((await searchParams).fenetre);
  const { synthese, lignes, tronquee } = await chargerTunnels(jours);
  const base = `/fr/${adminPrefix}/tunnels`;

  const partRapport =
    synthese.questionnairesOuverts > 0
      ? Math.round((synthese.rapportsDemandes / synthese.questionnairesOuverts) * 1000) / 10
      : 0;

  return (
    <>
      <AdminPageHeader
        title="Tunnels"
        description="Ce que devient un visiteur, de la publicité au prospect qualifié."
        actions={
          <nav aria-label="Période" className="flex gap-[var(--space-admin-2)]">
            {FENETRES.map((f) => (
              <Link
                key={f.jours}
                href={`${base}?fenetre=${f.jours}`}
                className={
                  f.jours === jours ? "admin-button admin-button-sm" : "admin-button-ghost"
                }
                aria-current={f.jours === jours ? "page" : undefined}
              >
                {f.libelle}
              </Link>
            ))}
          </nav>
        }
      />

      {/* 🔴 Une troncature silencieuse ferait chuter tous les taux : les
          sessions coupées perdent leurs événements de fin. On le dit. */}
      {tronquee ? (
        <p className="admin-alert admin-alert-warning">
          Lecture plafonnée à {lignes.toLocaleString("fr-FR")} balises : les taux ci-dessous
          sous-estiment la conversion. Réduisez la période pour une lecture exacte.
        </p>
      ) : null}

      <div className="admin-kpi-grid">
        <AdminStatCard
          label="Sessions"
          value={synthese.sessions.toLocaleString("fr-FR")}
          meta={`dont ${synthese.sessionsPub.toLocaleString("fr-FR")} depuis la page publicitaire`}
        />
        <AdminStatCard
          label="Questionnaires ouverts"
          value={synthese.questionnairesOuverts.toLocaleString("fr-FR")}
          meta={`${synthese.questionnairesTermines.toLocaleString("fr-FR")} terminés`}
        />
        <AdminStatCard
          label="Rapports demandés"
          value={synthese.rapportsDemandes.toLocaleString("fr-FR")}
          meta={`${partRapport} % des questionnaires ouverts`}
          tone={synthese.rapportsDemandes > 0 ? "success" : "default"}
        />
        <AdminStatCard
          label="Rappels demandés"
          value={synthese.rappelsDemandes.toLocaleString("fr-FR")}
          meta="Le lead le plus chaud : numéro laissé sans y être contraint"
          tone={synthese.rappelsDemandes > 0 ? "success" : "default"}
          href={`${base}/prospects?fenetre=${jours}`}
        />
      </div>

      <div className="mt-[var(--space-admin-6)] grid gap-[var(--space-admin-4)] lg:grid-cols-2">
        {synthese.entonnoirs.map((e) => (
          <EntonnoirVue key={e.titre} entonnoir={e} />
        ))}
      </div>

      <p className="admin-meta mt-[var(--space-admin-6)]">
        Chiffres issus des balises de tunnel : anonymes, sans adresse IP, purgés au bout de 12 mois.
        Ils servent à comparer des pages et des campagnes, jamais à identifier quelqu&apos;un. Les
        prospects nominatifs, eux, sont dans la{" "}
        <Link href={`/fr/${adminPrefix}/submissions`} className="admin-link">
          boîte de réception
        </Link>
        .
      </p>
    </>
  );
}
