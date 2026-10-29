// Corps visuel de la fiche d'une ville du Tour France IA (2026-10-29).
//
// Pour une ville : les mini-demandes ET, pour chaque personne, la visio rapprochée et les réponses
// de l'étape 2 (lues dans le rendez-vous, jamais copiées). Page SERVEUR, aucun composant client.
//
// LECTURE SEULE : AUCUN bouton de geste, AUCUN bouton de suppression. Une personne effacée à sa
// demande s'affiche « — » et n'a aucune réponse.

import Link from "next/link";
import {
  AdminBadge,
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/ui";
import {
  LIBELLE_CRM,
  libelleResultatCrm,
  type EtatCrm,
  type FicheVille,
  type PersonneVille,
  type StatutVisio,
  type VisioTour,
} from "@/features/tour-de-france/fiche-ville";
import { LIBELLE_STATUT_AFFICHE, type StatutAffiche } from "@/features/tour-de-france/types";
import { JaugeVille } from "./VueVillesTour";

const TON_STATUT: Readonly<
  Record<StatutAffiche, "neutral" | "info" | "success" | "warning" | "outline">
> = {
  rdv_pris: "success",
  relancee_main: "info",
  recue: "warning",
  ecartee: "outline",
  effacee_rgpd: "outline",
};

const TON_CRM: Readonly<
  Record<EtatCrm["statut"], "neutral" | "info" | "success" | "warning" | "destructive" | "outline">
> = {
  sent: "success",
  pending: "info",
  failed: "warning",
  gave_up: "destructive",
  absente: "outline",
  indisponible: "outline",
};

const LIBELLE_VISIO: Readonly<Record<StatutVisio, string>> = {
  prevue: "Prévue",
  passee: "Passée",
  annulee: "Annulée",
};

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export interface PropsVueVilleTour {
  readonly adminPrefix: string;
  /** `null` : la ville de l'adresse n'est pas valide (aucune lecture n'a eu lieu). */
  readonly fiche: FicheVille | null;
}

function Reponses({ visio }: { visio: VisioTour }): React.ReactElement {
  if (visio.efface) return <span>—</span>;
  const p = visio.profil;
  if (p === null) return <span className="admin-meta">Aucune réponse</span>;
  const lignes: ReadonlyArray<readonly [string, string | null]> = [
    ["Secteur", p.secteur],
    ["Entreprise", p.entreprise],
    ["Taille", p.taille],
    ["Tâches", p.taches],
    ["Usage de l'IA", p.usageIa],
    ["Origine", p.origine],
  ];
  return (
    <details>
      <summary className="admin-link">Réponses de l&apos;étape 2</summary>
      <dl>
        {lignes.map(([titre, valeur]) => (
          <div key={titre}>
            <dt className="admin-meta">{titre}</dt>
            <dd>{valeur ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function BadgeCrm({ titre, etat }: { titre: string; etat: EtatCrm }): React.ReactElement {
  const resultat = libelleResultatCrm(etat.crmResult);
  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <span className="admin-meta">{titre}</span>
      <AdminBadge tone={TON_CRM[etat.statut]}>{LIBELLE_CRM[etat.statut]}</AdminBadge>
      {resultat !== null ? <span className="admin-meta">{resultat}</span> : null}
    </div>
  );
}

function CelluleVisio({
  visio,
  adminPrefix,
}: {
  visio: VisioTour | null;
  adminPrefix: string;
}): React.ReactElement {
  if (visio === null) return <span className="admin-meta">Pas encore</span>;
  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <span>
        {LIBELLE_VISIO[visio.statut]}
        {visio.debut !== null ? ` · ${FORMAT_DATE.format(visio.debut)}` : ""}
      </span>
      <Link href={`/fr/${adminPrefix}/contacts/appels/${visio.id}`} className="admin-link">
        Rendez-vous
      </Link>
    </div>
  );
}

export function VueVilleTour({ adminPrefix, fiche }: PropsVueVilleTour): React.ReactElement {
  const retourLien = (
    <Link href={`/fr/${adminPrefix}/tunnels/tour/villes`} className="admin-button-ghost">
      Toutes les villes
    </Link>
  );

  if (fiche === null) {
    return (
      <>
        <AdminPageHeader title="Ville inconnue" actions={retourLien} />
        <p className="admin-meta">Cette ville n&apos;existe pas dans l&apos;adresse demandée.</p>
      </>
    );
  }

  const efface = (p: PersonneVille): boolean => p.demande.statut === "effacee_rgpd";

  const colonnes: ReadonlyArray<AdminTableColumn<PersonneVille>> = [
    {
      key: "personne",
      header: "Personne",
      width: "24%",
      cell: (p) => (
        <div className="flex flex-col">
          <strong>{p.demande.nom}</strong>
          <span className="admin-meta">{p.demande.email}</span>
        </div>
      ),
    },
    {
      key: "demande",
      header: "Mini-demande",
      cell: (p) => (
        <div className="flex flex-col gap-[var(--space-admin-1)]">
          <span>Reçue le {FORMAT_DATE.format(p.demande.creeLe)}</span>
          <AdminBadge tone={TON_STATUT[p.demande.statut]}>
            {LIBELLE_STATUT_AFFICHE[p.demande.statut]}
          </AdminBadge>
          <span className="admin-meta">{p.compte ? "Compte" : "Ne compte pas"}</span>
        </div>
      ),
    },
    {
      key: "visio",
      header: "Visio",
      cell: (p) =>
        efface(p) ? (
          <span>—</span>
        ) : fiche.visiosIndisponibles ? (
          <span className="admin-meta">Lecture indisponible</span>
        ) : (
          <CelluleVisio visio={p.visio} adminPrefix={adminPrefix} />
        ),
    },
    {
      key: "crm",
      header: "CRM Pro",
      cell: (p) =>
        efface(p) ? (
          <span>—</span>
        ) : (
          <div className="flex flex-col gap-[var(--space-admin-2)]">
            <BadgeCrm titre="Demande" etat={p.crmDemande} />
            {p.crmVisio !== null && !fiche.visiosIndisponibles ? (
              <BadgeCrm titre="Visio" etat={p.crmVisio} />
            ) : null}
            <Link href={`/fr/${adminPrefix}/synchro-crm`} className="admin-link">
              Synchro CRM
            </Link>
          </div>
        ),
    },
    {
      key: "reponses",
      header: "Réponses",
      cell: (p) => (efface(p) || p.visio === null ? <span>—</span> : <Reponses visio={p.visio} />),
    },
    {
      key: "fiche",
      header: "Fiche prospect",
      hiddenBelow: "md",
      cell: (p) =>
        p.demande.clientId !== null ? (
          <Link
            href={`/fr/${adminPrefix}/qualiopi/clients/${p.demande.clientId}`}
            className="admin-link"
          >
            Fiche prospect
          </Link>
        ) : (
          <span className="admin-meta">Pas de fiche</span>
        ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title={`Tour France IA : ${fiche.ville}`}
        description="Les personnes de cette ville, leur mini-demande et, quand elles ont pris la visio, leurs réponses. Lecture seule."
        actions={
          <div className="flex gap-[var(--space-admin-2)]">
            {retourLien}
            <Link
              href={`/fr/${adminPrefix}/tunnels/tour/demandes?ville=${encodeURIComponent(fiche.villeCle)}`}
              className="admin-button-ghost"
            >
              Gestes sur les demandes
            </Link>
          </div>
        }
      />

      {fiche.tronquee ? (
        <p className="admin-alert admin-alert-warning">
          <span>Beaucoup de lignes : seules les plus récentes sont lues.</span>
        </p>
      ) : null}
      {fiche.visiosIndisponibles ? (
        <p className="admin-alert admin-alert-warning">
          <span>
            La lecture des visios est indisponible : les visios et leurs réponses ne sont pas
            affichées pour le moment.
          </span>
        </p>
      ) : null}

      <div className="admin-kpi-grid">
        <AdminStatCard label="Demandes reçues" value={fiche.recues.toLocaleString("fr-FR")} />
        <AdminStatCard
          label={`Comptées (sur ${fiche.seuil})`}
          value={`${fiche.comptees} sur ${fiche.seuil}`}
          tone={fiche.ouverte ? "success" : "default"}
        />
        <AdminStatCard
          label="Visios prises"
          value={fiche.visiosIndisponibles ? "non lu" : fiche.visiosPrises.toLocaleString("fr-FR")}
          meta="Les visios annulées ne comptent pas"
        />
        <AdminStatCard
          label="Ville ouverte"
          value={fiche.ouverte ? "oui" : "pas encore"}
          tone={fiche.ouverte ? "success" : "default"}
        />
      </div>
      <JaugeVille n={fiche.comptees} />

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Personnes</h2>
        <AdminTable
          columns={colonnes}
          rows={fiche.personnes}
          getRowId={(p) => p.demande.id}
          caption={`Personnes de ${fiche.ville}`}
          emptyState={<p className="admin-meta">Aucune demande pour cette ville.</p>}
        />
      </section>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Visios sans mini-demande</h2>
        <p className="admin-lede">
          Des visios dont la ville déclarée est celle-ci, sans mini-demande à la même adresse
          e-mail.
        </p>
        {fiche.visiosSansDemande.length === 0 ? (
          <p className="admin-meta">Aucune.</p>
        ) : (
          <ul>
            {fiche.visiosSansDemande.map((v) => (
              <li key={v.id} className="flex flex-col gap-[var(--space-admin-1)]">
                <CelluleVisio visio={v} adminPrefix={adminPrefix} />
                <Reponses visio={v} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
