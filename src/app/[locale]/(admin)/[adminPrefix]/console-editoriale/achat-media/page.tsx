// Console éditoriale — l'achat média (lot 6).
//
// 🔴 Les trois crochets du §1 ter — `EdCompteType.publicitaire`,
// `EdAssetUsage.payant`, `EdPublication.coutCentimes` — existaient depuis le
// lot 0, et RIEN ne les écrivait ni ne les lisait. Le module `cout.ts`, 21
// tests verts, n'était appelé par aucun écran.
//
// Le calcul était juste et n'avait aucune donnée à calculer.
//
// ── Pourquoi un écran séparé de `/analyse` ────────────────────────────────
//
// `/analyse` répond à « qu'est-ce qui marche ». Celui-ci répond à « où va
// l'argent », et ce n'est pas la même question : un post organique qui fait
// deux rendez-vous et une campagne à 300 € qui en fait quatre se comparent
// mal sur la même page. Le §1 ter le dit — `coutCentimes` existe pour « rendre
// comparable un post gratuit et une campagne payante », ce qui suppose de les
// mettre côte à côte, pas de les mélanger.

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
import { prisma } from "@/lib/prisma";
import { dayKeyOfGridDate } from "@/lib/calendar-grid";
import { requireMembreEditorial } from "@/server/actions/editorial/_guards";
import { peut } from "@/server/editorial/permissions";
import { saisirCoutFormAction } from "@/server/actions/editorial/media";
import {
  comparerUsages,
  depensesSansResultat,
  budgetTotal,
  coutParResultat,
  formaterEuros,
  formaterCoutParResultat,
  type PublicationCoutee,
} from "@/server/editorial/cout";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * L'usage d'une publication, déduit de ses assets.
 *
 * ⚠️ Une publication sans asset est `organique` : elle n'a rien coûté. La
 * ranger ailleurs par défaut fausserait la comparaison dès la première ligne.
 */
function usageDe(usages: readonly string[]): PublicationCoutee["usage"] {
  if (usages.length === 0) return "organique";
  if (usages.includes("mixte")) return "mixte";
  const payant = usages.includes("payant");
  const organique = usages.includes("organique");
  if (payant && organique) return "mixte";
  return payant ? "payant" : "organique";
}

