/**
 * « Ventes en cours » — rappel de reprise affiché sous l'en-tête de la vente
 * guidée (les brouillons de vente de cet admin).
 *
 * Composant SERVEUR, sans état ni interaction : sorti de `VenteWizard` (client)
 * pour que ses libellés et son balisage ne voyagent pas dans le JavaScript de
 * la console (cliquet du poids de la console, ADR 0058). La page le passe au
 * wizard dans l'emplacement `aside`, tel quel.
 *
 * Reprise : le seul chemin quand un devis envoyé attend sa signature.
 */

import Link from "next/link";

export interface VenteEnCours {
  id: string;
  etape: number;
  clientRaisonSociale: string | null;
  /** Date déjà formatée fr-FR côté serveur. */
  modifieLe: string;
}

export function VentesEnCours({
  adminPrefix,
  brouillons,
}: {
  readonly adminPrefix: string;
  readonly brouillons: ReadonlyArray<VenteEnCours>;
}): React.ReactElement | null {
  if (brouillons.length === 0) return null;
  const base = `/fr/${adminPrefix}`;
  return (
    <div className="mb-[var(--space-admin-5,12px)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold">
        Ventes en cours ({brouillons.length})
      </p>
      <ul className="flex flex-col gap-[var(--space-admin-2)]">
        {brouillons.map((b) => (
          <li key={b.id} className="text-[length:var(--text-admin-sm)]">
            <Link
              href={`${base}/qualiopi/vente/new?brouillon=${b.id}`}
              className="text-[color:var(--color-admin-accent)] underline hover:no-underline"
            >
              {b.clientRaisonSociale ?? "Client non choisi"} — étape {b.etape}/4
            </Link>{" "}
            <span className="text-[color:var(--color-admin-fg-soft)]">
              (modifié le {b.modifieLe})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
