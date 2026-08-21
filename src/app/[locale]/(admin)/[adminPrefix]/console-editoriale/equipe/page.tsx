// Console éditoriale — l'équipe et le journal (§3, lot 4).
//
// Deux choses sur un écran, parce qu'elles se lisent ensemble : QUI est dans
// l'équipe, et CE QU'ILS ONT FAIT.
//
// > « Toute mutation apparaît dans le journal AVEC SON AUTEUR. »
//
// Le mot qui manquait au lot 1 était « apparaît » : `journaliser` portait déjà
// `membreId` depuis le début, mais rien ne le montrait. Un journal que
// personne ne peut ouvrir n'est pas un journal.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBadge,
  AdminEmptyState,
  AdminButton,
} from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { requireMembreEditorial } from "@/server/actions/editorial/_guards";
import { creerMembreFormAction } from "@/server/actions/editorial/equipe";
import { changerRoleMembreFormAction } from "@/server/actions/editorial/formulaires";
import { ROLES_EDITORIAUX, peut, actionsDe } from "@/server/editorial/permissions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Ce que raconte chaque action du journal, en français. */
const RECITS: Record<string, string> = {
  import: "importée",
  creation: "créée",
  creation_par_promotion: "créée depuis une idée",
  modification: "modifiée",
  modification_sans_version: "modifiée sans nouvelle version",
  validation: "validée",
  programmation: "programmée",
  publication: "publiée",
  deplacement: "replanifiée",
  capture: "notée",
  promotion: "promue en publication",
  archivage: "archivée",
  televersement: "déposé",
  detachement: "détaché",
  rattachement: "rattaché",
  recette_appliquee: "recette appliquée",
  revue_soumission: "soumis à la revue",
  revue_refus: "refusé en revue",
  assignation: "assigné",
  releve: "relevé saisi",
  changement_role: "rôle changé",
};

