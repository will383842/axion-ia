// Corps visuel du tableau « Tunnel apporteurs » — rendu SERVEUR, aucun composant
// client (le bucket de JavaScript de la console est au plafond) : la période se
// choisit par des liens, la saisie de dépense par un `<form action>` qui appelle
// une Server Action.
//
// Séparé de la page pour être affichable sans session (contrôle à l'écran).
//
// Règles de lecture écrites ici parce qu'un tableau de pilotage trompe plus
// qu'il n'éclaire quand on les oublie : « non mesuré » n'est jamais un zéro, et
// aucun coût n'est une moyenne sur peu de cas.

import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/ui/AdminTable";
import {
  SEUIL_CONCLURE,
  coutParMarche,
  partDepuisPrecedente,
  type Cellule,
  type LigneAnnonce,
  type LigneDecoupage,
  type Marche,
} from "@/features/admin-tunnels/apporteurs-entonnoir";
import { PERIODES, type TableauApporteurs } from "@/features/admin-tunnels/apporteurs";
import { CANAUX_DEPENSE, LIBELLE_CANAL } from "@/features/admin-tunnels/depenses";
import {
  ajouterDepenseAction,
  supprimerDepenseAction,
} from "@/features/admin-tunnels/depenses-actions";

const nb = (n: number): string => n.toLocaleString("fr-FR");
const euros = (centimes: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(centimes / 100);
const jourFr = (d: Date): string => d.toISOString().slice(0, 10).split("-").reverse().join("/");

/** « non mesuré » pour un total, « — » pour une cellule de semaine. Jamais 0. */
function cellule(v: Cellule, total: boolean): React.ReactNode {
  if (v === null) return <span className="admin-meta-small">{total ? "non mesuré" : "—"}</span>;
  return nb(v);
}

function pct(p: number | null): React.ReactNode {
  return p === null ? <span className="admin-meta-small">—</span> : `${p} %`;
}

function cout(c: number | null): React.ReactNode {
  return c === null ? <span className="admin-meta-small">—</span> : euros(c);
}

interface LigneEntonnoir {
  marche: Marche;
  precedent: Marche | null;
}

export function VueApporteurs({
  t,
  adminPrefix,
  peutEcrire,
  message,
  erreur,
  aujourdhui,
}: {
  t: TableauApporteurs;
  adminPrefix: string;
  peutEcrire: boolean;
  message?: string | undefined;
  erreur?: string | undefined;
  aujourdhui: string;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/tunnels/apporteurs`;
  const { entonnoir } = t;

  const lignes: LigneEntonnoir[] = entonnoir.marches.map((m, i) => ({
    marche: m,
    precedent: i > 0 ? (entonnoir.marches[i - 1] ?? null) : null,
  }));

  const colonnes: ReadonlyArray<AdminTableColumn<LigneEntonnoir>> = [
    {
      key: "marche",
      header: "Marche",
      cell: (r) => (
        <>
          {r.marche.libelle}
          <span className="admin-meta-small"> · {r.marche.unite}</span>
        </>
      ),
      width: "28%",
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => cellule(r.marche.total, true),
    },
    {
      key: "part",
      header: "Depuis la précédente",
      align: "right",
      cell: (r) =>
        pct(r.precedent ? partDepuisPrecedente(r.marche.total, r.precedent.total) : null),
    },
    {
      key: "cout",
      header: "Coût par unité",
      align: "right",
      cell: (r) => cout(coutParMarche(entonnoir.depenseTotale, r.marche.total)),
    },
    ...entonnoir.semaines.map((s, i): AdminTableColumn<LigneEntonnoir> => ({
      key: `s-${s}`,
      header: `Sem. du ${jourFr(new Date(`${s}T00:00:00.000Z`)).slice(0, 5)}`,
      align: "right",
      hiddenBelow: "md",
      cell: (r) => cellule(r.marche.parSemaine[i] ?? null, false),
    })),
  ];

  const colDecoupage = (titre: string): ReadonlyArray<AdminTableColumn<LigneDecoupage>> => [
    { key: "cle", header: titre, cell: (r) => r.cle, width: "34%" },
    {
      key: "visites",
      header: "Visites",
      align: "right",
      cell: (r) => cellule(r.visites, true),
    },
    { key: "e1", header: "Étape 1", align: "right", cell: (r) => nb(r.etape1) },
    { key: "e2", header: "Étape 2", align: "right", cell: (r) => nb(r.etape2) },
    { key: "res", header: "Réservés", align: "right", cell: (r) => nb(r.reserves) },
    {
      key: "dep",
      header: "Dépensé",
      align: "right",
      cell: (r) =>
        r.depenseCentimes === null ? (
          <span className="admin-meta-small">—</span>
        ) : (
          euros(r.depenseCentimes)
        ),
    },
    {
      key: "coutE2",
      header: "Coût par étape 2",
      align: "right",
      cell: (r) =>
        cout(r.depenseCentimes === null ? null : coutParMarche(r.depenseCentimes, r.etape2)),
    },
  ];

  const colAnnonce: ReadonlyArray<AdminTableColumn<LigneAnnonce>> = [
    {
      key: "cle",
      header: "Annonce",
      cell: (r) => (r.genre === "annonce" ? r.cle : <strong>{r.cle}</strong>),
      width: "24%",
    },
    { key: "v", header: "Visites", align: "right", cell: (r) => cellule(r.visites, true) },
    { key: "e1", header: "Étape 1 (e-mail)", align: "right", cell: (r) => cellule(r.etape1, true) },
    {
      key: "e2",
      header: "Étape 2 (téléphone)",
      align: "right",
      cell: (r) => cellule(r.etape2, true),
    },
    {
      key: "res",
      header: "Créneaux réservés",
      align: "right",
      cell: (r) => cellule(r.reserves, true),
    },
    { key: "tenu", header: "Échanges tenus", align: "right", cell: (r) => cellule(r.tenus, true) },
    { key: "ret", header: "Retenus", align: "right", cell: (r) => cellule(r.retenus, true) },
    {
      key: "ctr",
      header: "Contrats signés",
      align: "right",
      cell: (r) => cellule(r.contrats, true),
    },
    {
      key: "c1",
      header: "Coût par étape 1",
      align: "right",
      cell: (r) => cout(r.coutParEtape1),
    },
    {
      key: "cr",
      header: "Coût par réservation",
      align: "right",
      cell: (r) => cout(r.coutParReservation),
    },
  ];

  const a = t.actifs;

  return (
    <>
      <AdminPageHeader
        title="Tunnel apporteurs"
        description="De la publicité à l'apporteur qui présente une entreprise : où l'on perd les gens, et ce que ça coûte."
        actions={
          <nav aria-label="Période" className="flex gap-[var(--space-admin-2)]">
            {PERIODES.map((p) => (
              <Link
                key={p.cle}
                href={`${base}?periode=${p.cle}`}
                className={
                  p.cle === t.periode ? "admin-button admin-button-sm" : "admin-button-ghost"
                }
                aria-current={p.cle === t.periode ? "page" : undefined}
              >
                {p.libelle}
              </Link>
            ))}
          </nav>
        }
      />

      <p className="admin-alert admin-alert-info">
        <span>
          <strong>Le coût par apporteur actif ne se lit qu&apos;à 45-60 jours</strong> : entre une
          inscription et une première présentation d&apos;entreprise, il se passe des semaines.
          Avant, lisez les marches du haut. Les marches du haut (visites → page de remerciement)
          comptent des <em>sessions anonymes</em> par semaine d&apos;arrivée ; celles du bas
          (créneau → présentation) comptent des <em>personnes</em> par semaine d&apos;inscription.
        </span>
      </p>

      {t.tronquee ? (
        <p className="admin-alert admin-alert-warning">
          <span>Lecture plafonnée : réduisez la période pour des taux exacts.</span>
        </p>
      ) : null}
      {message ? (
        <p className="admin-alert admin-alert-success">
          <span>{message}</span>
        </p>
      ) : null}
      {erreur ? (
        <p className="admin-alert admin-alert-warning" role="alert">
          <span>{erreur}</span>
        </p>
      ) : null}

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Entonnoir par semaine d&apos;arrivée</h2>
        <p className="admin-lede">
          « Non mesuré » veut dire que la source n&apos;a rien enregistré ou n&apos;a pas pu être
          lue — ce n&apos;est jamais un zéro. Le coût est la dépense de la période divisée par le
          nombre ;{" "}
          {t.depenseTotale > 0 ? (
            <>
              dépensé sur la période : <strong>{euros(t.depenseTotale)}</strong>.
            </>
          ) : (
            <strong>aucune dépense saisie sur la période : les coûts restent « — ».</strong>
          )}
        </p>
        <AdminTable
          columns={colonnes}
          rows={lignes}
          getRowId={(r) => r.marche.cle}
          caption="Entonnoir du tunnel apporteurs"
        />
      </section>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Coût par apporteur actif</h2>
        <p className="admin-lede">
          Apporteur actif : contrat signé et au moins une entreprise présentée dans les 60 jours,
          arrivé par la campagne Facebook.
        </p>
        {a.etat === "aucun" ? (
          <p className="admin-alert admin-alert-info">
            <span>
              Aucun apporteur actif pour l&apos;instant : c&apos;est normal les premières semaines.
            </span>
          </p>
        ) : a.etat === "trop-peu" ? (
          <p className="admin-alert admin-alert-info">
            <span>
              <strong>{nb(a.actifs)}</strong> apporteur{a.actifs > 1 ? "s" : ""} actif
              {a.actifs > 1 ? "s" : ""} — trop peu de cas pour conclure (il en faut au moins{" "}
              {SEUIL_CONCLURE} avant de calculer un coût moyen).
            </span>
          </p>
        ) : (
          <p className="admin-lede">
            <strong>{nb(a.actifs)}</strong> apporteurs actifs · coût moyen{" "}
            <strong>{a.coutCentimes === null ? "—" : euros(a.coutCentimes)}</strong>
          </p>
        )}
      </section>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Nouvelle page contre ancienne page</h2>
        <p className="admin-lede">
          Mêmes visiteurs payants, deux pages. L&apos;ancienne page n&apos;a qu&apos;un formulaire :
          son envoi compte pour les deux étapes, seule l&apos;étape 2 est strictement comparable.
          Sous 30 visites, un taux n&apos;est que du bruit.
        </p>
        <AdminTable
          columns={[
            { key: "page", header: "Page", cell: (r) => r.libelle },
            { key: "v", header: "Visites", align: "right", cell: (r) => nb(r.visites) },
            { key: "e1", header: "Étape 1", align: "right", cell: (r) => nb(r.etape1) },
            {
              key: "e1v",
              header: "Étape 1 par visite",
              align: "right",
              cell: (r) => pctOuPeu(r.etape1ParVisite),
            },
            { key: "e2", header: "Étape 2", align: "right", cell: (r) => nb(r.etape2) },
            {
              key: "e2v",
              header: "Étape 2 par visite",
              align: "right",
              cell: (r) => pctOuPeu(r.etape2ParVisite),
            },
          ]}
          rows={t.comparaison}
          getRowId={(r) => r.page}
          caption="Comparaison des deux pages"
        />
      </section>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Par campagne</h2>
        <p className="admin-lede">
          La campagne est le repère <code>utm_campaign</code> du lien.
        </p>
        <AdminTable
          columns={colDecoupage("Campagne")}
          rows={t.parCampagne}
          getRowId={(r) => r.cle}
          caption="Par campagne"
          emptyState={<p className="admin-meta-small">Aucune donnée sur la période.</p>}
        />
      </section>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Par annonce</h2>
        <p className="admin-lede">
          Chaque inscription garde l&apos;identifiant de l&apos;annonce qui l&apos;a amenée (
          <code>utm_content</code> du lien), jusqu&apos;à la réservation et au contrat — même quand
          le créneau est pris depuis l&apos;e-mail. « (sans identifiant) » : arrivée sans annonce
          repérée. Les visites ne se mesurent pas par annonce (la balise anonyme ne la porte pas) :
          « non mesuré ». Les dépenses se saisissent par campagne : le coût n&apos;apparaît que sur
          la ligne « Total ». Les personnes déjà connues revenues par la publicité sont comptées à
          part, sur leur propre ligne.
        </p>
        <AdminTable
          columns={colAnnonce}
          rows={t.parAnnonce}
          getRowId={(r) => `${r.genre}:${r.cle}`}
          caption="Par annonce"
          emptyState={<p className="admin-meta-small">Aucune inscription sur la période.</p>}
        />
      </section>

      <section className="mt-[var(--space-admin-6)]">
        <h2 className="admin-h2">Dépenses (saisies à la main)</h2>
        <p className="admin-lede">
          Une fois par semaine, d&apos;après le Gestionnaire de publicités. Le nom de campagne doit
          être celui du lien (<code>utm_campaign</code>) pour apparaître dans « Par campagne ».
        </p>
        {peutEcrire ? (
          <form
            action={ajouterDepenseAction}
            className="flex flex-wrap items-end gap-[var(--space-admin-3)]"
          >
            <label className="admin-field">
              <span>Date</span>
              <input
                type="date"
                name="spentOn"
                required
                max={aujourdhui}
                defaultValue={aujourdhui}
                className="admin-input"
              />
            </label>
            <label className="admin-field">
              <span>Canal</span>
              <select name="canal" required className="admin-input">
                {CANAUX_DEPENSE.map((c) => (
                  <option key={c} value={c}>
                    {LIBELLE_CANAL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>Campagne</span>
              <input type="text" name="campagne" maxLength={120} className="admin-input" />
            </label>
            <label className="admin-field">
              <span>Montant (€)</span>
              <input
                type="text"
                name="montantEuros"
                inputMode="decimal"
                required
                placeholder="12,50"
                className="admin-input"
              />
            </label>
            <label className="admin-field">
              <span>Note</span>
              <input type="text" name="note" maxLength={300} className="admin-input" />
            </label>
            <button type="submit" className="admin-button">
              Ajouter
            </button>
          </form>
        ) : (
          <p className="admin-meta-small">
            Votre rôle consulte les dépenses sans pouvoir les saisir.
          </p>
        )}
        <div className="mt-[var(--space-admin-4)]" />
        <AdminTable
          columns={[
            { key: "d", header: "Date", cell: (r) => jourFr(r.spentOn) },
            {
              key: "c",
              header: "Canal",
              cell: (r) => LIBELLE_CANAL[r.canal as keyof typeof LIBELLE_CANAL] ?? r.canal,
            },
            { key: "ca", header: "Campagne", cell: (r) => r.campagne ?? "—" },
            { key: "m", header: "Montant", align: "right", cell: (r) => euros(r.montantCentimes) },
            { key: "n", header: "Note", cell: (r) => r.note ?? "", hiddenBelow: "md" },
            {
              key: "x",
              header: "",
              align: "right",
              cell: (r) =>
                peutEcrire ? (
                  <form action={supprimerDepenseAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="admin-button-ghost">
                      Supprimer
                    </button>
                  </form>
                ) : null,
            },
          ]}
          rows={t.dernieresDepenses}
          getRowId={(r) => r.id}
          caption="20 dernières saisies"
          emptyState={<p className="admin-meta-small">Aucune dépense saisie.</p>}
        />
      </section>
    </>
  );
}

function pctOuPeu(p: number | null): React.ReactNode {
  return p === null ? <span className="admin-meta-small">trop peu</span> : `${p} %`;
}
