// Séparation Actualités (2026-07-01) — Centre de contrôle « Actualités / News RSS »
// dans le pôle LANCER. Regroupe au même endroit : le cap de news générées par
// jour, la fenêtre de fraîcheur, et des raccourcis vers les sources RSS + la page
// publique /actualites. Le réglage écrit dans le MÊME `ContentGenConfig.key=
// "policies"` que /settings/policies (SSOT unique) — on préserve les autres champs
// via closure sur `cfg` (aucun reset).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowRight, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminButton } from "@/components/admin/ui";
import { updatePolicies, type ContentPolicies } from "@/server/actions/content-gen/policies";

interface Props {
  cfg: ContentPolicies;
  rssSourceCount: number;
  publishedNewsCount: number;
  adminPrefix: string;
  saved?: boolean;
}

/**
 * Présence de sources RSS actives.
 *
 * Le ✅ et le ⚠️ qui servaient ici se ressemblent à petite taille et ne
 * disaient rien à la synthèse vocale. Coche ou triangle, avec un nom
 * accessible, et la couleur ne fait plus que renforcer la forme.
 */
function EtatSources({ actives }: { actives: boolean }): React.ReactElement {
  const Icone = actives ? CheckCircle2 : AlertTriangle;
  return (
    <Icone
      size={15}
      aria-label={actives ? "Des sources RSS sont actives" : "Aucune source RSS active"}
      className="inline shrink-0 align-[-2px]"
      style={{ color: actives ? "var(--color-admin-success)" : "var(--color-admin-warning)" }}
    />
  );
}

export function NewsControlV2({
  cfg,
  rssSourceCount,
  publishedNewsCount,
  adminPrefix,
  saved = false,
}: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    // On repart de la config complète (closure) et on n'écrase QUE les champs
    // news → les autres policies (plagiat, retention, auto-publish…) intactes.
    // Une case décochée n'est PAS transmise → on lit explicitement le checkbox.
    await updatePolicies({
      ...cfg,
      newsAutoPublish: formData.get("newsAutoPublish") === "on",
      rssMaxPerDay: Number(formData.get("rssMaxPerDay") ?? cfg.rssMaxPerDay),
      rssMaxAgeDays: Number(formData.get("rssMaxAgeDays") ?? cfg.rssMaxAgeDays),
    });
    // Feedback visible : `updatePolicies` revalide la page Policies (SSOT), pas
    // celle-ci → on rafraîchit CETTE page + on redirige avec ?saved=1 pour
    // afficher la confirmation (sinon l'utilisateur croit que « rien ne se passe »).
    revalidatePath(`/fr/${adminPrefix}/content-gen/news`);
    redirect(`/fr/${adminPrefix}/content-gen/news?saved=1`);
  }

  const base = `/fr/${adminPrefix}/content-gen`;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Actualités / News RSS"
        description="Pilotez le volume d'actualités générées par jour depuis vos sources RSS. Les news sont publiées séparément du blog, sur /actualites."
      />

      {saved ? (
        <div role="status" className="admin-alert admin-alert-success mb-[var(--space-admin-4)]">
          Réglages enregistrés.
        </div>
      ) : null}

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">État</h2>
        <ul className="admin-meta-block">
          <li>
            <EtatSources actives={rssSourceCount > 0} /> <strong>Sources RSS actives :</strong>{" "}
            {rssSourceCount}
            {rssSourceCount === 0 ? (
              <>
                {" "}
                — aucune source active : aucune actualité ne sera générée.{" "}
                <AdminButton href={`${base}/rss`} variant="ghost" size="sm" iconAfter={ArrowRight}>
                  Ajouter une source
                </AdminButton>
              </>
            ) : (
              <>
                {" · "}
                <AdminButton href={`${base}/rss`} variant="ghost" size="sm" iconAfter={ArrowRight}>
                  Gérer les sources
                </AdminButton>
              </>
            )}
          </li>
          <li>
            <strong>Actualités publiées (indexables) :</strong> {publishedNewsCount}
            {" · "}
            <AdminButton
              href="/fr/actualites"
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              size="sm"
              iconAfter={ExternalLink}
            >
              Voir la page publique /actualites
            </AdminButton>
          </li>
        </ul>
      </AdminCard>

      <AdminCard>
        <form action={save}>
          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="newsAutoPublish" defaultChecked={cfg.newsAutoPublish} />{" "}
              Publier automatiquement les actualités (Google News) — décoché = les news partent en
              file de relecture avant mise en ligne
            </label>
            <p className="admin-meta-block">
              Quand activé, une actualité est publiée dès que son score qualité atteint{" "}
              <strong>{cfg.rssAutoPublishMinScore}</strong> (réglable dans Policies). En dessous,
              elle part en relecture. L&apos;anti-plagiat vs source (Jaccard{" "}
              {cfg.plagiarismJaccardRss}) reste toujours actif.
            </p>
          </div>

          <div className="admin-field">
            <label htmlFor="rssMaxPerDay" className="admin-label">
              Nombre max d&apos;actualités générées par jour (0 = mettre les news en pause)
            </label>
            <input
              id="rssMaxPerDay"
              name="rssMaxPerDay"
              type="number"
              min="0"
              max="200"
              defaultValue={cfg.rssMaxPerDay}
              className="admin-input"
              required
            />
          </div>

          <div className="admin-field">
            <label htmlFor="rssMaxAgeDays" className="admin-label">
              Fraîcheur max d&apos;une news (jours) : au-delà, la news est abandonnée (jamais de
              news périmée)
            </label>
            <input
              id="rssMaxAgeDays"
              name="rssMaxAgeDays"
              type="number"
              min="1"
              max="30"
              defaultValue={cfg.rssMaxAgeDays}
              className="admin-input"
              required
            />
          </div>

          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Enregistrer
            </button>
          </div>
        </form>

        <p className="admin-meta-block mt-[var(--space-admin-4)]">
          Réglages avancés (score auto-publish, seuils anti-plagiat, rétention) :{" "}
          <AdminButton
            href={`${base}/settings/policies`}
            variant="ghost"
            size="sm"
            iconAfter={ArrowRight}
          >
            Policies content-gen
          </AdminButton>
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
