// Console éditoriale — l'analyse (§3, lot 3).
//
// Server Component. Les barres sont des `<div>` dimensionnés côté serveur :
// une comparaison n'a pas besoin d'être interactive pour être lisible, et
// aucune bibliothèque de graphiques ne justifierait son poids ici.
//
// 🔴 Le fil conducteur de cet écran : ne JAMAIS afficher `0` là où la réponse
// est « on ne sait pas ». C'est le critère 4 du lot, et c'est aussi ce qui
// décide si les chiffres méritent qu'on prenne une décision dessus.

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
import { prisma } from "@/lib/prisma";
import { dayKeyOfGridDate } from "@/lib/calendar-grid";
import {
  analyserParFamille,
  comparerIdentites,
  partSurEchelle,
  ratioIdentite,
  formaterAgregat,
  METRIQUES,
  LIBELLES,
  type CleMetrique,
  type ReleveMetrique,
  type LignePublicationMesuree,
} from "@/server/editorial/analyse";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Les métriques mises en avant. `rdvAttribues` d'abord : c'est celle qui compte. */
const EN_AVANT: CleMetrique[] = ["rdvAttribues", "clics", "impressions", "reactions"];

export default async function AnalysePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const metriquePrincipale = (
    METRIQUES.includes(sp.metrique as CleMetrique) ? sp.metrique : "rdvAttribues"
  ) as CleMetrique;

  const [lignesPublications, lignesReleves] = await Promise.all([
    prisma.edPublication.findMany({
      where: { archiveeA: null },
      select: {
        id: true,
        compte: { select: { libelle: true, identite: true } },
        assets: { select: { asset: { select: { famille: { select: { nom: true } } } } }, take: 1 },
      },
    }),
    prisma.edMetrique.findMany({
      select: {
        publicationId: true,
        releveA: true,
        impressions: true,
        reactions: true,
        commentaires: true,
        partages: true,
        clics: true,
        abonnesGagnes: true,
        vuesCompletes: true,
        ouvertures: true,
        rdvAttribues: true,
        devisAttribues: true,
      },
      orderBy: { releveA: "desc" },
    }),
  ]);

  const publications: LignePublicationMesuree[] = lignesPublications.map((p) => ({
    publicationId: p.id,
    familleNom: p.assets[0]?.asset.famille?.nom ?? null,
    identite: p.compte.identite,
    compteLibelle: p.compte.libelle,
  }));
  const releves: ReleveMetrique[] = lignesReleves;

  const parFamille = analyserParFamille(publications, releves, metriquePrincipale);
  const comparaison = comparerIdentites(publications, releves);
  const ratio = ratioIdentite(publications);
  const publicationsMesurees = new Set(releves.map((r) => r.publicationId)).size;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Analyse"
        description={`${publications.length} publication${publications.length > 1 ? "s" : ""}, dont ${publicationsMesurees} relevée${publicationsMesurees > 1 ? "s" : ""}.`}
      />

      {publicationsMesurees === 0 ? (
        <AdminCard>
          <AdminEmptyState
            title="Aucun relevé"
            description="L'analyse repose sur des relevés saisis à la main depuis chaque publication. Tant qu'il n'y en a aucun, mieux vaut un écran qui le dit que des graphiques à zéro — un zéro inventé fait prendre de vraies décisions sur du vide."
          />
        </AdminCard>
      ) : null}

      {/* ── La couverture : sur quoi ces chiffres reposent ───────────────── */}
      <AdminCard>
        <h2 className="admin-h2 mb-[var(--space-admin-3)]">Ce que couvrent ces chiffres</h2>
        <p className="text-[color:var(--color-admin-fg-muted)]">
          {publicationsMesurees} publication{publicationsMesurees > 1 ? "s" : ""} relevée
          {publicationsMesurees > 1 ? "s" : ""} sur {publications.length}
          {publications.length > 0 && (
            <>
              {" "}
              — soit {Math.round((publicationsMesurees / publications.length) * 100)} % du dossier.
            </>
          )}
        </p>
        <p className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Seul le dernier relevé de chaque publication est compté : un relevé est un instantané
          cumulatif, pas un incrément. Les additionner compterait plusieurs fois les mêmes
          impressions.
        </p>
      </AdminCard>

      {/* ── La comparaison perso / pro — critère 3 ───────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
            <h2 className="admin-h2">Personnel contre professionnel</h2>
            {ratio && (
              <AdminBadge tone="info">
                {ratio.perso} % perso · {ratio.pro} % pro
              </AdminBadge>
            )}
          </div>

          <table className="w-full text-[length:var(--text-admin-sm)]">
            <caption className="sr-only">
              Comparaison des métriques entre l&apos;identité personnelle et professionnelle, sur
              une échelle commune
            </caption>
            <thead>
              <tr className="text-left text-[color:var(--color-admin-fg-muted)]">
                <th scope="col" className="pb-2">
                  Métrique
                </th>
                {comparaison.series.map((s) => (
                  <th key={s.identite} scope="col" className="pb-2">
                    {s.identite === "perso" ? "Personnel" : "Professionnel"}{" "}
                    <span className="font-normal">({s.nbPublications})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EN_AVANT.map((m) => (
                <tr key={m} className="border-t border-[color:var(--color-admin-border)]">
                  <th scope="row" className="py-2 text-left font-medium">
                    {LIBELLES[m]}
                  </th>
                  {comparaison.series.map((s) => {
                    const agregat = s.agregats[m];
                    const part = partSurEchelle(agregat.valeur, comparaison.echelle[m]);
                    return (
                      <td key={s.identite} className="py-2">
                        <span className="block font-medium">{formaterAgregat(agregat)}</span>
                        {/* La barre n'apparaît QUE si la valeur existe : une
                            barre vide se confondrait avec une mesure à zéro. */}
                        {part !== null ? (
                          <span
                            aria-hidden="true"
                            className="mt-1 block h-2 rounded-full bg-[color:var(--color-admin-surface-hover)]"
                          >
                            <span
                              className="block h-2 rounded-full bg-[color:var(--color-admin-accent)]"
                              style={{ width: `${part}%` }}
                            />
                          </span>
                        ) : (
                          <span className="mt-1 block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                            rien de relevé
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Les deux séries partagent la même échelle : la barre la plus longue vaut le maximum des
            deux identités, jamais le maximum de sa propre colonne.
          </p>
        </AdminCard>
      </div>

      {/* ── Par format — critère 2 ───────────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
            <h2 className="admin-h2">Par format</h2>
            <nav aria-label="Métrique de classement" className="flex flex-wrap gap-1">
              {EN_AVANT.map((m) => (
                <Link
                  key={m}
                  href={`${base}/analyse${m === "rdvAttribues" ? "" : `?metrique=${m}`}`}
                  aria-current={m === metriquePrincipale ? "true" : undefined}
                  className={
                    m === metriquePrincipale
                      ? "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] font-semibold text-white"
                      : "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-hover)]"
                  }
                >
                  {LIBELLES[m]}
                </Link>
              ))}
            </nav>
          </div>

          {parFamille.length === 0 ? (
            <AdminEmptyState
              variant="inline"
              title="Aucun format"
              description="Aucune publication."
            />
          ) : (
            <ul className="space-y-2">
              {parFamille.map((ligne) => (
                <li
                  key={ligne.cle}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{ligne.libelle}</span>
                    <span className="block text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                      {ligne.nbPublications} publication{ligne.nbPublications > 1 ? "s" : ""} ·{" "}
                      {ligne.principal.nbReleves} relevée{ligne.principal.nbReleves > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-medium">{formaterAgregat(ligne.principal)}</span>
                    <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {LIBELLES[metriquePrincipale].toLowerCase()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Les formats non relevés restent affichés, en « non disponible » : les écarter laisserait
            croire qu&apos;ils n&apos;existent pas, alors qu&apos;ils sont seulement non mesurés.
          </p>
        </AdminCard>
      </div>

      <p className="mt-[var(--space-admin-6)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Dernier relevé du dossier :{" "}
        {lignesReleves[0]
          ? dayKeyOfGridDate(lignesReleves[0].releveA).split("-").reverse().join("/")
          : "aucun"}
      </p>
    </AdminPageShell>
  );
}
