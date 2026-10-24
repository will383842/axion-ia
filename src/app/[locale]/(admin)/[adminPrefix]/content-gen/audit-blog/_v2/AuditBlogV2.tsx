// Audit de l'existant du blog (lot L10) — AdminPageShell + AdminCard.
//
// Aucun geste de masse : une ligne = un article = un clic. Les gestes sont les
// actions serveur EXISTANTES (`demoteArticle`, `archiveArticle`), qui
// rafraîchissent le cache des pages, signalent l'URL retirée et écrivent le
// journal d'activité. Retour en arrière : « Restaurer » dans Publications
// (`unarchiveArticle`), puis re-promotion explicite.

import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { archiveArticle, demoteArticle } from "@/server/actions/content-gen/article";
import { raisonInterdit } from "@/lib/contenu/interdits-publication";
import { buildArticlePath } from "@/server/content-gen/indexing/url-builder";
import {
  CATEGORIES_AUDIT,
  peutRetirerDeGoogle,
  SEUIL_MOTS_COURT,
  type CategorieAudit,
  type DescriptionCategorie,
  type LigneAudit,
} from "@/server/content-gen/audit-blog-existant";
import type { AuditBlogCharge, TraficGsc } from "@/server/content-gen/lecture-audit-blog";

interface Props {
  readonly adminPrefix: string;
  readonly audit: AuditBlogCharge;
}

/** Catégories pour lesquelles on montre le trafic Search Console. */
const AVEC_TRAFIC: ReadonlySet<CategorieAudit> = new Set<CategorieAudit>([
  "grenoble",
  "tres-courts",
]);

function Geste({
  adminPrefix,
  ligne,
  geste,
}: {
  readonly adminPrefix: string;
  readonly ligne: LigneAudit;
  readonly geste: DescriptionCategorie["geste"];
}) {
  const pageAudit = `/fr/${adminPrefix}/content-gen/audit-blog`;

  async function retirer() {
    "use server";
    await demoteArticle(ligne.id);
    revalidatePath(pageAudit);
  }
  async function archiver() {
    "use server";
    await archiveArticle(ligne.id);
    revalidatePath(pageAudit);
  }

  if (geste === "liste-seule") {
    return <span className="admin-meta-block">Aucun geste : décision de Will</span>;
  }
  if (geste === "retirer-de-google") {
    return peutRetirerDeGoogle(ligne) ? (
      <form action={retirer}>
        <button
          type="submit"
          className="admin-button-ghost admin-button-xs"
          title="Rend l'article non indexé (réversible : Publications, puis re-promotion). La page reste en ligne."
        >
          Retirer de Google
        </button>
      </form>
    ) : (
      <span className="admin-meta-block">Déjà hors de Google</span>
    );
  }
  return (
    <form action={archiver}>
      <button
        type="submit"
        className="admin-button-ghost admin-button-xs"
        title="Dépublie l'article (réversible : bouton Restaurer dans Publications)."
      >
        Archiver
      </button>
    </form>
  );
}

function trafic(t: TraficGsc | undefined): string {
  if (!t) return "—";
  return `${t.clics} clic${t.clics > 1 ? "s" : ""} · ${t.impressions} impr.`;
}

function colonnes(
  adminPrefix: string,
  d: DescriptionCategorie,
  audit: AuditBlogCharge,
): ReadonlyArray<AdminTableColumn<LigneAudit>> {
  const cols: Array<AdminTableColumn<LigneAudit>> = [
    {
      key: "article",
      header: "Article",
      cell: (l) => (
        <div>
          <Link
            href={buildArticlePath({
              slug: l.slug,
              isNews: l.isNews,
              templateVariant: l.templateVariant,
            })}
            className="admin-link"
            target="_blank"
          >
            {l.titre}
          </Link>
          <div className="admin-meta-block">
            {l.slug} · {l.mots} mots
            {l.qualityScore !== null ? ` · note ${l.qualityScore}` : ""}
          </div>
        </div>
      ),
    },
  ];

  if (d.id === "avis-signes") {
    cols.push({ key: "signataire", header: "Signé par", cell: (l) => l.signataire ?? "—" });
  } else if (d.id === "doublons") {
    cols.push({ key: "famille", header: "Famille", cell: (l) => l.famille ?? "—" });
  } else if (d.id !== "test-publie" && d.id !== "tres-courts") {
    cols.push({
      key: "constats",
      header: "Ce qui a été trouvé",
      cell: (l) =>
        l.constats.length === 0 ? (
          "Adresse du type « cas concret »"
        ) : (
          <ul className="admin-meta-block">
            {l.constats.map((c) => (
              <li key={`${c.code}-${c.champ}`} title={raisonInterdit(c.code)}>
                <strong>{c.code}</strong> ({c.champ}) : « {c.extrait} »
              </li>
            ))}
          </ul>
        ),
    });
  }

  if (AVEC_TRAFIC.has(d.id)) {
    cols.push({
      key: "trafic",
      header: `Search Console (${audit.fenetreJours} j)`,
      cell: (l) => trafic(audit.trafic.get(l.id)),
    });
  }

  cols.push({
    key: "indexation",
    header: "Indexation",
    cell: (l) =>
      l.indexationTier === "tier_1_indexable" ? (
        <AdminBadge tone="success">Indexé</AdminBadge>
      ) : (
        <AdminBadge tone="neutral">Non indexé</AdminBadge>
      ),
  });
  cols.push({
    key: "geste",
    header: "Geste",
    cell: (l) => <Geste adminPrefix={adminPrefix} ligne={l} geste={d.geste} />,
  });
  return cols;
}

export function AuditBlogV2({ adminPrefix, audit }: Props): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Audit de l'existant du blog"
        description={`${audit.totalPublies} articles publiés contrôlés avec les règles de publication. Rien n'est modifié tant que vous ne cliquez pas, article par article.`}
      />

      <AdminCard>
        <p className="admin-meta-block">
          Aucune action en masse, aucune suppression. « Retirer de Google » rend l&apos;article non
          indexé sans le dépublier ; « Archiver » le dépublie. Les deux se défont : bouton «
          Restaurer » dans Publications, puis nouvelle promotion. Les listes « Grenoble » et « moins
          de {SEUIL_MOTS_COURT} mots » n&apos;ont volontairement aucun bouton : la décision est
          celle de Will, avec le trafic Search Console sous les yeux.
          {audit.gscDisponible
            ? ""
            : " Search Console n'a pas répondu depuis ce serveur : le trafic est affiché « — »."}
        </p>
      </AdminCard>

      {CATEGORIES_AUDIT.map((d) => {
        const lignes = audit.resultat[d.id];
        return (
          <AdminCard key={d.id}>
            <h2 className="admin-h2">
              {d.titre}{" "}
              <AdminBadge tone={lignes.length > 0 ? "warning" : "success"}>
                {lignes.length}
              </AdminBadge>
            </h2>
            <p className="admin-meta-block">{d.explication}</p>
            {lignes.length === 0 ? (
              <AdminEmptyState title="Aucun article dans cette catégorie." />
            ) : (
              <AdminTable
                columns={colonnes(adminPrefix, d, audit)}
                rows={lignes}
                getRowId={(l) => l.id}
                caption={d.titre}
              />
            )}
          </AdminCard>
        );
      })}
    </AdminPageShell>
  );
}
