// Corps visuel de la vue d'ensemble des tunnels.
//
// Séparé de la page pour une raison précise : la page fait `auth()` puis lit la
// base, ce qui la rend impossible à afficher sans session. Le corps, lui, ne
// dépend que de ses propriétés — donc vérifiable dans un vrai navigateur, à
// n'importe quelle largeur d'écran, sans identifiants. C'est ce qui a permis de
// contrôler le rendu mobile sans jamais se connecter.

import Link from "next/link";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/ui";
import { FENETRES } from "@/features/admin-tunnels/query";
import type { StatsTunnel, SyntheseTunnels } from "@/features/admin-tunnels/aggregate";
import { EntonnoirVue } from "./EntonnoirVue";

export function VueEnsemble({
  synthese,
  jours,
  lignes,
  tronquee,
  adminPrefix,
}: {
  synthese: SyntheseTunnels;
  jours: number;
  lignes: number;
  tronquee: boolean;
  adminPrefix: string;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/tunnels`;
  const partRapport =
    synthese.questionnairesOuverts > 0
      ? Math.round((synthese.rapportsDemandes / synthese.questionnairesOuverts) * 1000) / 10
      : 0;

  const colonnesTunnel: ReadonlyArray<AdminTableColumn<StatsTunnel>> = [
    {
      key: "cle",
      header: "Tunnel d'entrée",
      // 🔴 Lien EXPLICITE en cellule, et non plus `rowHref` (lien étiré sur la
      // ligne entière). La ligne porte désormais une seconde action — ouvrir la
      // page publique — et le contrat de `AdminTable` est clair : le lien étiré
      // recouvre la ligne, donc il interdit tout autre élément cliquable.
      cell: (r) => (
        <Link href={`${base}/prospects?fenetre=${jours}&tunnel=${r.cle}`} className="admin-link">
          {r.libelle}
        </Link>
      ),
      width: "38%",
    },
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
      // Masquée sous 640 px : à quatre colonnes, la conversion — la seule qui
      // sert à décider — se retrouvait coupée au bord droit. Le cadre défile,
      // donc rien n'était perdu, mais un tableau tronqué se lit comme un
      // tableau cassé. Le nombre reste lisible sur écran large et dans le
      // tunnel de prospects.
      hiddenBelow: "sm",
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
          <span>
            Lecture plafonnée à {lignes.toLocaleString("fr-FR")} balises : les taux ci-dessous
            sous-estiment la conversion. Réduisez la période pour une lecture exacte.
          </span>
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
        {/* 🔴 Les trois pages sont TOUJOURS listées, à zéro s'il le faut. Le
            tableau ne montrait auparavant que les tunnels ayant au moins une
            session : sans trafic mesuré il restait vide, et un écran vide se lit
            « cette page n'est pas suivie » — au lieu de « personne n'est encore
            venu ». Le lien de droite ouvre la page publique, pour vérifier d'un
            clic ce que voit un visiteur. */}
        <AdminTable
          columns={colonnesTunnel}
          rows={synthese.parTunnel}
          getRowId={(r) => r.cle}
          rowAction={(r) =>
            r.chemin ? (
              <a
                href={r.chemin}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-link admin-meta-small"
              >
                Voir la page ↗
              </a>
            ) : null
          }
          caption="Sessions et conversions par tunnel d'entrée"
        />
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
