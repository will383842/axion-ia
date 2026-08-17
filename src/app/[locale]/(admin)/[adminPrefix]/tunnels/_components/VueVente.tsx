// Corps visuel du tunnel de vente.
//
// ⚠️ Ne refait PAS l'entonnoir commercial : il existe déjà, complet, dans
// « Planning → Pipeline ». Deux chiffres concurrents pour la même réalité sont
// la façon la plus sûre de ne plus faire confiance ni à l'un ni à l'autre.
//
// Séparé de la page pour être affichable sans session, donc contrôlable à
// l'écran à n'importe quelle largeur.

import Link from "next/link";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
  AdminEmptyState,
  type AdminTableColumn,
} from "@/components/admin/ui";
import { FENETRES } from "@/features/admin-tunnels/query";
import type { LigneOrigine, SyntheseVente } from "@/features/admin-tunnels/vente";

const nb = (n: number): string => n.toLocaleString("fr-FR");

/** Montants en centimes jusqu'à l'affichage — convention du dépôt. */
const euros = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function VueVente({
  s,
  jours,
  adminPrefix,
}: {
  s: SyntheseVente;
  jours: number;
  adminPrefix: string;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/tunnels/vente`;

  const partClient =
    s.demandesAvecEmail > 0 ? Math.round((s.devenusClients / s.demandesAvecEmail) * 1000) / 10 : 0;

  const colonnes: ReadonlyArray<AdminTableColumn<LigneOrigine>> = [
    { key: "cle", header: "Origine de la demande", cell: (r) => r.cle, width: "45%" },
    { key: "demandes", header: "Demandes", align: "right", cell: (r) => nb(r.demandes) },
    { key: "clients", header: "Devenus clients", align: "right", cell: (r) => nb(r.clients) },
    {
      key: "part",
      header: "Taux",
      align: "right",
      // Sous 5 demandes, un taux n'est que du bruit affiché avec assurance.
      cell: (r) =>
        r.demandes < 5 ? <span className="admin-meta-small">trop peu</span> : `${r.partClient} %`,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Tunnel de vente"
        description="Ce que deviennent les demandes entrantes une fois passées au commerce."
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

      {/* 🔴 Sans cet avertissement, un rapprochement manqué se lirait comme une
          contre-performance commerciale. Le chiffre est un plancher. */}
      <p className="admin-alert admin-alert-info">
        <span>
          Le rapprochement demande → client se fait par adresse e-mail, faute de lien direct en
          base. Un prospect qui signe avec une autre adresse que celle laissée sur le site
          n&apos;est pas rattaché : les taux ci-dessous sont donc un <strong>plancher</strong>. Le
          détail commercial (devis, relances, impayés, âge des affaires) vit dans{" "}
          <Link href={`/fr/${adminPrefix}/planning/pipeline`} className="admin-link">
            Planning → Pipeline
          </Link>
          , qui reste la référence.
        </span>
      </p>

      {s.tronquee ? (
        <p className="admin-alert admin-alert-warning">
          <span>Lecture plafonnée : réduisez la période pour une jonction exacte.</span>
        </p>
      ) : null}

      <div className="admin-kpi-grid">
        <AdminStatCard
          label="Demandes reçues"
          value={nb(s.demandes)}
          meta={`${nb(s.demandesAvecEmail)} avec une adresse exploitable`}
        />
        <AdminStatCard
          label="Devenues clients"
          value={nb(s.devenusClients)}
          meta={`${partClient} % des demandes rapprochées`}
          tone={s.devenusClients > 0 ? "success" : "default"}
        />
        <AdminStatCard
          label="Devis sur la période"
          value={nb(s.devisEnvoyes)}
          meta={`${nb(s.devisAcceptes)} acceptés`}
          href={`/fr/${adminPrefix}/planning/pipeline`}
        />
        <AdminStatCard
          label="Encaissé"
          value={euros(s.caEncaisseCents)}
          meta={`${nb(s.facturesPayees)} facture${s.facturesPayees > 1 ? "s" : ""} réglée${
            s.facturesPayees > 1 ? "s" : ""
          }`}
          tone={s.caEncaisseCents > 0 ? "success" : "default"}
        />
      </div>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Quelle porte d&apos;entrée amène des clients</h2>
        <p className="admin-lede">
          Le volume ne dit rien de la qualité : une origine peut apporter dix fois plus de demandes
          et zéro signature. C&apos;est ce tableau qui arbitre où mettre l&apos;effort.
        </p>
        {s.parOrigine.length === 0 ? (
          <AdminEmptyState
            title="Aucune demande sur la période"
            description="Les demandes entrantes apparaîtront ici dès leur réception."
          />
        ) : (
          <AdminTable
            columns={colonnes}
            rows={s.parOrigine}
            getRowId={(r) => r.cle}
            caption="Demandes et conversions par origine"
          />
        )}
      </section>
    </>
  );
}
