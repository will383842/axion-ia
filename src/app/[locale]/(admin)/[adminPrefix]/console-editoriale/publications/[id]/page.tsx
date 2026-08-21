// Console éditoriale — la fiche d'une publication (§3).
//
// Lecture au lot 1 : le contenu, l'état de conformité, l'historique des
// versions. La rédaction en ligne arrive avec le formulaire, mais le kit —
// ce qu'on vient chercher le matin — est déjà à un clic.
//
// L'état de conformité est calculé À L'AFFICHAGE, en lisant les règles en
// base : l'utilisateur voit ce qui bloquera AVANT de tenter de valider,
// plutôt que de se le faire refuser après coup.

import { redirect, notFound } from "next/navigation";
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
import { prisma } from "@/lib/prisma";
import { chargerPublication } from "@/server/editorial/publication-queries";
import { evaluerConformite, type RegleEvaluable } from "@/server/editorial/conformite/evaluateur";
import { televerserAssetAction } from "@/server/actions/editorial/assets";
import { urlPublique } from "@/server/editorial/stockage";
import { DepotFichier } from "./DepotFichier";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function FichePublicationPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const publication = await chargerPublication(id);
  if (!publication) notFound();

  const base = `/fr/${adminPrefix}/console-editoriale`;

  const regles = (await prisma.edRegleConformite.findMany({
    where: { actif: true },
    orderBy: { code: "asc" },
  })) as unknown as RegleEvaluable[];

  const conformite = evaluerConformite(regles, {
    accroche: publication.accroche,
    corps: publication.corps,
    premierCommentaire: publication.premierCommentaire,
    tags: publication.tags,
    lienUrl: publication.lienUrl,
  });

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={publication.titreInterne}
        description={`${publication.compte.libelle} · ${publication.dayKey
          .split("-")
          .reverse()
          .join("/")} à ${publication.heurePrevue}`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge tone={publication.statutRedaction === "valide" ? "success" : "warning"}>
              rédaction : {publication.statutRedaction}
            </AdminBadge>
            <AdminBadge tone={publication.statutAsset === "pret" ? "success" : "neutral"}>
              asset : {publication.statutAsset}
            </AdminBadge>
            <AdminBadge tone={publication.statutDiffusion === "publie" ? "success" : "neutral"}>
              diffusion : {publication.statutDiffusion}
            </AdminBadge>
            {publication.versionCourante > 1 && (
              <AdminBadge tone="info">version {publication.versionCourante}</AdminBadge>
            )}
          </div>
        }
        actions={
          <AdminButton href={`${base}/publications/${id}/kit`} variant="primary" size="sm">
            Ouvrir le kit
          </AdminButton>
        }
      />

      {/* ── L'état de conformité, AVANT toute tentative de validation ────── */}
      <AdminCard>
        <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
          <h2 className="admin-h2">Conformité</h2>
          <AdminBadge tone={conformite.validable ? "success" : "destructive"}>
            {conformite.validable ? "validable" : "bloquée"}
          </AdminBadge>
        </div>

        {conformite.bloquantes.length === 0 && conformite.avertissements.length === 0 ? (
          <p className="text-[color:var(--color-admin-fg-muted)]">
            Aucune règle enfreinte sur les {regles.length} règles actives.
          </p>
        ) : (
          <ul className="space-y-2">
            {[...conformite.bloquantes, ...conformite.avertissements].map((c) => (
              <li
                key={c.code}
                className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <AdminBadge tone={c.gravite === "bloquant" ? "destructive" : "warning"}>
                    {c.gravite}
                  </AdminBadge>
                  <strong>{c.libelle}</strong>
                </div>
                {/* Le message CITE la règle et l'extrait fautif. */}
                <p className="mt-1 text-[length:var(--text-admin-sm)]">{c.message}</p>
              </li>
            ))}
          </ul>
        )}

        {conformite.nonEvaluees.length > 0 && (
          // Dire ce qu'on n'a PAS su vérifier. Le taire laisserait croire à un
          // contrôle complet.
          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Non évaluées ici : {conformite.nonEvaluees.map((c) => c.code).join(", ")} — elles
            demandent un contexte (invité, spécification de plateforme) que cette fiche ne porte pas
            encore.
          </p>
        )}
      </AdminCard>

      {/* ── Le contenu ──────────────────────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">Le contenu</h2>

          {publication.accroche && (
            <div className="mb-[var(--space-admin-3)]">
              <h3 className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]">
                Accroche
              </h3>
              <p>{publication.accroche}</p>
            </div>
          )}

          <h3 className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]">
            Corps
          </h3>
          {publication.corps ? (
            <pre className="mt-1 max-h-96 overflow-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 font-sans text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
              {publication.corps}
            </pre>
          ) : (
            <p className="text-[color:var(--color-admin-fg-muted)]">Pas encore rédigé.</p>
          )}

          {publication.premierCommentaire && (
            <>
              <h3 className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]">
                Premier commentaire
              </h3>
              <pre className="mt-1 max-h-60 overflow-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 font-sans text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
                {publication.premierCommentaire}
              </pre>
            </>
          )}

          {publication.tags.length > 0 && (
            <div className="mt-[var(--space-admin-3)] flex flex-wrap gap-1">
              {publication.tags.map((t) => (
                <AdminBadge key={t} tone="neutral">
                  #{t}
                </AdminBadge>
              ))}
            </div>
          )}
        </AdminCard>
      </div>

      {/* ── Les médias — critères 4 et 5 ────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
            <h2 className="admin-h2">Les médias</h2>
            {publication.assets.some((a) => a.cheminObjet) && (
              <a
                href={`${base}/export?type=archive&publication=${id}`}
                className="admin-button-secondary admin-button-sm"
              >
                Télécharger l&apos;archive
              </a>
            )}
          </div>

          {publication.assets.length > 0 && (
            <ul className="mb-[var(--space-admin-3)] space-y-2">
              {publication.assets.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {a.cheminObjet && a.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={urlPublique(a.cheminObjet)}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-[var(--radius-admin-sm)] object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 truncate">{a.libelle}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <AdminBadge tone="neutral">{a.type}</AdminBadge>
                    <AdminBadge tone={a.statut === "pret" ? "success" : "warning"}>
                      {a.statut}
                    </AdminBadge>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <DepotFichier publicationId={id} televerser={televerserAssetAction} />
        </AdminCard>
      </div>

      {/* ── L'historique — critère 7 : l'ancienne reste consultable ──────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">Historique</h2>
          {publication.versions.length === 0 ? (
            <AdminEmptyState
              variant="inline"
              title="Aucune version antérieure"
              description="Une version sera archivée à la première modification du corps, de l'accroche, du premier commentaire ou des tags. Un changement de statut n'en crée pas."
            />
          ) : (
            <ul className="space-y-2">
              {publication.versions.map((v) => (
                <li
                  key={v.version}
                  className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>Version {v.version}</strong>
                    <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                      {new Date(v.creeA).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  {v.motif && (
                    <p className="mt-1 text-[length:var(--text-admin-sm)] italic">{v.motif}</p>
                  )}
                  {v.corps && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-surface-hover)] p-2 font-sans text-[length:var(--text-admin-xs)] whitespace-pre-wrap">
                      {v.corps}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <p className="mt-[var(--space-admin-6)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        <Link href={`${base}/publications`} className="hover:underline">
          ← Toutes les publications
        </Link>
      </p>
    </AdminPageShell>
  );
}
