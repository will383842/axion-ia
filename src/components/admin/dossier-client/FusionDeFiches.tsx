/**
 * Fusionner deux fiches du même client, et « Défaire la fusion »
 * (chantier visio, PR 4 ; décision A3 de Will : déclenchée par lui,
 * journalisée, réversible).
 *
 * Composant SERVEUR, sans JavaScript. Les règles (deux SIREN différents, ou
 * un SIREN sur la seule fiche absorbée : refus ; facture sur la fiche sans
 * SIREN : attente) sont dans
 * `features/dossier-client/fusionner.ts` ; l'action les applique et renvoie
 * le motif en clair.
 */

import { formatDateFrShort } from "@/lib/format-date-fr";
import {
  defaireFusionAction,
  fusionnerFichesAction,
} from "@/features/dossier-client/actions-rencontres";
import type { FicheCourte, FusionDeLaFiche } from "@/features/dossier-client/queries-rencontres";

const carteCls =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";

function FormulaireDefaire({ fusionId, clientId }: { fusionId: string; clientId: string }) {
  return (
    <form
      action={defaireFusionAction}
      className="mt-[var(--space-admin-2)] flex flex-wrap items-end gap-[var(--space-admin-2)]"
    >
      <input type="hidden" name="fusionId" value={fusionId} />
      <input type="hidden" name="clientId" value={clientId} />
      <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
        Pourquoi défaire ? (10 caractères au moins)
        <input name="motif" required minLength={10} maxLength={300} className={inputCls} />
      </label>
      <button type="submit" className="admin-button-ghost">
        Défaire la fusion
      </button>
    </form>
  );
}

export function FusionDeFiches({
  clientId,
  fusions,
  fiches,
}: {
  clientId: string;
  fusions: ReadonlyArray<FusionDeLaFiche>;
  /** Les AUTRES fiches vivantes (cible possible). */
  fiches: ReadonlyArray<FicheCourte>;
}) {
  const absorbee = fusions.find((f) => f.sens === "absorbee");
  const absorbees = fusions.filter((f) => f.sens === "absorbante");
  return (
    <section className={carteCls}>
      <h2 className={titreCls}>Fiche en double ?</h2>
      {absorbee ? (
        <div className="text-[length:var(--text-admin-sm)]">
          <p>
            Cette fiche a été fusionnée le {formatDateFrShort(absorbee.le)} dans{" "}
            <strong>
              {absorbee.autre?.raisonSociale ?? "une autre fiche"} ({absorbee.autre?.numero ?? "—"})
            </strong>
            . Ses devis et factures restent ici, en lecture seule.
          </p>
          <FormulaireDefaire fusionId={absorbee.id} clientId={clientId} />
        </div>
      ) : (
        <>
          {absorbees.map((f) => (
            <div
              key={f.id}
              className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
            >
              <p>
                A absorbé la fiche {f.autre?.raisonSociale ?? "—"} ({f.autre?.numero ?? "—"}) le{" "}
                {formatDateFrShort(f.le)}.
              </p>
              <FormulaireDefaire fusionId={f.id} clientId={clientId} />
            </div>
          ))}
          {fiches.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-accent)]">
                Fusionner cette fiche dans une autre
              </summary>
              <form
                action={fusionnerFichesAction}
                className="mt-[var(--space-admin-3)] grid gap-[var(--space-admin-3)] sm:grid-cols-2"
              >
                <input type="hidden" name="absorbeeId" value={clientId} />
                <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                  La fiche qui reste
                  <select name="absorbanteId" required defaultValue="" className={inputCls}>
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {fiches.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.raisonSociale} ({f.numero})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                  Pourquoi est-ce le même client ? (10 caractères au moins)
                  <input
                    name="motif"
                    required
                    minLength={10}
                    maxLength={300}
                    className={inputCls}
                  />
                </label>
                <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] sm:col-span-2">
                  <input type="checkbox" name="reporterSiren" defaultChecked />
                  Si seule la fiche qui reste a un SIREN, le reporter sur celle-ci
                </label>
                <p className={`text-[length:var(--text-admin-xs)] sm:col-span-2 ${mutedCls}`}>
                  Les personnes, les projets et les rendez-vous passent sur la fiche qui reste ; les
                  devis et factures restent ici. Deux SIREN différents, ou un SIREN sur cette seule
                  fiche : la fusion est refusée (dans le second cas, fusionnez dans l&apos;autre
                  sens). Elle se défait depuis l&apos;une ou l&apos;autre fiche.
                </p>
                <div className="sm:col-span-2">
                  <button type="submit" className="admin-button-ghost">
                    Fusionner
                  </button>
                </div>
              </form>
            </details>
          ) : (
            <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>Aucune autre fiche.</p>
          )}
        </>
      )}
    </section>
  );
}
