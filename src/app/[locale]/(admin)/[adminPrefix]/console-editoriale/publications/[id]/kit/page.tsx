// Console éditoriale — LE KIT DE PUBLICATION (§2 bis C, critères 1 à 3).
//
// > « C'est la fonction la plus utilisée de l'outil, et elle doit être
// >   irréprochable. »
//
// Le test qui la juge : entre l'ouverture de la publication et le collage
// dans LinkedIn, DEUX CLICS maximum. Tout ici découle de cette contrainte —
// aucun menu, aucune confirmation, aucun repli à déplier. Ce qu'on vient
// chercher est visible d'emblée, et un clic le met au presse-papiers.
//
// Le corps et le premier commentaire ont des boutons DISTINCTS (critère 2) :
// ce sont deux gestes séparés dans LinkedIn, et les fondre en un seul
// obligerait à retailler le texte à la main.

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
import { chargerPublication } from "@/server/editorial/publication-queries";
import { BoutonCopier } from "./BoutonCopier";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « 2026-09-12 » → « 12 septembre 2026 ». */
function dateLisible(cle: string): string {
  const [a, m, j] = cle.split("-").map(Number);
  if (!a || !m || !j) return cle;
  return `${j} ${MOIS[m - 1]} ${a}`;
}

export default async function KitPublicationPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const publication = await chargerPublication(id);
  if (!publication) notFound();

  const base = `/fr/${adminPrefix}/console-editoriale`;

  // « Tout copier » : le corps, une ligne vide, puis le premier commentaire.
  // C'est exactement ce que décrit le §2 bis C.
  const toutLeTexte = [publication.corps, publication.premierCommentaire]
    .filter((t): t is string => Boolean(t && t.trim()))
    .join("\n\n");

  const mediasTelechargeables = publication.assets.filter((a) => a.cheminObjet);

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Kit de publication"
        description={publication.titreInterne}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge tone={publication.compte.identite === "pro" ? "info" : "neutral"}>
              {publication.compte.libelle}
            </AdminBadge>
            <AdminBadge tone={publication.statutRedaction === "valide" ? "success" : "warning"}>
              {publication.statutRedaction}
            </AdminBadge>
          </div>
        }
        actions={
          <AdminButton href={`${base}/publications/${id}`} variant="ghost" size="sm">
            Ouvrir la fiche
          </AdminButton>
        }
      />

      {/* ── Le récapitulatif : ce qu'il faut sous les yeux pour programmer ── */}
      <AdminCard>
        <h2 className="admin-h2 mb-[var(--space-admin-3)]">À programmer</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[length:var(--text-admin-sm)] sm:grid-cols-4">
          <div>
            <dt className="text-[color:var(--color-admin-fg-muted)]">Compte</dt>
            <dd className="font-medium">{publication.compte.libelle}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--color-admin-fg-muted)]">Date</dt>
            <dd className="font-medium">{dateLisible(publication.dayKey)}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--color-admin-fg-muted)]">Heure</dt>
            <dd className="font-mono font-medium">{publication.heurePrevue}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--color-admin-fg-muted)]">Plateforme</dt>
            <dd className="font-medium">{publication.compte.plateforme}</dd>
          </div>
        </dl>
      </AdminCard>

      {/* ── Tout à la fois — le geste par défaut, mis en premier ─────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="admin-h2">Tout copier</h2>
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Le corps, une ligne vide, puis le premier commentaire.
              </p>
            </div>
            <BoutonCopier texte={toutLeTexte} libelle="Tout copier" principal />
          </div>
        </AdminCard>
      </div>

      {/* ── Le corps ─────────────────────────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-3">
            <h2 className="admin-h2">Le corps</h2>
            <BoutonCopier texte={publication.corps ?? ""} libelle="Copier le corps" principal />
          </div>
          {publication.corps ? (
            <pre className="max-h-80 overflow-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 font-sans text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
              {publication.corps}
            </pre>
          ) : (
            <AdminEmptyState
              variant="inline"
              title="Pas encore de corps"
              description="Ouvrez la fiche pour le rédiger : c'est lui qu'on colle dans LinkedIn."
            />
          )}
        </AdminCard>
      </div>

      {/* ── Le premier commentaire — bouton DISTINCT (critère 2) ─────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="admin-h2">Le premier commentaire</h2>
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Un second geste dans LinkedIn — c&apos;est là que va le lien.
              </p>
            </div>
            <BoutonCopier
              texte={publication.premierCommentaire ?? ""}
              libelle="Copier le premier commentaire"
            />
          </div>
          {publication.premierCommentaire ? (
            <pre className="max-h-60 overflow-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 font-sans text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
              {publication.premierCommentaire}
            </pre>
          ) : (
            <p className="text-[color:var(--color-admin-fg-muted)]">Aucun premier commentaire.</p>
          )}
        </AdminCard>
      </div>

      {/* ── Le lien — JAMAIS retapé à la main ────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="admin-h2">Le lien</h2>
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Avec ses marqueurs UTM. Jamais retapé à la main.
              </p>
            </div>
            <BoutonCopier texte={publication.lienUrl ?? ""} libelle="Copier le lien" />
          </div>
          {publication.lienUrl ? (
            <code className="block overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 text-[length:var(--text-admin-xs)]">
              {publication.lienUrl}
            </code>
          ) : (
            <p className="text-[color:var(--color-admin-fg-muted)]">
              Aucun lien. La règle « utm » ne bloquera donc pas la validation.
            </p>
          )}
        </AdminCard>
      </div>

      {/* ── Les médias ──────────────────────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">Les médias</h2>
          {publication.assets.length === 0 ? (
            <p className="text-[color:var(--color-admin-fg-muted)]">
              Publication en texte seul — aucun média à joindre.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {publication.assets.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                  >
                    <span className="min-w-0 truncate">{a.libelle}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <AdminBadge tone="neutral">{a.type}</AdminBadge>
                      <AdminBadge tone={a.statut === "pret" ? "success" : "warning"}>
                        {a.statut}
                      </AdminBadge>
                    </span>
                  </li>
                ))}
              </ul>
              {mediasTelechargeables.length === 0 && (
                // Dire pourquoi le téléchargement n'est pas là vaut mieux que
                // d'afficher un bouton qui rendrait une archive vide.
                <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                  Aucun fichier n&apos;est encore déposé sur ces assets : le téléchargement en
                  archive arrivera avec le glisser-déposer de la médiathèque.
                </p>
              )}
            </>
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
