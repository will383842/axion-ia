// Console éditoriale — tableau de bord (lot 0).
//
// Segment `console-editoriale` et non `editorial` : décision §14 #3. Le plan
// écrit `editorial` au §3, mais `[adminPrefix]` porte déjà `calendrier`,
// `podcast`, `newsletter`, `content-gen` et `blog` — le segment long lève
// l'ambiguïté, et c'est la décision qui fait foi, pas le plan.
//
// 🔴 Zéro JavaScript client. Tout est Server Component, et les filtres passent
// par la querystring. Les gates de budget étant en `continue-on-error`, la
// seule garde réelle est de ne pas créer la dette : un écran de lecture n'a
// aucune raison d'embarquer un bundle.

import { redirect } from "next/navigation";
import { CalendarDays, Radio, ShieldCheck, BellRing } from "lucide-react";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminEmptyState,
  AdminButton,
  AdminBadge,
} from "@/components/admin/ui";
import { chargerResumeConsole } from "@/server/editorial/queries";
import { publicationsSansAssetPret, listerIdees } from "@/server/editorial/publication-queries";
import { PremierLancement } from "./_composants/PremierLancement";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
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

export default async function ConsoleEditorialePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const maintenant = new Date();
  const [resume, presse, idees] = await Promise.all([
    chargerResumeConsole(maintenant),
    publicationsSansAssetPret(maintenant),
    listerIdees(),
  ]);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Console éditoriale"
        description="Piloter la publication sur tous les canaux, depuis un seul endroit."
        actions={
          // 🔴 DEUX actions, pas neuf.
          //
          // Défaut trouvé en testant l'interface pour de vrai — ni le
          // typecheck, ni les tests, ni l'arbre d'accessibilité ne le
          // voyaient : le `h1` était bien présent, avec le bon texte, et
          // Playwright le rendait « hidden ».
          //
          // `AdminPageHeader` pose `sm:shrink-0 sm:flex-nowrap` sur sa rangée
          // d'actions : elle ne cède JAMAIS de place. C'est donc la colonne du
          // titre, en `min-w-0`, qui s'écrase — jusqu'à zéro pixel avec neuf
          // boutons. Le titre disparaissait et la description s'affichait un
          // mot par ligne.
          //
          // ⚠️ La limite du composant partagé est réelle et vaut pour toute
          // page : au-delà de trois ou quatre actions larges, le titre
          // commence à se faire manger. Je ne le corrige pas ici — c'est
          // MON en-tête qui en abusait, et neuf boutons ne sont pas un
          // design. Les autres vivent maintenant dans le corps de la page,
          // où ils ont la place de s'expliquer.
          <>
            <AdminButton href={`${base}/publications`} variant="secondary" size="sm">
              Les publications
            </AdminButton>
            <AdminButton href={`${base}/calendrier`} variant="primary" size="sm">
              Ouvrir le calendrier
            </AdminButton>
          </>
        }
      />

      <PremierLancement
        base={base}
        etat={{
          comptes: resume.comptesTotal,
          publications: resume.publicationsTotal,
          idees: idees.length,
          importFait: resume.importFait,
        }}
      />

      <div className="mt-[var(--space-admin-4)] grid gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Publications au calendrier"
          value={resume.publicationsTotal}
          meta={`dont ${resume.publicationsAVenir} à venir`}
          icon={CalendarDays}
          href={`${base}/calendrier`}
        />
        <AdminStatCard
          label="Comptes pilotés"
          value={`${resume.comptesActifs} / ${resume.comptesTotal}`}
          meta="actifs sur déclarés"
          icon={Radio}
          tone={resume.comptesActifs > 0 ? "default" : "warning"}
        />
        <AdminStatCard
          label="Règles de conformité"
          value={resume.reglesConformite}
          meta="actives, en base"
          icon={ShieldCheck}
          tone="info"
        />
        <AdminStatCard
          label="Règles d'alerte"
          value={resume.reglesAlerte}
          meta="actives, en base"
          icon={BellRing}
          tone="info"
        />
      </div>

      {/* ── Les autres surfaces ─────────────────────────────────────────── */}
      {/* Sorties de l'en-tête, où elles écrasaient le titre. Ici elles ont
          la place d'être lisibles, et l'ordre dit la fréquence d'usage. */}
      <nav aria-label="Surfaces de la console éditoriale" className="admin-actions-row">
        <AdminButton href={`${base}/idees`} variant="ghost" size="sm">
          Idées
        </AdminButton>
        <AdminButton href={`${base}/mediatheque`} variant="ghost" size="sm">
          Médiathèque
        </AdminButton>
        <AdminButton href={`${base}/recherche`} variant="ghost" size="sm">
          Rechercher
        </AdminButton>
        <AdminButton href={`${base}/analyse`} variant="ghost" size="sm">
          Analyse
        </AdminButton>
        <AdminButton href={`${base}/achat-media`} variant="ghost" size="sm">
          Achat média
        </AdminButton>
        <AdminButton href={`${base}/equipe`} variant="ghost" size="sm">
          Équipe
        </AdminButton>
        {/* Les réglages en dernier : on y va rarement, mais quand on y va
            c'est qu'une règle bloque. */}
        <AdminButton href={`${base}/reglages`} variant="ghost" size="sm">
          Réglages
        </AdminButton>
      </nav>

      {/* ── Ce qui presse — critère 18 du lot 1 ─────────────────────────── */}
      <div className="mt-[var(--space-admin-6)]">
        <AdminCard>
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-2">
            <h2 className="admin-h2">Ce qui presse</h2>
            <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              à J-{presse.jours}, asset non prêt
            </span>
          </div>
          {presse.lignes.length === 0 ? (
            <AdminEmptyState
              variant="inline"
              title="Rien ne presse"
              description={`Aucune publication dans les ${presse.jours} prochains jours n'attend un asset. Le seuil se règle depuis la règle d'alerte « asset-retard ».`}
            />
          ) : (
            <ul className="space-y-2">
              {presse.lignes.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                        {p.dayKey.split("-").reverse().join("/")}
                      </span>
                      <a
                        href={`${base}/publications/${p.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {p.titreInterne}
                      </a>
                    </div>
                    <div className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                      {p.compteLibelle}
                    </div>
                  </div>
                  <AdminBadge tone="warning">{p.statutAsset}</AdminBadge>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <div className="mt-[var(--space-admin-6)]">
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">Les quatre mois</h2>
          {resume.moisCouverts.length === 0 ? (
            // L'état vide EXPLIQUE quoi faire — il n'affiche pas « aucun
            // résultat ». C'est une exigence de la passe 3 du protocole.
            <AdminEmptyState
              title="Aucune publication au calendrier"
              description={
                resume.comptesTotal === 0
                  ? "Les référentiels ne sont pas encore amorcés. Lancez « pnpm editorial:seed » pour créer les deux marques et les onze comptes, puis « pnpm editorial:import » pour verser le dossier LinkedIn du trimestre."
                  : "Les comptes existent, mais aucune publication n'a encore été versée. Lancez « pnpm editorial:import --source <dossier> » pour importer les 61 publications et leurs 13 échos de page."
              }
            />
          ) : (
            <ul className="space-y-2">
              {resume.moisCouverts.map((m) => (
                <li
                  key={`${m.annee}-${m.mois}`}
                  className="flex items-center justify-between rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-4 py-3"
                >
                  <a
                    className="font-medium hover:underline"
                    href={`${base}/calendrier?year=${m.annee}&month=${m.mois}`}
                  >
                    {MOIS[m.mois - 1]} {m.annee}
                  </a>
                  <span className="text-[color:var(--color-admin-fg-muted)]">
                    {m.combien} publication{m.combien > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      {/* ── Sortir ses données — critères 9 et 10 ───────────────────────── */}
      <div className="mt-[var(--space-admin-6)]">
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">Sortir ses données</h2>
          <p className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-fg-muted)]">
            Un outil dont on ne peut pas sortir est un piège. La sauvegarde complète est une
            exigence du plan, pas un confort.
          </p>
          <div className="flex flex-wrap gap-2">
            {resume.moisCouverts.map((m) => (
              <a
                key={`csv-${m.annee}-${m.mois}`}
                href={`${base}/export?type=csv&year=${m.annee}&month=${m.mois}`}
                className="admin-button-secondary admin-button-sm"
              >
                CSV — {MOIS[m.mois - 1]} {m.annee}
              </a>
            ))}
            <a href={`${base}/export?type=sauvegarde`} className="admin-button admin-button-sm">
              Sauvegarde complète (JSON)
            </a>
          </div>
        </AdminCard>
      </div>

      <div className="mt-[var(--space-admin-6)]">
        <AdminCard>
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">
            Ce que la console ne fait pas encore
          </h2>
          {/*
            Dire ce qui manque vaut mieux que laisser croire à une panne :
            un écran muet sur ses limites se lit comme un bug.

            🔴 Mais un écran qui décrit un état PÉRIMÉ est pire encore.

            Défaut trouvé par la passe 2 du protocole : ce bloc annonçait
            encore « la rédaction, le kit de publication et la médiathèque
            arrivent au lot 1 » alors que les lots 1 à 6 étaient commités et
            que les trois existaient. Un utilisateur qui lit ça cherche
            ailleurs une fonction qui est devant lui.

            Ce qui reste ici doit être vrai AUJOURD'HUI, ou disparaître.
          */}
          <ul className="list-disc space-y-1 pl-5 text-[color:var(--color-admin-fg-muted)]">
            <li>
              <strong>La publication automatique n&apos;existe pas.</strong> Le kit prépare, vous
              collez, puis vous marquez la publication comme publiée avec son URL réelle. Les accès
              aux plateformes (lot 5) se demandent, ils ne se codent pas — et sans l&apos;audit
              TikTok, une vidéo envoyée par l&apos;API partirait <strong>en privé</strong> sans que
              rien ne le signale.
            </li>
            <li>
              <strong>La durée d&apos;une vidéo déposée n&apos;est pas extraite</strong> — il
              faudrait
              <code className="admin-code-inline">ffprobe</code> dans l&apos;image. La règle de
              spécification de plateforme rend donc « non évaluée » sur ces assets, plutôt que de
              les déclarer conformes sans avoir rien mesuré.
            </li>
            <li>
              Le calendrier du site reste vide : le branchement <code>content-gen</code> se décidera
              plus tard, pour ne pas créer de seconde source de vérité.
            </li>
            <li>
              Import du dossier LinkedIn :{" "}
              {resume.importFait ? "effectué." : "pas encore effectué."}
            </li>
          </ul>
        </AdminCard>
      </div>
    </AdminPageShell>
  );
}
