// Console éditoriale — la recherche (§3, critère 6 du lot 1).
//
// > « Un seul champ, qui traverse tout : publications, idées, assets,
// >   invités. »
//
// Un `<form method="get">` : la recherche vit dans l'URL, donc elle se
// partage, se met en favori, et le bouton « précédent » fait ce qu'on attend.
// Zéro JavaScript client.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import { chercher, type ResultatRecherche, raisonDuRepli } from "@/server/editorial/recherche";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const LIBELLE_TYPE: Record<ResultatRecherche["type"], string> = {
  publication: "publication",
  idee: "idée",
  asset: "asset",
  invite: "invité",
};

export default async function RecherchePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const terme = (sp.q ?? "").trim();
  const recherche = terme ? await chercher(terme) : null;

  // ⚠️ APRÈS `chercher` : c'est l'appel lui-même qui renseigne la raison.
  const raison = raisonDuRepli();

  /** Où mène un résultat. Un asset n'a pas encore d'écran : on l'annonce. */
  function lienDe(r: ResultatRecherche): string | null {
    if (r.type === "publication") return `${base}/publications/${r.id}`;
    if (r.type === "idee") return `${base}/idees`;
    return null;
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Rechercher"
        description="Un seul champ, qui traverse les publications, les idées, les assets et les invités."
      />

      <AdminCard>
        <form method="get" className="flex flex-wrap gap-2">
          <label htmlFor="q" className="sr-only">
            Rechercher
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={terme}
            autoFocus
            placeholder="Un mot du corps, d'une transcription, d'une idée…"
            className="admin-input min-w-0 flex-1"
          />
          <button type="submit" className="admin-button admin-button-sm">
            Chercher
          </button>
        </form>

        {recherche && (
          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {recherche.resultats.length} résultat
            {recherche.resultats.length > 1 ? "s" : ""}
            {recherche.mode === "repli-contains" && (
              // 🔴 On DIT que la recherche est dégradée. La taire laisserait
              // croire à une recherche pondérée et insensible aux accents qui
              // n'a pas eu lieu — et un « aucun résultat » serait alors un
              // mensonge par omission.
              <>
                {" — "}
                <strong>recherche simplifiée</strong> :{" "}
                {/*
                  🔴 Deux causes DIFFÉRENTES, deux messages.

                  Défaut trouvé par la passe 2 du protocole : ce bandeau
                  affirmait « l'index n'est pas posé » y compris quand il
                  l'était, parce que le repli rangeait « la requête a
                  échoué » sous « l'index est absent ». Envoyer quelqu'un
                  appliquer une migration déjà appliquée lui coûte une
                  heure — un diagnostic faux est pire qu'un silence.
                */}
                {raison ? (
                  <>
                    l&apos;index est bien posé, mais la requête plein texte a échoué. Les accents et
                    la pertinence ne sont pas pris en compte. Erreur remontée par la base :{" "}
                    <code className="admin-code-inline">{raison}</code>
                  </>
                ) : (
                  <>
                    l&apos;index plein texte n&apos;est pas posé sur cette base. Les accents et la
                    pertinence ne sont pas pris en compte. Appliquez{" "}
                    <code className="admin-code-inline">
                      prisma/migrations_fts/editorial_fts.sql
                    </code>
                    .
                  </>
                )}
              </>
            )}
          </p>
        )}
      </AdminCard>

      {recherche && (
        <div className="mt-[var(--space-admin-4)]">
          <AdminCard>
            {recherche.resultats.length === 0 ? (
              <AdminEmptyState
                title={`Rien pour « ${terme} »`}
                description={
                  recherche.mode === "repli-contains"
                    ? "La recherche simplifiée ne trouve que les correspondances exactes, accents compris. Essayez une autre orthographe, ou posez l'index plein texte."
                    : "Essayez un autre mot, ou une racine plus courte : la recherche cherche des mots entiers, pas des fragments."
                }
              />
            ) : (
              <ul className="space-y-2">
                {recherche.resultats.map((r) => {
                  const lien = lienDe(r);
                  const contenu = (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminBadge tone={r.type === "publication" ? "info" : "neutral"}>
                          {LIBELLE_TYPE[r.type]}
                        </AdminBadge>
                        <strong className="min-w-0">{r.titre}</strong>
                      </div>
                      {r.extrait && (
                        <p className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                          {r.extrait}
                        </p>
                      )}
                    </>
                  );
                  return (
                    <li
                      key={`${r.type}-${r.id}`}
                      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                    >
                      {lien ? (
                        <Link href={lien} className="block hover:underline">
                          {contenu}
                        </Link>
                      ) : (
                        contenu
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminCard>
        </div>
      )}
    </AdminPageShell>
  );
}
