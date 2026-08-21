// Console éditoriale — un asset, son arbre, sa source (critères 2 et 3, lot 2).
//
// > « L'arbre d'un épisode affiche extraits, shorts et variantes sur TROIS
// >   NIVEAUX. »
// > « Depuis un short, on remonte à l'épisode ET À LA SECONDE d'origine. »
//
// Les deux se lisent sur cet écran : la remontée en haut (d'où vient cet
// asset), l'arbre en bas (ce qu'il a produit). Server Component pur.

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
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
import { urlPublique } from "@/server/editorial/stockage";
import {
  construireArbre,
  aplatir,
  profondeurDe,
  remonterALaSource,
  detecterCycle,
  formaterSeconde,
  type AssetDerivable,
} from "@/server/editorial/derivation";
import {
  soumettreAssetRevueFormAction,
  passerAssetPretFormAction,
  appliquerRecetteFormAction,
  rattacherAssetFormAction,
  assignerAssetFormAction,
  detacherAssetFormAction,
} from "@/server/actions/editorial/formulaires";
import { refuserAssetFormAction } from "@/server/actions/editorial/equipe";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Charge l'asset, toute sa descendance ET toute son ascendance.
 *
 * Les deux sens sont nécessaires : la descendance fait l'arbre, l'ascendance
 * fait la remontée à la source. Une seule récursive SQL les couvre, en
 * partant de la racine ultime.
 */
async function chargerVoisinage(id: string): Promise<AssetDerivable[]> {
  return prisma.$queryRaw<AssetDerivable[]>`
    WITH RECURSIVE ascendance AS (
      SELECT id, parent_id, 0 AS niveau FROM ed_assets WHERE id = ${id}::uuid
      UNION ALL
      SELECT a.id, a.parent_id, ascendance.niveau + 1
      FROM ed_assets a JOIN ascendance ON a.id = ascendance.parent_id
      WHERE ascendance.niveau < 10
    ),
    racine AS (
      SELECT id FROM ascendance WHERE parent_id IS NULL
      UNION ALL
      -- Si aucune racine n'est trouvée (arbre tronqué par la borne, ou
      -- cycle), on retombe sur l'asset lui-même : mieux vaut un arbre
      -- partiel qu'un écran vide.
      SELECT ${id}::uuid WHERE NOT EXISTS (SELECT 1 FROM ascendance WHERE parent_id IS NULL)
    ),
    descendance AS (
      SELECT a.*, 0 AS niveau FROM ed_assets a WHERE a.id IN (SELECT id FROM racine)
      UNION ALL
      SELECT a.*, descendance.niveau + 1
      FROM ed_assets a JOIN descendance ON a.parent_id = descendance.id
      WHERE descendance.niveau < 10
    )
    SELECT DISTINCT id::text AS id, libelle, type::text AS type, nature::text AS nature,
           statut::text AS statut, parent_id::text AS "parentId",
           offset_source_sec AS "offsetSourceSec", famille_id::text AS "familleId",
           duree_sec AS "dureeSec"
    FROM descendance
  `;
}

