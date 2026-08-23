// Console éditoriale — la banque d'idées (§3, critères 16 et 17).
//
// > « Noter une idée : 10 secondes, 1 champ. »
//
// Le formulaire de capture est en HAUT, il porte UN champ, et le curseur y
// arrive tout seul (`autoFocus`). Rien à choisir, rien à déplier : une idée se
// note debout, entre deux rendez-vous, ou elle ne se note pas.
//
// Zéro JavaScript client : `<form action={serverAction}>` suffit, et le détail
// facultatif vit dans un `<details>` natif — pas un état React.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui";
import { listerIdees, listerComptesActifs } from "@/server/editorial/publication-queries";
import {
  capturerIdeeFormAction,
  promouvoirIdeeFormAction,
  archiverIdeeFormAction,
} from "@/server/actions/editorial/idees";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function IdeesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const retour = `${base}/idees`;

  const [idees, comptes] = await Promise.all([listerIdees(), listerComptesActifs()]);
  const capturees = idees.filter((i) => i.statut === "capturee" || i.statut === "qualifiee");
  const promues = idees.filter((i) => i.statut === "promue");

  // Demain, comme date par défaut de promotion : on ne programme pas pour hier.
  const demain = new Date();
  demain.setUTCDate(demain.getUTCDate() + 1);
  const demainIso = demain.toISOString().slice(0, 10);

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Banque d'idées"
        description="Noter une idée doit prendre dix secondes. Un champ, un bouton."
        actions={
          <AdminButton href={base} variant="ghost" size="sm">
            Tableau de bord
          </AdminButton>
        }
      />

      {sp.erreur && (
        <div
          role="alert"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-3 text-[color:var(--color-admin-destructive-fg)]"
        >
          {sp.erreur}
        </div>
      )}
      {sp.capturee && (
        <div
          role="status"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)] p-3 text-[color:var(--color-admin-success-fg)]"
        >
          Idée notée.
        </div>
      )}

      {/* ── LA capture — critère 16 : un seul champ ──────────────────────── */}
      <AdminCard>
        <h2 className="admin-h2 mb-[var(--space-admin-3)]">Noter une idée</h2>
        <form action={capturerIdeeFormAction} className="space-y-3">
          <input type="hidden" name="retour" value={retour} />
          <div className="flex flex-wrap gap-2">
            <label htmlFor="titre" className="sr-only">
              L&apos;idée, en une phrase
            </label>
            <input
              id="titre"
              name="titre"
              type="text"
              required
              maxLength={240}
              autoFocus
              placeholder="L'idée, en une phrase…"
              className="admin-input min-w-0 flex-1"
            />
            <button type="submit" className="admin-button admin-button-sm">
              Noter
            </button>
          </div>

          {/* Le détail est FACULTATIF, et replié : le proposer déplié
              transformerait un champ en deux. */}
          <details>
            <summary className="cursor-pointer text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Ajouter un détail (facultatif)
            </summary>
            <label htmlFor="detail" className="sr-only">
              Détail
            </label>
            <textarea
              id="detail"
              name="detail"
              rows={4}
              maxLength={5000}
              placeholder="Ce que vous en feriez, un angle, une source…"
              className="admin-input mt-2"
            />
          </details>
        </form>
      </AdminCard>

      {/* ── Les idées en attente ─────────────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">
            En attente{" "}
            <span className="text-[color:var(--color-admin-fg-muted)]">({capturees.length})</span>
          </h2>
          {capturees.length === 0 ? (
            <AdminEmptyState
              variant="inline"
              title="Aucune idée en attente"
              description="Notez la première ci-dessus. Une idée qui n'est pas notée est une idée perdue — et c'est la matière première de tout le reste."
            />
          ) : (
            <ul className="space-y-2">
              {capturees.map((idee) => (
                <li
                  key={idee.id}
                  className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <strong className="min-w-0">{idee.titre}</strong>
                    <AdminBadge tone="neutral">{idee.statut}</AdminBadge>
                  </div>
                  {idee.detail && (
                    <p className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                      {idee.detail}
                    </p>
                  )}

                  {/* ── Promouvoir — critère 17 ──────────────────────────── */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium">
                      Promouvoir en publication
                    </summary>
                    <form
                      action={promouvoirIdeeFormAction}
                      className="mt-2 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="id" value={idee.id} />
                      <input type="hidden" name="retour" value={retour} />
                      <input type="hidden" name="basePublications" value={`${base}/publications`} />
                      <div>
                        <label
                          htmlFor={`compte-${idee.id}`}
                          className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                        >
                          Compte
                        </label>
                        <select
                          id={`compte-${idee.id}`}
                          name="compteId"
                          required
                          className="admin-input"
                        >
                          {comptes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.libelle}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor={`date-${idee.id}`}
                          className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                        >
                          Date
                        </label>
                        <input
                          id={`date-${idee.id}`}
                          name="datePrevue"
                          type="date"
                          required
                          defaultValue={demainIso}
                          className="admin-input"
                        />
                      </div>
                      <button type="submit" className="admin-button-secondary admin-button-sm">
                        Promouvoir
                      </button>
                    </form>
                  </details>

                  {/* ── Écarter — critère 18 ────────────────────────────── */}
                  {/*
                    🔴 Ajouté après la passe 5 du protocole. `archiverIdeeAction`
                    existait et n'était appelée par aucun écran.

                    Le motif est OBLIGATOIRE, côté formulaire comme côté action :
                    écarter sans dire pourquoi, c'est perdre la raison six mois
                    plus tard, quand l'idée revient et que personne ne sait plus
                    si elle avait été jugée mauvaise ou seulement prématurée.
                  */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium">
                      Écarter
                    </summary>
                    <form
                      action={archiverIdeeFormAction}
                      className="mt-2 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="id" value={idee.id} />
                      <input type="hidden" name="retour" value={retour} />
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor={`motif-${idee.id}`}
                          className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                        >
                          Pourquoi on l&apos;écarte
                        </label>
                        <input
                          id={`motif-${idee.id}`}
                          name="motif"
                          type="text"
                          required
                          maxLength={1000}
                          className="admin-input"
                          placeholder="Déjà traité en mars, angle trop proche."
                        />
                      </div>
                      <button type="submit" className="admin-button-ghost admin-button-sm">
                        Écarter
                      </button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      {/* ── Les idées déjà promues — la trace, pas l'oubli ───────────────── */}
      {promues.length > 0 && (
        <div className="mt-[var(--space-admin-4)]">
          <AdminCard>
            <h2 className="admin-h2 mb-[var(--space-admin-3)]">
              Devenues des publications{" "}
              <span className="text-[color:var(--color-admin-fg-muted)]">({promues.length})</span>
            </h2>
            <ul className="space-y-2">
              {promues.map((idee) => (
                <li
                  key={idee.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                >
                  <span className="min-w-0 truncate">{idee.titre}</span>
                  {idee.promueVersId && (
                    <Link
                      href={`${base}/publications/${idee.promueVersId}`}
                      className="shrink-0 text-[length:var(--text-admin-sm)] hover:underline"
                    >
                      Voir la publication →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>
      )}
    </AdminPageShell>
  );
}
