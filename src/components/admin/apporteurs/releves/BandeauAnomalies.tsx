// Bandeau d'anomalies bloquantes en tête de la vérification (lecture seule).
import type { AnomalieEcran } from "@/features/apporteurs-reseau/releve-mensuel/statistiques";

export function BandeauAnomalies({ anomalies }: { anomalies: readonly AnomalieEcran[] }) {
  if (anomalies.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-[var(--space-admin-3)] text-[color:var(--color-admin-destructive-fg)]"
    >
      <p className="font-semibold">{anomalies.length} anomalie(s) à corriger avant tout envoi</p>
      <ul className="mt-[var(--space-admin-2)] list-disc pl-[var(--space-admin-5)]">
        {anomalies.map((a, i) => (
          <li key={`${a.code}-${i}`}>{a.detail}</li>
        ))}
      </ul>
    </div>
  );
}