export default async function EquipePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const retour = `${base}/equipe`;
  const moi = await requireMembreEditorial();
  const jePeuxGerer = peut(moi.role, "equipe.gerer");

  const [membres, journal] = await Promise.all([
    prisma.edMembre.findMany({
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        userId: true,
        _count: { select: { assets: true, publications: true } },
      },
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
    }),
    prisma.edJournal.findMany({
      select: {
        id: true,
        entite: true,
        entiteId: true,
        action: true,
        createdAt: true,
        membre: { select: { nom: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const sansAuteur = journal.filter((j) => j.membre === null).length;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Équipe et journal"
        description={`${membres.length} membre${membres.length > 1 ? "s" : ""} · ${journal.length} dernière${journal.length > 1 ? "s" : ""} mutation${journal.length > 1 ? "s" : ""}.`}
        meta={<AdminBadge tone="info">votre rôle : {moi.role}</AdminBadge>}
      />

      {sp.erreur && (
        <div
          role="alert"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-3 text-[color:var(--color-admin-destructive-fg)]"
        >
          {sp.erreur}
        </div>
      )}
      {sp.cree && (
        <div
          role="status"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)] p-3 text-[color:var(--color-admin-success-fg)]"
        >
          Membre ajouté.
        </div>
      )}

      {/* ── L'équipe ─────────────────────────────────────────────────────── */}
      {sp.role && (
        <p role="status" className="admin-alert admin-alert-success">
          Rôle changé — la nouvelle permission vaut dès la prochaine action.
        </p>
      )}

      <AdminCard>
        <h2 className="admin-h2 mb-[var(--space-admin-3)]">L&apos;équipe</h2>

        {membres.length === 0 ? (
          <AdminEmptyState
            variant="inline"
            title="Aucun membre déclaré"
            description="Tant qu'ed_membres est vide, un administrateur de la console est traité comme administrateur éditorial — c'est l'amorçage prévu pour « un seul utilisateur au départ ». Dès qu'un membre existe pour un compte, c'est LUI qui fait foi."
          />
        ) : (
          <ul className="space-y-2">
            {membres.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {m.nom}
                    {m.userId === moi.userId && (
                      <span className="text-[color:var(--color-admin-fg-muted)]"> — vous</span>
                    )}
                  </span>
                  <span className="block text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    {m.email} · {m._count.assets} asset(s) · {m._count.publications} publication(s)
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {!m.actif && <AdminBadge tone="neutral">désactivé</AdminBadge>}
                  {/*
                    🔴 Ajouté après la passe 5 du protocole.

                    `changerRoleMembreAction` existait depuis le lot 4 et
                    n'était appelée par aucun écran : le critère 2 — « le
                    rôle d'un membre se change » — n'était donc pas
                    vérifiable, seulement codé.

                    Le sélecteur n'apparaît que pour qui a `equipe.gerer` ;
                    les autres gardent le badge en lecture. Et l'action
                    refuse l'auto-rétrogradation d'un admin, avec son
                    explication : se retirer soi-même le dernier droit
                    d'administration ferme la porte de l'intérieur.
                  */}
                  {jePeuxGerer ? (
                    <form action={changerRoleMembreFormAction} className="admin-inline-form">
                      <input type="hidden" name="membreId" value={m.id} />
                      <input type="hidden" name="retour" value={retour} />
                      <label htmlFor={`role-${m.id}`} className="admin-label">
                        Rôle de {m.nom}
                      </label>
                      <select
                        id={`role-${m.id}`}
                        name="role"
                        defaultValue={m.role}
                        className="admin-select"
                      >
                        {ROLES_EDITORIAUX.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <AdminButton type="submit" variant="secondary" size="sm">
                        Changer
                      </AdminButton>
                    </form>
                  ) : (
                    <AdminBadge tone={m.role === "admin" ? "info" : "neutral"}>{m.role}</AdminBadge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {jePeuxGerer ? (
          <form
            action={creerMembreFormAction}
            className="mt-[var(--space-admin-4)] flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="retour" value={retour} />
            <div className="min-w-0 flex-1">
              <label htmlFor="nom" className="admin-label">
                Nom
              </label>
              <input
                id="nom"
                name="nom"
                type="text"
                required
                maxLength={160}
                className="admin-input"
              />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="email" className="admin-label">
                Adresse électronique
              </label>
              <input id="email" name="email" type="email" required className="admin-input" />
            </div>
            <div>
              <label htmlFor="role" className="admin-label">
                Rôle
              </label>
              <select id="role" name="role" defaultValue="lecture" className="admin-input">
                {ROLES_EDITORIAUX.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="admin-button admin-button-sm">
              Ajouter
            </button>
          </form>
        ) : (
          // Un refus muet laisserait croire à une panne. On dit POURQUOI.
          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Gérer l&apos;équipe est réservé au rôle « admin » (§4). Votre rôle « {moi.role} » donne
            accès à : {actionsDe(moi.role).join(", ")}.
          </p>
        )}
      </AdminCard>

      {/* ── Le journal — critère 3 ───────────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
            <h2 className="admin-h2">Le journal</h2>
            {sansAuteur > 0 && (
              // On DIT ce qui n'a pas d'auteur plutôt que d'afficher un vide
              // qu'on prendrait pour un bug.
              <AdminBadge tone="warning">{sansAuteur} sans auteur</AdminBadge>
            )}
          </div>

          {journal.length === 0 ? (
            <AdminEmptyState
              variant="inline"
              title="Aucune mutation"
              description="Le journal se remplit à la première écriture : import, création, validation, dépôt de fichier, relevé…"
            />
          ) : (
            <ul className="space-y-1">
              {journal.map((j) => (
                <li
                  key={j.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[color:var(--color-admin-border)] py-1 text-[length:var(--text-admin-sm)] last:border-0"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-[color:var(--color-admin-fg-muted)]">
                      {j.createdAt.toLocaleString("fr-FR")}
                    </span>{" "}
                    <span className="font-medium">
                      {j.entite.replace("Ed", "")} {RECITS[j.action] ?? j.action}
                    </span>
                  </span>
                  <span className="shrink-0 text-[color:var(--color-admin-fg-muted)]">
                    {j.membre ? (
                      <>
                        {j.membre.nom} <AdminBadge tone="neutral">{j.membre.role}</AdminBadge>
                      </>
                    ) : (
                      // Les 74 entrées d'import n'ont pas d'auteur : elles ont
                      // été écrites par une commande, pas par une personne.
                      "commande"
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Les 100 dernières mutations. Une entrée « commande » vient d&apos;un script
            (`editorial:import`, `editorial:seed`) et non d&apos;une personne — le dire vaut mieux
            que d&apos;afficher un auteur vide.
          </p>
        </AdminCard>
      </div>
    </AdminPageShell>
  );
}
