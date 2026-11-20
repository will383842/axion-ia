// Bloc « Visites venues des IA » (fiche GEO V1-10). Server Component : aucun JS client.
// Données : API Stats Plausible en lecture seule (`@/server/analytics/visites-ia`).
// Échec silencieux : si la mesure n'est pas lisible, on l'écrit simplement ici.

import { AdminCard } from "@/components/admin/ui";
import { lireVisitesIA, type PeriodeIA } from "@/server/analytics/visites-ia";

const nf = new Intl.NumberFormat("fr-FR");

function Chiffre({ titre, p }: { titre: string; p: PeriodeIA }) {
  return (
    <div>
      <p className="admin-meta-block">{titre}</p>
      <p className="admin-h2">{nf.format(p.visiteurs)} visiteurs</p>
      <p className="admin-meta-block">{nf.format(p.visites)} visites</p>
    </div>
  );
}

function dateFr(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

export async function VisitesIA(): Promise<React.ReactElement> {
  const v = await lireVisitesIA();

  if (v.statut === "indisponible") {
    return (
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Visites venues des IA</h2>
        <p className="admin-meta-block">
          Données indisponibles pour le moment. {v.raison} Le reste de la page fonctionne
          normalement.
        </p>
      </AdminCard>
    );
  }

  const maxSemaine = Math.max(1, ...v.semaines.map((s) => s.visiteurs));
  return (
    <AdminCard className="mb-[var(--space-admin-5)]">
      <h2 className="admin-h2">Visites venues des IA</h2>
      <p className="admin-meta-block">
        Personnes arrivées sur le site en cliquant depuis une réponse de ChatGPT, Perplexity,
        Copilot, Gemini, Le Chat, Claude, DeepSeek, You.com ou Phind. Source : Plausible.
      </p>

      <div className="mt-[var(--space-admin-3)] grid gap-[var(--space-admin-5)] sm:grid-cols-2">
        <Chiffre titre="7 derniers jours" p={v.sept} />
        <Chiffre titre="30 derniers jours" p={v.trente} />
      </div>

      <h3 className="admin-h3 mt-[var(--space-admin-5)]">Répartition par IA (30 jours)</h3>
      {v.trente.parIA.length === 0 ? (
        <p className="admin-meta-block">Aucune visite venue d&apos;une IA sur la période.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>IA</th>
                <th>Visiteurs</th>
                <th>Visites</th>
              </tr>
            </thead>
            <tbody>
              {v.trente.parIA.map((l) => (
                <tr key={l.id}>
                  <td>{l.libelle}</td>
                  <td>{nf.format(l.visiteurs)}</td>
                  <td>{nf.format(l.visites)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="admin-h3 mt-[var(--space-admin-5)]">Semaine par semaine (12 semaines)</h3>
      {!v.serieHebdo ? (
        <p className="admin-meta-block">
          Le détail par semaine n&apos;est pas proposé par cette version de Plausible.
        </p>
      ) : v.semaines.length === 0 ? (
        <p className="admin-meta-block">Aucune visite venue d&apos;une IA sur 12 semaines.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Semaine du</th>
                <th>Visiteurs</th>
                <th aria-label="Barre proportionnelle" />
              </tr>
            </thead>
            <tbody>
              {v.semaines.map((s) => (
                <tr key={s.debut}>
                  <td>{dateFr(s.debut)}</td>
                  <td>{nf.format(s.visiteurs)}</td>
                  <td>
                    <div
                      aria-hidden="true"
                      style={{
                        height: 8,
                        width: `${Math.round((s.visiteurs / maxSemaine) * 100)}%`,
                        minWidth: 2,
                        background: "currentColor",
                        opacity: 0.5,
                        borderRadius: 4,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="admin-h3 mt-[var(--space-admin-5)]">Pages d&apos;arrivée (30 jours)</h3>
      {v.pages.length === 0 ? (
        <p className="admin-meta-block">Aucune page d&apos;arrivée à afficher.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Visiteurs</th>
                <th>Visites</th>
              </tr>
            </thead>
            <tbody>
              {v.pages.map((p) => (
                <tr key={p.page}>
                  <td>
                    <code>{p.page}</code>
                  </td>
                  <td>{nf.format(p.visiteurs)}</td>
                  <td>{nf.format(p.visites)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}
