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
          <div className="flex flex-wrap gap-2">
            <AdminButton href={`${base}/idees`} variant="ghost" size="sm">
              Idées
            </AdminButton>
            <AdminButton href={`${base}/publications`} variant="secondary" size="sm">
              Les publications
            </AdminButton>
            <AdminButton href={`${base}/calendrier`} variant="primary" size="sm">
              Ouvrir le calendrier
            </AdminButton>
          </div>
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
          <h2 className="admin-h2 mb-[var(--space-admin-3)]">Ce que ce lot ne fait pas encore</h2>
          {/* Dire ce qui manque vaut mieux que laisser croire à une panne :
              un écran muet sur ses limites se lit comme un bug. */}
          <ul className="list-disc space-y-1 pl-5 text-[color:var(--color-admin-fg-muted)]">
            <li>
              La rédaction, le kit de publication et la médiathèque arrivent au lot 1 — le lot 0
              montre les quatre mois, il ne les modifie pas.
            </li>
            <li>
              Les règles de conformité et d&apos;alerte sont <strong>en base</strong> et testées,
              mais leur évaluateur se branche au lot 1, avec la validation.
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