export default async function FicheAssetPage({ params, searchParams }: PageProps) {
  const { adminPrefix, id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;

  const asset = await prisma.edAsset.findUnique({
    where: { id },
    select: {
      id: true,
      libelle: true,
      type: true,
      nature: true,
      statut: true,
      familleId: true,
      parentId: true,
      offsetSourceSec: true,
      responsableId: true,
      cheminObjet: true,
      cheminVignette: true,
      emplacementExterne: true,
      dureeSec: true,
      largeurPx: true,
      hauteurPx: true,
      poidsOctets: true,
      revueCommentaire: true,
      invitesLies: {
        select: {
          autorisationStatut: true,
          valableJusquA: true,
          invite: { select: { nom: true, entreprise: true } },
        },
      },
      publications: {
        select: { publication: { select: { id: true, titreInterne: true } } },
      },
    },
  });
  if (!asset) notFound();

  // Les recettes APPLICABLES : celles dont la famille source est celle de
  // cet asset. En proposer d'autres produirait des derives sans rapport.
  const recettes = asset.familleId
    ? await prisma.edRecette.findMany({
        where: { actif: true, familleSourceId: asset.familleId },
        select: { id: true, nom: true },
        orderBy: { nom: "asc" },
      })
    : [];

  const voisinage = await chargerVoisinage(id);
  const cycle = detecterCycle(voisinage);
  const chemin = cycle ? null : remonterALaSource(voisinage, id);
  const racineId = chemin?.racine.id ?? id;
  const arbre = cycle ? null : construireArbre(voisinage, racineId);
  const noeuds = arbre ? aplatir(arbre) : [];

  // Les parents proposables : tout sauf cet asset et sa DESCENDANCE.
  // L'écran écarte ainsi la moitié des cycles avant le clic — mais il ne
  // remplace pas la garde de l'action, qui reste seule à faire foi.
  const interdits = new Set([id, ...noeuds.map((n) => n.asset.id)]);
  const [parentsPossibles, membres] = await Promise.all([
    prisma.edAsset.findMany({
      where: { id: { notIn: [...interdits] } },
      select: { id: true, libelle: true },
      orderBy: { libelle: "asc" },
      take: 200,
    }),
    prisma.edMembre.findMany({
      where: { actif: true },
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={asset.libelle}
        description={`${asset.type} · ${asset.nature.replace("_", " ")}`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge tone={asset.statut === "pret" ? "success" : "warning"}>
              {asset.statut}
            </AdminBadge>
            {asset.dureeSec !== null && (
              <AdminBadge tone="neutral">{formaterSeconde(asset.dureeSec)}</AdminBadge>
            )}
            {asset.largeurPx && asset.hauteurPx && (
              <AdminBadge tone="neutral">
                {asset.largeurPx}×{asset.hauteurPx}
              </AdminBadge>
            )}
          </div>
        }
      />

      {cycle && (
        // Un cycle « bloque l'application entière » : on le DIT au lieu de
        // rendre un écran vide ou de boucler.
        <div
          role="alert"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-3 text-[color:var(--color-admin-destructive-fg)]"
        >
          {cycle.message} L&apos;arbre n&apos;est pas affichable tant qu&apos;il n&apos;est pas
          défait.
        </div>
      )}

      {/* ── Les gestes ──────────────────────────────────────────────────── */}
      {/*
        🔴 Ajouté après la passe 5 du protocole.

        `soumettreAssetRevue`, `passerAssetPret`, `refuserAsset` et
        `appliquerRecette` existaient depuis le lot 2 et n'étaient appelées
        par aucun écran. Le critère 5 du lot 2 — « un asset dont la durée
        dépasse la spec ne passe pas à `pret` » — se vérifie en CLIQUANT ; il
        n'était donc pas vérifiable.

        ⚠️ La séparation des rôles du §4 se lit dans cette carte : le rôle
        `montage` peut SOUMETTRE, pas VALIDER. Les deux boutons sont côte à
        côte, mais l'action `passerAssetPret` exige `asset.valider`, et
        refusera en nommant le rôle. La passe 5 avait trouvé un contournement
        par le téléversement — fermé depuis.
      */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">Les gestes</h2>

          {sp.erreur && (
            <p role="alert" className="admin-alert admin-alert-error">
              {sp.erreur}
            </p>
          )}
          {sp.soumis && (
            <p role="status" className="admin-alert admin-alert-success">
              Asset soumis à la revue.
            </p>
          )}
          {sp.pret && (
            <p role="status" className="admin-alert admin-alert-success">
              Asset validé — il est prêt à partir.
            </p>
          )}
          {sp.avertissement && (
            <p role="status" className="admin-alert admin-alert-warning">
              {sp.avertissement}
            </p>
          )}
          {sp.refuse && (
            <p role="status" className="admin-alert admin-alert-info">
              Asset refusé — le commentaire est visible ci-dessus.
            </p>
          )}
          {sp.derives && (
            <p role="status" className="admin-alert admin-alert-success">
              {sp.derives} dérivé(s) créé(s) en « à produire ».
            </p>
          )}

          <div className="admin-actions-row">
            {asset.statut === "en_cours" && (
              <form action={soumettreAssetRevueFormAction}>
                <input type="hidden" name="assetId" value={id} />
                <input type="hidden" name="retour" value={`${base}/mediatheque/${id}`} />
                <AdminButton type="submit" variant="secondary" size="sm">
                  Soumettre à la revue
                </AdminButton>
              </form>
            )}

            {asset.statut === "a_valider" && (
              <form action={passerAssetPretFormAction}>
                <input type="hidden" name="assetId" value={id} />
                <input type="hidden" name="retour" value={`${base}/mediatheque/${id}`} />
                <AdminButton type="submit" variant="primary" size="sm">
                  Valider — passer à prêt
                </AdminButton>
              </form>
            )}
          </div>

          {asset.statut === "a_valider" && (
            <form action={refuserAssetFormAction} className="admin-form-refuse">
              <input type="hidden" name="assetId" value={id} />
              <input type="hidden" name="retour" value={`${base}/mediatheque/${id}`} />
              <label htmlFor="commentaire" className="admin-label">
                Refuser — en disant quoi refaire
              </label>
              <textarea
                id="commentaire"
                name="commentaire"
                rows={2}
                required
                className="admin-textarea"
                placeholder="Le sous-titrage déborde sur les trois dernières secondes."
              />
              <p className="admin-help">
                Le commentaire est obligatoire : un refus sans consigne renvoie le monteur à un
                aller-retour de plus.
              </p>
              <div className="admin-form-actions">
                <AdminButton type="submit" variant="danger" size="sm">
                  Refuser
                </AdminButton>
              </div>
            </form>
          )}

          {recettes.length > 0 && (
            <form action={appliquerRecetteFormAction} className="admin-inline-form">
              <input type="hidden" name="assetId" value={id} />
              <input type="hidden" name="retour" value={`${base}/mediatheque/${id}`} />
              <label htmlFor="recetteId" className="admin-label">
                Appliquer une recette de dérivation
              </label>
              <select id="recetteId" name="recetteId" className="admin-select" required>
                <option value="">Choisir…</option>
                {recettes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nom}
                  </option>
                ))}
              </select>
              <AdminButton type="submit" variant="secondary" size="sm">
                Créer les dérivés
              </AdminButton>
            </form>
          )}

          {/* ── Rattacher / détacher — critère 2 du lot 2 ─────────────────── */}
          {/*
            🔴 Ce geste porte la garde anti-cycle corrigée par la passe 4.
            Tant qu'aucun écran ne l'appelait, la garde n'était pas
            vérifiable : le §1 du protocole veut qu'une garde rougisse « sur
            l'objet qui casse », et un objet qu'on ne peut pas soumettre ne
            casse jamais rien.

            Le sélecteur ne propose que des assets qui NE SONT PAS dans la
            descendance de celui-ci — la moitié des cycles est donc écartée
            avant même le clic. Mais l'écran ne remplace pas la garde : il
            reste possible de forger une requête, et c'est l'action qui
            refuse pour de bon.
          */}
          <form action={rattacherAssetFormAction} className="admin-inline-form">
            <input type="hidden" name="assetId" value={id} />
            <input type="hidden" name="retour" value={`${base}/mediatheque/${id}`} />
            <label htmlFor="parentId" className="admin-label">
              Dérivé de
            </label>
            <select
              id="parentId"
              name="parentId"
              defaultValue={asset.parentId ?? ""}
              className="admin-select"
            >
              <option value="">— autonome (détacher) —</option>
              {parentsPossibles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                </option>
              ))}
            </select>
            <label htmlFor="offsetSourceSec" className="admin-label">
              Position dans la source (secondes)
            </label>
            <input
              id="offsetSourceSec"
              name="offsetSourceSec"
              type="number"
              min={0}
              defaultValue={asset.offsetSourceSec ?? ""}
              className="admin-input admin-input-w-sm"
            />
            <AdminButton type="submit" variant="secondary" size="sm">
              Enregistrer le rattachement
            </AdminButton>
          </form>

          {/* ── Qui s'en occupe — critère 1 du lot 4 ─────────────────────── */}
          {membres.length > 0 && (
            <form action={assignerAssetFormAction} className="admin-inline-form">
              <input type="hidden" name="assetId" value={id} />
              <input type="hidden" name="retour" value={`${base}/mediatheque/${id}`} />
              <label htmlFor="membreId" className="admin-label">
                Responsable
              </label>
              <select
                id="membreId"
                name="membreId"
                defaultValue={asset.responsableId ?? ""}
                className="admin-select"
              >
                {/* Reprendre un asset à quelqu'un est un geste aussi
                    légitime que le lui confier. */}
                <option value="">— personne —</option>
                {membres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}
                  </option>
                ))}
              </select>
              <AdminButton type="submit" variant="secondary" size="sm">
                Assigner
              </AdminButton>
            </form>
          )}
        </AdminCard>
      </div>

      {/* ── D'où vient cet asset — critère 3 ─────────────────────────────── */}
      {chemin && chemin.chaine.length > 1 && (
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">D&apos;où il vient</h2>
          <ol className="flex flex-wrap items-center gap-2 text-[length:var(--text-admin-sm)]">
            {[...chemin.chaine].reverse().map((a, i, tous) => (
              <li key={a.id} className="flex items-center gap-2">
                {a.id === id ? (
                  <strong>{a.libelle}</strong>
                ) : (
                  <Link href={`${base}/mediatheque/${a.id}`} className="hover:underline">
                    {a.libelle}
                  </Link>
                )}
                {i < tous.length - 1 && (
                  <span aria-hidden="true" className="text-[color:var(--color-admin-fg-muted)]">
                    ›
                  </span>
                )}
              </li>
            ))}
          </ol>

          {chemin.secondeDansLaRacine !== null ? (
            <p className="mt-[var(--space-admin-3)]">
              Position dans <strong>{chemin.racine.libelle}</strong> :{" "}
              <strong className="font-mono">{formaterSeconde(chemin.secondeDansLaRacine)}</strong>
              <span className="block text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Somme des décalages le long du chemin — pas le décalage du dernier maillon.
              </span>
            </p>
          ) : (
            <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Position dans la source inconnue : un maillon du chemin ne porte pas son décalage.
              Mieux vaut ne rien dire qu&apos;indiquer une position fausse.
            </p>
          )}
        </AdminCard>
      )}

      {/* ── Le fichier ───────────────────────────────────────────────────── */}
      <div className={chemin && chemin.chaine.length > 1 ? "mt-[var(--space-admin-4)]" : ""}>
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">Le fichier</h2>
          {asset.cheminObjet ? (
            <div className="flex flex-wrap items-center gap-3">
              {asset.cheminVignette && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlPublique(asset.cheminVignette)}
                  alt=""
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-[var(--radius-admin-md)] object-cover"
                />
              )}
              <div className="min-w-0">
                <a
                  href={urlPublique(asset.cheminObjet)}
                  className="admin-button-secondary admin-button-sm"
                >
                  Télécharger
                </a>
                {asset.poidsOctets !== null && (
                  <p className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    {(Number(asset.poidsOctets) / (1024 * 1024)).toFixed(1)} Mo
                  </p>
                )}
              </div>
            </div>
          ) : asset.emplacementExterne ? (
            <p>
              Sur le volume de montage :{" "}
              <code className="admin-code-inline">{asset.emplacementExterne}</code>
              <span className="mt-1 block text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Les rushes ne passent jamais par l&apos;outil (§5).
              </span>
            </p>
          ) : (
            <AdminEmptyState
              variant="inline"
              title="Aucun fichier"
              description="Cet asset est à produire : la recette l'a créé, le montage ne l'a pas encore livré."
            />
          )}
        </AdminCard>
      </div>

      {/* ── Le droit à l'image — la garde du critère 4 ───────────────────── */}
      {asset.invitesLies.length > 0 && (
        <div className="mt-[var(--space-admin-4)]">
          <AdminCard>
            <h2 className="admin-h2 mb-[var(--space-admin-3)]">Droit à l&apos;image</h2>
            <ul className="space-y-2">
              {asset.invitesLies.map((l) => {
                const signee = l.autorisationStatut === "signee";
                return (
                  <li
                    key={l.invite.nom}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                  >
                    <span>
                      <strong>{l.invite.nom}</strong>
                      {l.invite.entreprise && (
                        <span className="text-[color:var(--color-admin-fg-muted)]">
                          {" "}
                          — {l.invite.entreprise}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {l.valableJusquA && (
                        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                          jusqu&apos;au {l.valableJusquA.toISOString().slice(0, 10)}
                        </span>
                      )}
                      <AdminBadge tone={signee ? "success" : "destructive"}>
                        {l.autorisationStatut}
                      </AdminBadge>
                    </span>
                  </li>
                );
              })}
            </ul>
            {asset.invitesLies.some((l) => l.autorisationStatut !== "signee") && (
              <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive-fg)]">
                Tant qu&apos;une autorisation n&apos;est pas signée, aucune publication portant cet
                asset ne peut être programmée. Une autorisation envoyée ne vaut pas consentement.
              </p>
            )}
          </AdminCard>
        </div>
      )}

      {/* ── L'arbre — critère 2, trois niveaux ───────────────────────────── */}
      <div className="mt-[var(--space-admin-4)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
            <h2 className="admin-h2">L&apos;arbre de dérivation</h2>
            {arbre && (
              <AdminBadge tone="info">
                {noeuds.length} asset(s) · profondeur {profondeurDe(arbre)}
              </AdminBadge>
            )}
          </div>

          {!arbre || noeuds.length <= 1 ? (
            <AdminEmptyState
              variant="inline"
              title="Aucun dérivé"
              description="Cet asset n'a produit ni extrait, ni short, ni variante. Appliquez une recette pour créer ses dérivés en « à produire »."
            />
          ) : (
            <ul className="space-y-1">
              {noeuds.map((n) => (
                <li
                  key={n.asset.id}
                  style={{ marginLeft: `${n.profondeur * 20}px` }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {n.profondeur > 0 && (
                      <span aria-hidden="true" className="text-[color:var(--color-admin-fg-muted)]">
                        └
                      </span>
                    )}
                    {n.asset.id === id ? (
                      <strong className="truncate">{n.asset.libelle}</strong>
                    ) : (
                      <Link
                        href={`${base}/mediatheque/${n.asset.id}`}
                        className="truncate hover:underline"
                      >
                        {n.asset.libelle}
                      </Link>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {n.asset.offsetSourceSec !== null && n.profondeur > 0 && (
                      <span className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        +{formaterSeconde(n.asset.offsetSourceSec)}
                      </span>
                    )}
                    <AdminBadge tone="neutral">{n.asset.nature.replace("_", " ")}</AdminBadge>
                    <AdminBadge tone={n.asset.statut === "pret" ? "success" : "warning"}>
                      {n.asset.statut}
                    </AdminBadge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      {asset.publications.length > 0 && (
        <div className="mt-[var(--space-admin-4)]">
          <AdminCard>
            <h2 className="admin-h2 mb-[var(--space-admin-3)]">Utilisé par</h2>
            <ul className="space-y-1">
              {asset.publications.map((p) => (
                <li key={p.publication.id} className="admin-actions-row">
                  <Link
                    href={`${base}/publications/${p.publication.id}`}
                    className="hover:underline"
                  >
                    {p.publication.titreInterne}
                  </Link>
                  {/*
                    ⚠️ Détacher retire le LIEN, pas l'asset — le fichier et
                    son arbre survivent. Le §4 réserve « supprimer quoi que
                    ce soit » à l'admin, alors que l'action n'exige que
                    `asset.ecrire`, que le rôle `montage` possède. La passe 4
                    a signalé l'écart sans trancher, et il reste ouvert :
                    « modifier un asset » et « supprimer un lien » se
                    défendent l'un comme l'autre. Le geste est branché tel
                    quel et la question posée à Will — pas résolue en douce
                    par un choix d'écran.
                  */}
                  <form action={detacherAssetFormAction}>
                    <input type="hidden" name="assetId" value={id} />
                    <input type="hidden" name="publicationId" value={p.publication.id} />
                    <input type="hidden" name="retour" value={`${base}/mediatheque/${id}`} />
                    <AdminButton type="submit" variant="ghost-danger" size="sm">
                      Détacher
                    </AdminButton>
                  </form>
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>
      )}

      <p className="mt-[var(--space-admin-6)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        <Link href={`${base}/mediatheque`} className="hover:underline">
          ← Toute la médiathèque
        </Link>
      </p>
    </AdminPageShell>
  );
}
