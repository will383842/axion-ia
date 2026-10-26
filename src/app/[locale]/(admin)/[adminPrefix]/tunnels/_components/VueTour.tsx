// Corps visuel du tunnel Tour de France IA (2026-10-26).
//
// Séparé de la page, comme les autres vues de tunnel : il ne dépend que de ses
// propriétés, donc s'affiche — et se vérifie — sans session.
//
// 🔴 « Non mesuré » n'est jamais écrit « 0 » : la landing ne porte aucune
// mesure (choix écrit dans la politique de confidentialité), et une lecture en
// échec n'est pas une absence de visiteurs.

import Link from "next/link";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/ui";
import { FENETRES } from "@/features/admin-tunnels/query";
import type {
  Cellule,
  LigneBoutonTour,
  TableauTour,
} from "@/features/admin-tunnels/tour-entonnoir";

function nombre(c: Cellule): string {
  return c === null ? "non mesuré" : c.toLocaleString("fr-FR");
}

export function VueTour({
  tableau,
  jours,
  tronquee,
  adminPrefix,
}: {
  tableau: TableauTour;
  jours: number;
  tronquee: boolean;
  adminPrefix: string;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/tunnels/tour`;
  const rdvTour = `/fr/${adminPrefix}/rendez-vous?type=tour_de_france_ia`;
  const appelsTour = `/fr/${adminPrefix}/contacts/appels?type=tour_de_france_ia`;
  const { rdv } = tableau;

  const colonnes: ReadonlyArray<AdminTableColumn<LigneBoutonTour>> = [
    { key: "bouton", header: "Bouton de la landing", cell: (l) => l.libelle, width: "46%" },
    {
      key: "arrivees",
      header: "Clics « Participer »",
      align: "right",
      cell: (l) => nombre(l.arrivees),
    },
    { key: "pris", header: "Rendez-vous pris", align: "right", cell: (l) => nombre(l.pris) },
    {
      key: "maintenus",
      header: "Maintenus",
      align: "right",
      cell: (l) => nombre(l.maintenus),
      hiddenBelow: "sm",
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Tunnel Tour de France IA"
        description="De la landing /tourdefrance-ia à la visio de 30 minutes tenue."
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

      {tronquee ? (
        <p className="admin-alert admin-alert-warning">
          <span>
            Lecture plafonnée : les clics ci-dessous sont un plancher. Réduisez la période pour une
            lecture exacte.
          </span>
        </p>
      ) : null}

      <div className="admin-kpi-grid">
        <AdminStatCard
          label="Visites de la landing"
          value="non mesuré"
          meta="Par choix : la page ne porte aucune mesure d'audience (politique de confidentialité)"
        />
        <AdminStatCard
          label="Clics « Participer »"
          value={nombre(tableau.arrivees)}
          meta="Arrivées sur la page de rendez-vous du Tour, une par visite"
        />
        <AdminStatCard
          label="Rendez-vous pris"
          value={rdv === null ? "non mesuré" : rdv.pris.toLocaleString("fr-FR")}
          meta={
            tableau.transformation === null
              ? "Visio de 30 minutes, type « Tour de France IA »"
              : `${tableau.transformation} % des clics « Participer »`
          }
          tone={rdv && rdv.pris > 0 ? "success" : "default"}
          href={appelsTour}
        />
        <AdminStatCard
          label="Maintenus"
          value={rdv === null ? "non mesuré" : rdv.maintenus.toLocaleString("fr-FR")}
          meta={
            rdv === null
              ? "Lecture des rendez-vous indisponible"
              : `${rdv.honores.toLocaleString("fr-FR")} honoré${rdv.honores > 1 ? "s" : ""} · ${rdv.absents.toLocaleString("fr-FR")} absent${rdv.absents > 1 ? "s" : ""} · ${rdv.annules.toLocaleString("fr-FR")} annulé${rdv.annules > 1 ? "s" : ""}`
          }
          href={rdvTour}
        />
      </div>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Par bouton</h2>
        <p className="admin-lede">
          Chaque bouton de la landing porte son repère (<code>depuis=tdf-…</code>). Il est compté à
          l&apos;arrivée sur la page de rendez-vous, puis retrouvé sur la réservation (
          <code>utm_content</code> <code>tour:tdf-…</code>). Les clics ne sont mesurés que depuis la
          mise en ligne de cette mesure : sur une période qui la précède, les rendez-vous peuvent
          dépasser les clics.
        </p>
        <AdminTable
          columns={colonnes}
          rows={tableau.parBouton}
          getRowId={(l) => l.cle ?? "non-renseigne"}
          caption="Clics et rendez-vous du Tour de France IA, par bouton"
          emptyState={<p className="admin-meta">Aucun clic ni rendez-vous sur la période.</p>}
        />
      </section>

      <p className="admin-meta mt-[var(--space-admin-6)]">
        Les rendez-vous se comptent comme dans « Ce que rapporte chaque rendez-vous » : un
        rendez-vous déplacé ne compte qu&apos;une fois, une annulation reste une annulation, un
        rendez-vous passé sans point fait reste « maintenu ». Les personnes, elles, sont dans{" "}
        <Link href={rdvTour} className="admin-link">
          Rendez-vous → Tour de France IA
        </Link>{" "}
        et dans{" "}
        <Link href={appelsTour} className="admin-link">
          Appels réservés
        </Link>
        .
      </p>
    </>
  );
}
