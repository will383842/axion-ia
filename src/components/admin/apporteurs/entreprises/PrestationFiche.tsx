// La prestation d'une entreprise présentée (contrat 2.3, art. 4.2), sur sa fiche : chaque
// commission rattachée, « Marquer la prestation réalisée » ou « Annuler ». Composant SERVEUR,
// sans JavaScript côté navigateur (formulaires HTML + actions serveur). Les contrôles sont
// refaits côté serveur (`realisation.ts`) : l'écran ne fait que proposer.

import { AdminBadge } from "@/components/admin/ui";
import {
  annulerRealisationFicheAction,
  marquerRealiseeFicheAction,
} from "@/features/apporteurs-reseau/actions-prestation-fiche";
import type { CommissionDeLaPresentation } from "@/features/apporteurs-reseau/prestation-presentation";
import { MARQUABLES as MARQUABLES_DOMAINE } from "@/features/apporteurs-reseau/realisation";
import { euros } from "@/features/apporteurs-reseau/regles";

/** Les statuts où la réalisation se marque ou s'annule : la liste du domaine, jamais une copie. */
const MARQUABLES: ReadonlySet<string> = new Set(MARQUABLES_DOMAINE);

const PETIT = "text-[length:var(--text-admin-sm)]";

const jourFr = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

export function PrestationFiche({
  commissions,
  peutMarquer,
  onglet,
  aujourdhui,
}: {
  commissions: ReadonlyArray<CommissionDeLaPresentation>;
  /** Rôle autorisé à toucher aux commissions (administrateur). */
  peutMarquer: boolean;
  onglet: string;
  /** « AAAA-MM-JJ », heure de Paris. */
  aujourdhui: string;
}) {
  const vivantes = commissions.filter((c) => c.statut !== "reprise");
  if (vivantes.length === 0) return null;
  return (
    <section className={`flex flex-col gap-[var(--space-admin-2)] ${PETIT}`}>
      <h3 className="font-semibold">Prestation</h3>
      <ul className="flex flex-col gap-[var(--space-admin-2)]">
        {vivantes.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
            <span>
              Commission {c.montantCents === null ? "à qualifier" : euros(c.montantCents)}
            </span>
            {c.prestationRealiseeAt ? (
              <>
                <AdminBadge tone="success">Réalisée le {jourFr(c.prestationRealiseeAt)}</AdminBadge>
                {peutMarquer && c.autofactureNumero === null && MARQUABLES.has(c.statut) ? (
                  <form action={annulerRealisationFicheAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="onglet" value={onglet} />
                    <button type="submit" className="admin-button-secondary">
                      Annuler
                    </button>
                  </form>
                ) : null}
              </>
            ) : (
              <>
                <AdminBadge tone="warning">En attente de réalisation</AdminBadge>
                {peutMarquer && MARQUABLES.has(c.statut) ? (
                  <form
                    action={marquerRealiseeFicheAction}
                    className="flex flex-wrap items-center gap-[var(--space-admin-2)]"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="onglet" value={onglet} />
                    <label className="flex items-center gap-1">
                      <span>Réalisée le</span>
                      <input
                        type="date"
                        name="realiseeLe"
                        defaultValue={aujourdhui}
                        max={aujourdhui}
                        required
                        className="admin-input"
                      />
                    </label>
                    <button type="submit" className="admin-button">
                      Marquer la prestation réalisée
                    </button>
                  </form>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
