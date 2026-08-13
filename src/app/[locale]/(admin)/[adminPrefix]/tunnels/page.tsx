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
import {
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
  AdminEmptyState,
  type AdminTableColumn,
} from "@/components/admin/ui";
import { chargerTunnels, lireFenetre, FENETRES } from "@/features/admin-tunnels/query";
import type { StatsTunnel } from "@/features/admin-tunnels/aggregate";
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

  const colonnesTunnel: ReadonlyArray<AdminTableColumn<StatsTunnel>> = [
    { key: "cle", header: "Tunnel d'entrée", cell: (r) => r.libelle, width: "38%" },
    {
      key: "sessions",
      header: "Sessions",
      align: "right",
      cell: (r) => r.sessions.toLocaleString("fr-FR"),
    },
    {
      key: "ouverts",
      header: "Questionnaires",
      align: "right",
      cell: (r) => r.questionnairesOuverts.toLocaleString("fr-FR"),
      hiddenBelow: "sm",
    },
    {
      key: "termines",
      header: "Terminés",
      align: "right",
      cell: (r) => r.questionnairesTermines.toLocaleString("fr-FR"),
      hiddenBelow: "sm",
    },
    {
      key: "rapports",
      header: "Rapports",
      align: "right",
      cell: (r) => r.rapportsDemandes.toLocaleString("fr-FR"),
    },
    {
      key: "part",
      header: "Conversion",
      align: "right",
      // Sous 5 sessions, un pourcentage n'est que du bruit affiché avec
      // assurance. On préfère le dire.
      cell: (r) =>
        r.sessions < 5 ? <span className="admin-meta-small">trop peu</span> : `${r.partRapport} %`,
    },
  ];

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

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Par tunnel</h2>
        <p className="admin-lede">
          Chaque session est comptée dans le tunnel où elle a <strong>commencé</strong>. Un visiteur
          qui arrive par la page publicitaire puis enchaîne sur le questionnaire reste attribué à la
          page publicitaire : c&apos;est elle qui l&apos;a amené. La somme des lignes égale donc
          exactement le nombre de sessions.
        </p>
        {synthese.parTunnel.length === 0 ? (
          <AdminEmptyState
            title="Aucune session sur la période"
            description="Les tunnels apparaîtront dès la première visite mesurée."
          />
        ) : (
          <AdminTable
            columns={colonnesTunnel}
            rows={synthese.parTunnel}
            getRowId={(r) => r.cle}
            rowHref={(r) => `${base}/prospects?fenetre=${jours}&tunnel=${r.cle}`}
            caption="Sessions et conversions par tunnel d'entrée"
          />
        )}
      </section>

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
