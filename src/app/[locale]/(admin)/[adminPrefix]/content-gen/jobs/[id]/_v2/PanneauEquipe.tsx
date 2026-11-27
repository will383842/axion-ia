/**
 * Vue en lecture seule du journal de l'équipe éditoriale (`outputJsonRaw.equipe`).
 * Aucune action : rien à cliquer, rien à modifier. N'affiche rien si le job n'en porte pas.
 */

import { AdminCard } from "@/components/admin/ui";
import { LIBELLES_ROLES, lireJournalEquipe } from "./journal-equipe";

const usd = (n: number): string => `${n.toFixed(2)} $`;

export function PanneauEquipe({
  outputJsonRaw,
}: {
  outputJsonRaw: unknown;
}): React.ReactElement | null {
  const j = lireJournalEquipe(outputJsonRaw);
  if (!j) return null;
  return (
    <AdminCard className="mb-[var(--space-admin-5)]">
      <h2 className="admin-h2">Équipe éditoriale</h2>
      <p className="admin-meta-block">
        Issue : <strong>{j.issue || "inconnue"}</strong>
        {j.raison ? ` — ${j.raison}` : ""} · {j.renvois} renvoi(s) · coût {usd(j.coutTotalUsd)} sur
        un plafond de {usd(j.plafondUsd)}
      </p>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Passe</th>
              <th>Rôle</th>
              <th>Décision</th>
              <th>Durée</th>
              <th>Coût</th>
              <th>Détail</th>
            </tr>
          </thead>
          <tbody>
            {j.entrees.map((e, i) => (
              <tr key={i}>
                <td>{e.passe}</td>
                <td>{LIBELLES_ROLES[e.role] ?? e.role}</td>
                <td>{e.decision}</td>
                <td>{(e.dureeMs / 1000).toFixed(1)} s</td>
                <td>{usd(e.coutUsd)}</td>
                <td title={e.detail}>{(e.detail ?? "").slice(0, 120)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
