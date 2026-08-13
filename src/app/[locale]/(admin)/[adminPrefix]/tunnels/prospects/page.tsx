// Tunnel de prospects — le détail actionnable.
//
// La vue d'ensemble dit COMBIEN on perd. Cette page dit OÙ et POUR QUI :
// l'écran exact qui fait décrocher, la campagne qui amène du monde sans
// convertir, l'appareil sur lequel le parcours casse.
//
// FR uniquement (CLAUDE.md §14 admin FR).

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
import { chargerTunnels, lireFenetre, lireTunnel, FENETRES } from "@/features/admin-tunnels/query";
import { FUNNEL_KEYS } from "@/lib/schemas/funnel-event-schema";
import type { AbandonEcran, LigneRepartition } from "@/features/admin-tunnels/aggregate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tunnel de prospects",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Au-delà, l'écran est signalé : plus d'un visiteur sur deux s'y arrête. */
const SEUIL_ABANDON = 50;

/** En deçà, une répartition n'est pas lisible — la variabilité domine. */
const MINIMUM_LISIBLE = 5;

const nb = (n: number): string => n.toLocaleString("fr-FR");

export default async function TunnelProspectsPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const params_ = await searchParams;
  const jours = lireFenetre(params_.fenetre);
  const tunnel = lireTunnel(params_.tunnel);
  const { synthese } = await chargerTunnels(jours, tunnel);
  const base = `/fr/${adminPrefix}/tunnels/prospects`;
  /** Conserve les deux filtres d'un lien à l'autre. */
  const lien = (f: number, t: string | null): string =>
    `${base}?fenetre=${f}${t ? `&tunnel=${t}` : ""}`;

  const LIBELLES: Readonly<Record<string, string>> = {
    diagnostic: "Page publicitaire",
    simulateur: "Questionnaire nu",
    roi: "Questionnaire public",
  };

  // L'écran le plus coûteux : celui qui perd le plus de sessions en valeur
  // ABSOLUE. Trier par pourcentage désignerait un écran vu par trois
  // personnes — vrai, mais sans effet sur le chiffre.
  const pireEcran = [...synthese.abandonParEcran].sort(
    (a, b) => b.atteintes - b.poursuivies - (a.atteintes - a.poursuivies),
  )[0];

  const colonnesAbandon: ReadonlyArray<AdminTableColumn<AbandonEcran>> = [
    { key: "rang", header: "Écran", cell: (r) => `${r.stepIndex}. ${r.step}`, width: "40%" },
    { key: "atteintes", header: "Sessions", align: "right", cell: (r) => nb(r.atteintes) },
    {
      key: "poursuivies",
      header: "Poursuivent",
      align: "right",
      cell: (r) => nb(r.poursuivies),
      hiddenBelow: "sm",
    },
    {
      key: "abandon",
      header: "Abandon",
      align: "right",
      cell: (r) => (
        <span className={r.partAbandon >= SEUIL_ABANDON ? "admin-severity-warning" : undefined}>
          {r.partAbandon}&nbsp;%
        </span>
      ),
    },
  ];

  const colonnesRepartition = (
    entete: string,
  ): ReadonlyArray<AdminTableColumn<LigneRepartition>> => [
    { key: "cle", header: entete, cell: (r) => r.cle, width: "40%" },
    { key: "sessions", header: "Sessions", align: "right", cell: (r) => nb(r.sessions) },
    {
      key: "termines",
      header: "Terminés",
      align: "right",
      cell: (r) => nb(r.termines),
      hiddenBelow: "sm",
    },
    { key: "rapports", header: "Rapports", align: "right", cell: (r) => nb(r.rapports) },
    {
      key: "part",
      header: "Conversion",
      align: "right",
      // Un taux calculé sur trois sessions n'est pas un taux. On l'écrit
      // plutôt que d'afficher « 33 % » et de laisser croire à une tendance.
      cell: (r) =>
        r.sessions < MINIMUM_LISIBLE ? (
          <span className="admin-meta-small">trop peu</span>
        ) : (
          `${r.partRapport} %`
        ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Tunnel de prospects"
        description="De la publicité au rapport envoyé : où les visiteurs décrochent, et lesquels."
        actions={
          <nav aria-label="Période" className="flex gap-[var(--space-admin-2)]">
            {FENETRES.map((f) => (
              <Link
                key={f.jours}
                href={lien(f.jours, tunnel)}
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

      <nav aria-label="Tunnel" className="admin-filter-tabs mb-[var(--space-admin-4)]">
        <Link
          href={lien(jours, null)}
          className={tunnel === null ? "admin-button admin-button-sm" : "admin-button-ghost"}
          aria-current={tunnel === null ? "page" : undefined}
        >
          Tous les tunnels
        </Link>
        {FUNNEL_KEYS.map((k) => (
          <Link
            key={k}
            href={lien(jours, k)}
            className={tunnel === k ? "admin-button admin-button-sm" : "admin-button-ghost"}
            aria-current={tunnel === k ? "page" : undefined}
          >
            {LIBELLES[k] ?? k}
          </Link>
        ))}
      </nav>

      {/* ⚠️ Le filtre porte sur les balises, pas sur les sessions : isoler le
          questionnaire coupe la partie « page publicitaire » d'un parcours
          mixte. Sans cet avertissement, on lirait une chute d'entrée là où il
          n'y a qu'un périmètre restreint. */}
      {tunnel !== null ? (
        <p className="admin-alert admin-alert-info">
          Vue restreinte à <strong>{LIBELLES[tunnel] ?? tunnel}</strong> : seules les balises émises
          sur cette page sont comptées. Un visiteur venu de la page publicitaire y apparaît sans son
          étape d&apos;arrivée.
        </p>
      ) : null}

      <div className="admin-kpi-grid">
        <AdminStatCard
          label="Questionnaires ouverts"
          value={nb(synthese.questionnairesOuverts)}
          meta={`${nb(synthese.questionnairesTermines)} menés au bout`}
        />
        <AdminStatCard
          label="Rapports demandés"
          value={nb(synthese.rapportsDemandes)}
          meta="Prospects avec coordonnées"
          tone={synthese.rapportsDemandes > 0 ? "success" : "default"}
        />
        <AdminStatCard
          label="Rappels demandés"
          value={nb(synthese.rappelsDemandes)}
          meta="Numéro laissé après le rapport, sans contrainte"
          tone={synthese.rappelsDemandes > 0 ? "success" : "default"}
        />
        <AdminStatCard
          label="Écran le plus coûteux"
          value={pireEcran ? `${pireEcran.stepIndex}. ${pireEcran.step}` : "—"}
          meta={
            pireEcran
              ? `${nb(pireEcran.atteintes - pireEcran.poursuivies)} sessions perdues ici`
              : "Pas encore de donnée"
          }
          tone={pireEcran && pireEcran.partAbandon >= SEUIL_ABANDON ? "warning" : "default"}
        />
      </div>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Abandon écran par écran</h2>
        <p className="admin-lede">
          La lecture la plus actionnable : elle désigne la question qui fait partir les gens. Une
          session « poursuit » si elle répond à un écran suivant ou termine le questionnaire.
        </p>
        {synthese.abandonParEcran.length === 0 ? (
          <AdminEmptyState
            title="Aucun écran mesuré"
            description="Les balises apparaîtront dès qu'un visiteur aura répondu à une question."
          />
        ) : (
          <AdminTable
            columns={colonnesAbandon}
            rows={synthese.abandonParEcran}
            getRowId={(r) => String(r.stepIndex)}
            caption="Abandon par écran du questionnaire"
          />
        )}
      </section>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Par campagne</h2>
        <p className="admin-lede">
          L&apos;attribution est relue côté serveur depuis le cookie déposé à l&apos;arrivée : elle
          survit à la navigation interne et ne peut pas être falsifiée par le navigateur.
        </p>
        {synthese.parCampagne.length === 0 ? (
          <AdminEmptyState title="Aucune campagne mesurée" />
        ) : (
          <AdminTable
            columns={colonnesRepartition("Campagne")}
            rows={synthese.parCampagne}
            getRowId={(r) => r.cle}
            caption="Sessions et conversions par campagne"
          />
        )}
      </section>

      <div className="mt-[var(--space-admin-6)] grid gap-[var(--space-admin-4)] lg:grid-cols-2">
        <section>
          <h2 className="admin-h2">Par appareil</h2>
          <p className="admin-lede">
            Un écart marqué entre mobile et ordinateur désigne un défaut de rendu, pas un défaut
            d&apos;offre.
          </p>
          {synthese.parAppareil.length === 0 ? (
            <AdminEmptyState title="Aucune donnée" />
          ) : (
            <AdminTable
              columns={colonnesRepartition("Appareil")}
              rows={synthese.parAppareil}
              getRowId={(r) => r.cle}
              caption="Sessions et conversions par appareil"
            />
          )}
        </section>

        <section>
          <h2 className="admin-h2">Par secteur déclaré</h2>
          <p className="admin-lede">
            Renseigné dès le premier écran : disponible même pour les visiteurs qui abandonnent
            ensuite.
          </p>
          {synthese.parSecteur.length === 0 ? (
            <AdminEmptyState title="Aucun secteur déclaré" />
          ) : (
            <AdminTable
              columns={colonnesRepartition("Secteur")}
              rows={synthese.parSecteur}
              getRowId={(r) => r.cle}
              caption="Sessions et conversions par secteur"
            />
          )}
        </section>
      </div>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Gains estimés des rapports demandés</h2>
        <p className="admin-lede">
          Des tranches, jamais des montants : un montant exact croisé au secteur et à
          l&apos;effectif réidentifierait une entreprise. Les montants nominatifs sont dans la{" "}
          <Link href={`/fr/${adminPrefix}/submissions`} className="admin-link">
            boîte de réception
          </Link>
          , exportables en CSV pour un CRM.
        </p>
        {synthese.parTranche.length === 0 ? (
          <AdminEmptyState title="Aucun rapport demandé sur la période" />
        ) : (
          <ul className="admin-meta flex flex-wrap gap-[var(--space-admin-3)]">
            {synthese.parTranche.map((t) => (
              <li key={t.cle} className="admin-badge">
                {t.cle} : {nb(t.rapports)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
