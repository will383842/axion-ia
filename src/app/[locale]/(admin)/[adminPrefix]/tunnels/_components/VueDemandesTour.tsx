// Corps visuel de la page « Demandes du Tour France IA » (2026-10-27, PR-2a).
//
// Séparé de la page, comme les autres vues de tunnel : il ne dépend que de ses propriétés, donc
// s'affiche — et se vérifie — sans session. Page SERVEUR, aucun composant client : les filtres sont
// des liens, les boutons des `<form action>` vers les Server Actions de `statuts.ts`.
//
// AUCUN bouton de suppression. « Rendez-vous pris » est un statut CALCULÉ (l'e-mail de la demande
// correspond à un rendez-vous du Tour) : une demande y reste visible, avec ce statut.

import Link from "next/link";
import {
  AdminBadge,
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/ui";
import {
  creerFicheProspect,
  ecarter,
  marquerRelancee,
  remettreRecue,
} from "@/features/tour-de-france/statuts";
import type {
  DemandeConsole,
  LigneVilleConsole,
  ListeConsole,
} from "@/features/tour-de-france/lectures";
import {
  LIBELLE_RATTACHEMENT,
  LIBELLE_SIGNAL,
  LIBELLE_STATUT_AFFICHE,
  STATUTS_AFFICHES,
  type StatutAffiche,
} from "@/features/tour-de-france/types";

const TON_STATUT: Readonly<
  Record<StatutAffiche, "neutral" | "info" | "success" | "warning" | "outline">
> = {
  rdv_pris: "success",
  relancee_main: "info",
  recue: "warning",
  ecartee: "outline",
  effacee_rgpd: "outline",
};

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export interface PropsVueDemandesTour {
  readonly adminPrefix: string;
  readonly liste: ListeConsole;
  readonly villes: ReadonlyArray<LigneVilleConsole>;
  readonly filtreVille: string | null;
  readonly filtreStatut: StatutAffiche | null;
  readonly ok: string | null;
  readonly erreur: string | null;
}

function lien(base: string, ville: string | null, statut: StatutAffiche | null): string {
  const q = new URLSearchParams();
  if (ville) q.set("ville", ville);
  if (statut) q.set("statut", statut);
  const texte = q.toString();
  return texte === "" ? base : `${base}?${texte}`;
}

function Actions({ d }: { d: DemandeConsole }): React.ReactElement {
  if (d.statut === "effacee_rgpd") {
    return <span className="admin-meta">Aucun geste possible</span>;
  }
  const peutCreerLaFiche =
    d.clientId === null && (d.rattachement === "sans_fiche" || d.rattachement === "a_arbitrer");
  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        {d.statut === "recue" ? (
          <form action={marquerRelancee}>
            <input type="hidden" name="id" value={d.id} />
            <button type="submit" className="admin-button admin-button-sm">
              J&apos;ai relancé
            </button>
          </form>
        ) : null}
        {d.statut !== "ecartee" ? (
          <form action={ecarter}>
            <input type="hidden" name="id" value={d.id} />
            <button type="submit" className="admin-button-ghost">
              Écarter
            </button>
          </form>
        ) : null}
        {d.statut === "ecartee" || d.statut === "relancee_main" ? (
          <form action={remettreRecue}>
            <input type="hidden" name="id" value={d.id} />
            <button type="submit" className="admin-button-ghost">
              Remettre en attente
            </button>
          </form>
        ) : null}
      </div>
      {peutCreerLaFiche ? (
        <details>
          <summary className="admin-link">Créer la fiche prospect</summary>
          <form action={creerFicheProspect} className="flex flex-col gap-[var(--space-admin-2)]">
            <input type="hidden" name="id" value={d.id} />
            <label className="admin-meta">
              Raison sociale
              <input type="text" name="raisonSociale" required maxLength={250} />
            </label>
            <label className="admin-meta">
              Type
              <select name="type" defaultValue="entreprise">
                <option value="entreprise">Entreprise</option>
                <option value="particulier">Particulier</option>
              </select>
            </label>
            <label className="admin-meta">
              Motif (seulement si l&apos;adresse e-mail est déjà sur une fiche)
              <input type="text" name="motif" maxLength={300} />
            </label>
            <button type="submit" className="admin-button admin-button-sm">
              Créer la fiche
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function CelluleFiche({
  d,
  adminPrefix,
}: {
  d: DemandeConsole;
  adminPrefix: string;
}): React.ReactElement {
  const fiche = (id: string): string => `/fr/${adminPrefix}/qualiopi/clients/${id}`;
  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <span>{LIBELLE_RATTACHEMENT[d.rattachement]}</span>
      {d.clientId !== null ? (
        <Link href={fiche(d.clientId)} className="admin-link">
          Ouvrir la fiche
        </Link>
      ) : null}
      {d.fichesProches.length > 0 ? (
        <ul className="admin-meta">
          {d.fichesProches.map((f) => (
            <li key={f.ficheId}>
              <Link href={fiche(f.ficheId)} className="admin-link">
                {f.numero} · {f.raisonSociale}
              </Link>{" "}
              ({LIBELLE_SIGNAL[f.signal]})
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function VueDemandesTour({
  adminPrefix,
  liste,
  villes,
  filtreVille,
  filtreStatut,
  ok,
  erreur,
}: PropsVueDemandesTour): React.ReactElement {
  const base = `/fr/${adminPrefix}/tunnels/tour/demandes`;
  const retourTunnel = `/fr/${adminPrefix}/tunnels/tour`;
  const totalComptees = villes.reduce((somme, v) => somme + v.comptees, 0);

  const colonnes: ReadonlyArray<AdminTableColumn<DemandeConsole>> = [
    {
      key: "personne",
      header: "Personne",
      width: "24%",
      cell: (d) => (
        <div className="flex flex-col">
          <strong>{d.nom}</strong>
          <span className="admin-meta">{d.email}</span>
          <span className="admin-meta">{d.telephone}</span>
        </div>
      ),
    },
    { key: "ville", header: "Ville", cell: (d) => d.ville },
    {
      key: "date",
      header: "Reçue le",
      hiddenBelow: "md",
      cell: (d) => FORMAT_DATE.format(d.creeLe),
    },
    {
      key: "statut",
      header: "Statut",
      cell: (d) => (
        <div className="flex flex-col gap-[var(--space-admin-1)]">
          <AdminBadge tone={TON_STATUT[d.statut]}>{LIBELLE_STATUT_AFFICHE[d.statut]}</AdminBadge>
          <span className="admin-meta">
            {d.doublon ? "Ne compte pas (déjà comptée)" : d.compte ? "Compte pour la ville" : ""}
          </span>
        </div>
      ),
    },
    {
      key: "fiche",
      header: "Fiche prospect",
      cell: (d) => <CelluleFiche d={d} adminPrefix={adminPrefix} />,
    },
    { key: "actions", header: "Gestes", cell: (d) => <Actions d={d} /> },
  ];

  return (
    <>
      <AdminPageHeader
        title="Demandes du Tour France IA"
        description="Les personnes qui ont rempli la mini-demande avant la visio. Une demande reste ici avec son statut ; « rendez-vous pris » s'affiche dès que la même adresse e-mail a un rendez-vous du Tour."
        actions={
          <Link href={retourTunnel} className="admin-button-ghost">
            Retour au tunnel
          </Link>
        }
      />

      {ok !== null ? (
        <p className="admin-meta" role="status">
          {ok}
        </p>
      ) : null}
      {erreur !== null ? (
        <p className="admin-alert admin-alert-warning" role="alert">
          <span>{erreur}</span>
        </p>
      ) : null}
      {liste.rapprochementIndisponible ? (
        <p className="admin-alert admin-alert-warning">
          <span>
            La lecture des rendez-vous est indisponible : « rendez-vous pris » n&apos;est pas
            affiché pour le moment.
          </span>
        </p>
      ) : null}

      <div className="admin-kpi-grid">
        <AdminStatCard
          label="Demandes comptées"
          value={totalComptees.toLocaleString("fr-FR")}
          meta="Une par personne, par entreprise et par téléphone, dans chaque ville"
        />
        <AdminStatCard
          label="Villes"
          value={villes.length.toLocaleString("fr-FR")}
          meta="Villes ayant reçu au moins une demande"
        />
      </div>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Par ville</h2>
        <p className="admin-lede">
          Une ville s&apos;ouvre à 5 demandes comptées. Cliquez sur une ville pour ne voir que ses
          demandes.
        </p>
        {villes.length === 0 ? (
          <p className="admin-meta">Aucune demande pour le moment.</p>
        ) : (
          <ul>
            {filtreVille !== null ? (
              <li>
                <Link href={lien(base, null, filtreStatut)} className="admin-link">
                  Toutes les villes
                </Link>
              </li>
            ) : null}
            {villes.map((v) => (
              <li key={v.villeCle}>
                <Link
                  href={lien(base, v.villeCle, filtreStatut)}
                  className="admin-link"
                  aria-current={v.villeCle === filtreVille ? "page" : undefined}
                >
                  {v.ville}
                </Link>{" "}
                : {v.comptees} comptée{v.comptees > 1 ? "s" : ""} sur {v.demandes} demande
                {v.demandes > 1 ? "s" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Demandes</h2>
        <nav aria-label="Statut" className="flex flex-wrap gap-[var(--space-admin-2)]">
          <Link
            href={lien(base, filtreVille, null)}
            className={
              filtreStatut === null ? "admin-button admin-button-sm" : "admin-button-ghost"
            }
            aria-current={filtreStatut === null ? "page" : undefined}
          >
            Tous les statuts
          </Link>
          {STATUTS_AFFICHES.map((s) => (
            <Link
              key={s}
              href={lien(base, filtreVille, s)}
              className={filtreStatut === s ? "admin-button admin-button-sm" : "admin-button-ghost"}
              aria-current={filtreStatut === s ? "page" : undefined}
            >
              {LIBELLE_STATUT_AFFICHE[s]}
            </Link>
          ))}
        </nav>
        {liste.tronquee ? (
          <p className="admin-alert admin-alert-warning">
            <span>
              Plus de 500 demandes : seules les plus récentes sont listées. Filtrez par ville.
            </span>
          </p>
        ) : null}
        <AdminTable
          columns={colonnes}
          rows={liste.demandes}
          getRowId={(d) => d.id}
          caption="Demandes du Tour France IA"
          emptyState={<p className="admin-meta">Aucune demande pour ce filtre.</p>}
        />
      </section>
    </>
  );
}