export default async function AchatMediaPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const retour = `${base}/achat-media`;

  const moi = await requireMembreEditorial();
  const jePeuxSaisir = peut(moi.role, "metrique.saisir");

  const lignes = await prisma.edPublication.findMany({
    where: { archiveeA: null },
    select: {
      id: true,
      titreInterne: true,
      coutCentimes: true,
      datePrevue: true,
      compte: { select: { libelle: true, identite: true, type: true } },
      assets: { select: { asset: { select: { usage: true } } } },
      // Le dernier relevé fait foi : les métriques s'empilent, elles ne
      // s'écrasent pas (règle du lot 3).
      metriques: {
        orderBy: { releveA: "desc" },
        take: 1,
        select: {
          rdvAttribues: true,
          devisAttribues: true,
          clics: true,
          impressions: true,
        },
      },
    },
    orderBy: [{ coutCentimes: "desc" }, { datePrevue: "desc" }],
  });

  const publications: PublicationCoutee[] = lignes.map((p) => {
    const m = p.metriques[0];
    return {
      publicationId: p.id,
      coutCentimes: p.coutCentimes,
      identite: p.compte.identite as "perso" | "pro",
      usage: usageDe(p.assets.map((a) => a.asset.usage)),
      // 🔴 `null` quand aucun relevé n'existe — surtout pas `0`. La règle du
      // lot 3 vaut ici aussi : « non mesuré » et « n'a rien rapporté » sont
      // deux informations opposées, et les confondre accuserait une campagne
      // qu'on n'a simplement pas relevée.
      rdvAttribues: m?.rdvAttribues ?? null,
      devisAttribues: m?.devisAttribues ?? null,
      clics: m?.clics ?? null,
      impressions: m?.impressions ?? null,
    };
  });

  const bilans = comparerUsages(publications);
  const sansResultat = depensesSansResultat(publications);
  const engage = budgetTotal(publications);
  const payantes = publications.filter((p) => p.coutCentimes > 0);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Achat média"
        description="Où va l'argent, et ce qu'il rapporte — comparé à ce qui n'a rien coûté."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge tone={engage > 0 ? "info" : "neutral"}>
              {formaterEuros(engage)} engagés
            </AdminBadge>
            <AdminBadge tone="neutral">
              {payantes.length} publication{payantes.length > 1 ? "s" : ""} payante
              {payantes.length > 1 ? "s" : ""}
            </AdminBadge>
          </div>
        }
        actions={
          <AdminButton href={`${base}/analyse`} variant="secondary" size="sm">
            Voir l&apos;analyse
          </AdminButton>
        }
      />

      {sp.erreur && (
        <p role="alert" className="admin-alert admin-alert-error">
          {sp.erreur}
        </p>
      )}
      {sp.cout && (
        <p role="status" className="admin-alert admin-alert-success">
          Budget enregistré. Le coût par résultat est recalculé à l&apos;affichage.
        </p>
      )}

      {/* ── Organique contre payant, sur la même échelle ────────────────── */}
      <AdminCard>
        <h2 className="admin-h2 mb-[var(--space-admin-3)]">Organique contre payant</h2>

        {bilans.length === 0 ? (
          <AdminEmptyState
            title="Aucune publication à comparer"
            description="Importez le dossier ou créez une publication : la comparaison a besoin de deux côtés."
          />
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Usage</th>
                  <th scope="col">Publications</th>
                  <th scope="col">Engagé</th>
                  <th scope="col">Rendez-vous</th>
                  <th scope="col">Coût par rendez-vous</th>
                </tr>
              </thead>
              <tbody>
                {bilans.map((b) => (
                  <tr key={b.usage}>
                    <th scope="row">{b.usage}</th>
                    <td>{b.nbPublications}</td>
                    <td>{formaterEuros(b.coutTotalCentimes)}</td>
                    <td>
                      {/* 🔴 « non disponible », jamais « 0 ». Un groupe non
                          relevé et un groupe qui n'a rien rapporté ne se
                          disent pas de la même façon. */}
                      {b.resultats === null ? (
                        <span className="admin-muted">non relevé</span>
                      ) : (
                        <>
                          {b.resultats}
                          <span className="admin-meta-small">
                            {" "}
                            ({b.nbMesurees}/{b.nbPublications} relevée
                            {b.nbMesurees > 1 ? "s" : ""})
                          </span>
                        </>
                      )}
                    </td>
                    <td>
                      <strong>{formaterCoutParResultat(b.coutMoyen)}</strong>
                      {b.coutMoyen.explication && (
                        <p className="admin-meta-small">{b.coutMoyen.explication}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="admin-help mt-[var(--space-admin-3)]">
          {/* Les quatre états de `coutParResultat` sont le cœur du module, et
              ils ne se confondent pas. Les expliquer ici évite qu'on lise
              « gratuit » comme « on ne sait pas ». */}
          <strong>Gratuit</strong> vaut zéro et se compare. <strong>Aucun résultat</strong> veut
          dire qu&apos;on a payé et que rien n&apos;est venu — c&apos;est une information forte, pas
          une absence. <strong>Non mesuré</strong> veut dire qu&apos;on n&apos;a pas relevé : rien
          ne permet encore de juger la dépense.
        </p>
      </AdminCard>

      {/* ── Ce qu'on arrête en premier ──────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
            <h2 className="admin-h2">De l&apos;argent sans résultat</h2>
            {sansResultat.length > 0 && (
              <AdminBadge tone="destructive">
                {formaterEuros(sansResultat.reduce((s, p) => s + p.coutCentimes, 0))}
              </AdminBadge>
            )}
          </div>

          {sansResultat.length === 0 ? (
            <p className="text-[color:var(--color-admin-fg-muted)]">
              {/* Nuance importante : « rien à arrêter » n'est pas « tout va
                  bien ». Une campagne non relevée n'apparaît pas ici, et c'est
                  volontaire — l'accuser reviendrait à confondre « rien
                  rapporté » et « pas mesuré ». */}
              Rien à arrêter : aucune publication payante n&apos;a de relevé à zéro rendez-vous. Les
              campagnes <strong>non relevées</strong> n&apos;apparaissent pas ici — on ne peut pas
              leur reprocher un résultat qu&apos;on n&apos;a pas mesuré.
            </p>
          ) : (
            <ul className="space-y-2">
              {sansResultat.map((p) => {
                const ligne = lignes.find((l) => l.id === p.publicationId);
                return (
                  <li
                    key={p.publicationId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                  >
                    <span className="min-w-0">
                      <Link href={`${base}/publications/${p.publicationId}`} className="admin-link">
                        {ligne?.titreInterne ?? p.publicationId}
                      </Link>
                      <span className="admin-meta-small block">
                        {ligne?.compte.libelle} · {p.usage}
                      </span>
                    </span>
                    <AdminBadge tone="destructive">{formaterEuros(p.coutCentimes)}</AdminBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminCard>
      </div>

      {/* ── La saisie du budget ─────────────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">Budget par publication</h2>

          {!jePeuxSaisir && (
            <p role="status" className="admin-alert admin-alert-info">
              Lecture seule : saisir un budget demande le rôle <strong>production</strong>,{" "}
              <strong>stratège</strong> ou <strong>admin</strong>.
            </p>
          )}

          <p className="admin-help mb-[var(--space-admin-3)]">
            {/* La limite du modèle, dite plutôt que tue : `coutCentimes` a une
                valeur par défaut de 0, donc « non saisi » et « gratuit » sont
                indiscernables. C'est acceptable — une campagne payante dont on
                oublie le budget apparaîtra en « gratuit » dans un groupe
                `payant`, ce qui se voit. */}
            Saisi en euros, stocké en centimes. Un champ vide remet à zéro.{" "}
            <strong>Zéro et « non saisi » sont indiscernables</strong> : une campagne payante dont
            le budget manque apparaîtra en « gratuit » dans le groupe payant — c&apos;est visible,
            et c&apos;est le seul signal disponible.
          </p>

          {lignes.length === 0 ? (
            <AdminEmptyState
              title="Aucune publication"
              description="Rien à budgéter tant que le dossier n'est pas importé."
            />
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Publication</th>
                    <th scope="col">Usage</th>
                    <th scope="col">Rendez-vous</th>
                    <th scope="col">Coût / rdv</th>
                    <th scope="col">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {publications.slice(0, 60).map((p) => {
                    const ligne = lignes.find((l) => l.id === p.publicationId);
                    const cout = coutParResultat(p.coutCentimes, p.rdvAttribues);
                    return (
                      <tr key={p.publicationId}>
                        <th scope="row">
                          <Link
                            href={`${base}/publications/${p.publicationId}`}
                            className="admin-link"
                          >
                            {ligne?.titreInterne}
                          </Link>
                          <span className="admin-meta-small block">
                            {ligne ? dayKeyOfGridDate(ligne.datePrevue) : null}
                          </span>
                        </th>
                        <td>
                          <AdminBadge tone={p.usage === "organique" ? "neutral" : "info"}>
                            {p.usage}
                          </AdminBadge>
                        </td>
                        <td>
                          {p.rdvAttribues === null ? (
                            <span className="admin-muted">non relevé</span>
                          ) : (
                            p.rdvAttribues
                          )}
                        </td>
                        <td>{formaterCoutParResultat(cout)}</td>
                        <td>
                          {jePeuxSaisir ? (
                            <form action={saisirCoutFormAction} className="admin-inline-form">
                              <input type="hidden" name="publicationId" value={p.publicationId} />
                              <input type="hidden" name="retour" value={retour} />
                              <label htmlFor={`euros-${p.publicationId}`} className="admin-label">
                                Budget en euros
                              </label>
                              <input
                                id={`euros-${p.publicationId}`}
                                name="euros"
                                inputMode="decimal"
                                defaultValue={
                                  p.coutCentimes > 0 ? String(p.coutCentimes / 100) : ""
                                }
                                placeholder="0"
                                className="admin-input admin-input-w-sm"
                              />
                              <AdminButton type="submit" variant="secondary" size="sm">
                                Enregistrer
                              </AdminButton>
                            </form>
                          ) : (
                            formaterEuros(p.coutCentimes)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {publications.length > 60 && (
            // 🔑 On DIT qu'on tronque. Une liste coupée en silence se lit
            // comme une liste complète, et le total en bas de page ne
            // correspondrait plus à ce qu'on voit.
            <p className="admin-meta mt-[var(--space-admin-3)]">
              60 publications affichées sur {publications.length}, les plus coûteuses d&apos;abord.
              Les {publications.length - 60} autres sont toutes à budget nul ou plus anciennes —
              elles comptent dans les totaux ci-dessus.
            </p>
          )}
        </AdminCard>
      </div>

      <p className="mt-[var(--space-admin-6)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {/* L'usage d'un asset se règle sur sa fiche, pas ici : c'est une
            propriété de l'asset, et le dupliquer créerait deux endroits où
            corriger la même chose. */}
        L&apos;usage — organique, payant ou mixte — se règle sur la fiche de chaque{" "}
        <Link href={`${base}/mediatheque`} className="admin-link">
          asset
        </Link>
        . Une publication hérite de celui de ses médias, et sans média elle est organique : elle
        n&apos;a rien coûté.
      </p>

      <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
        <Link href={base} className="hover:underline">
          ← Tableau de bord
        </Link>
      </p>
    </AdminPageShell>
  );
}
