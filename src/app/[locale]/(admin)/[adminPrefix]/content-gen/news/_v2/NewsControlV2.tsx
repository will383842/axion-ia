// Séparation Actualités (2026-07-01) — Centre de contrôle « Actualités / News RSS »
// dans le pôle LANCER. Regroupe au même endroit : le cap de news générées par
// jour, la fenêtre de fraîcheur, et des raccourcis vers les sources RSS + la page
// publique /actualites. Le réglage écrit dans le MÊME `ContentGenConfig.key=
// "policies"` que /settings/policies (SSOT unique) — on préserve les autres champs
// via closure sur `cfg` (aucun reset).

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updatePolicies, type ContentPolicies } from "@/server/actions/content-gen/policies";

interface Props {
  cfg: ContentPolicies;
  rssSourceCount: number;
  publishedNewsCount: number;
  adminPrefix: string;
}

export function NewsControlV2({
  cfg,
  rssSourceCount,
  publishedNewsCount,
  adminPrefix,
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
  }

  const base = `/fr/${adminPrefix}/content-gen`;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Actualités / News RSS"
        description="Pilotez le volume d'actualités générées par jour depuis vos sources RSS. Les news sont publiées séparément du blog, sur /actualites."
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">État</h2>
        <ul className="admin-meta-block">
          <li>
            {rssSourceCount > 0 ? "✅" : "⚠️"} <strong>Sources RSS actives :</strong>{" "}
            {rssSourceCount}
            {rssSourceCount === 0 ? (
              <>
                {" "}
                — aucune source active : aucune actualité ne sera générée.{" "}
                <Link href={`${base}/rss`} className="admin-link">
                  Ajouter une source →
                </Link>
              </>
            ) : (
              <>
                {" · "}
                <Link href={`${base}/rss`} className="admin-link">
                  Gérer les sources →
                </Link>
              </>
            )}
          </li>
          <li>
            <strong>Actualités publiées (indexables) :</strong> {publishedNewsCount}
            {" · "}
            <a
              href="/fr/actualites"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-link"
            >
              Voir la page publique /actualites →
            </a>
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
          <Link href={`${base}/settings/policies`} className="admin-link">
            Policies content-gen →
          </Link>
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
