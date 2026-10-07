// Retirer du réseau / Remettre / Supprimer définitivement (2026-10-07).
//
// Composant SERVEUR, sans JavaScript côté navigateur : des formulaires HTML qui appellent
// les actions serveur (`actions-retrait.ts`), puis reviennent sur la fiche avec le message.
// Le cliquet de taille de la console était plein ; les confirmations passent par des
// blocs `<details>` et des champs `required`. Les contrôles sont refaits côté serveur
// (`features/apporteurs-reseau/retrait.ts`) : l'écran ne fait que proposer.
// Composant À PART de `BlocsFiche.tsx` (une autre session y travaille).

import { AdminCard } from "@/components/admin/ui";
import {
  remettreDansLeReseauFormAction,
  retirerDuReseauFormAction,
  supprimerDefinitivementFormAction,
} from "@/features/apporteurs-reseau/actions-retrait";

interface Props {
  readonly apporteurId: string;
  /** « Prénom Nom », à retaper pour supprimer. */
  readonly nomComplet: string;
  readonly signe: boolean;
  /** Date de retrait déjà formatée, ou `null` si la fiche est dans le réseau. */
  readonly retireLe: string | null;
  /** `null` : suppression permise ; sinon la raison pour laquelle elle ne l'est pas. */
  readonly refusSuppression: string | null;
  /** Message de retour d'une action (`?retrait=` / `?retraitErreur=`). */
  readonly retour?: { readonly ok: boolean; readonly message: string } | null;
}

const PETIT = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";

export function RetraitDuReseau({
  apporteurId,
  nomComplet,
  signe,
  retireLe,
  refusSuppression,
  retour,
}: Props) {
  return (
    <AdminCard as="section">
      <h2 className="mb-[var(--space-admin-3)] font-semibold">Place dans le réseau</h2>

      {retour ? (
        <p
          role={retour.ok ? "status" : "alert"}
          className={`mb-[var(--space-admin-3)] ${retour.ok ? "admin-alert admin-alert-success" : "admin-alert admin-alert-error"}`}
        >
          {retour.message}
        </p>
      ) : null}

      {retireLe ? (
        <form
          action={remettreDansLeReseauFormAction}
          className="flex flex-col gap-[var(--space-admin-2)]"
        >
          <input type="hidden" name="apporteurId" value={apporteurId} />
          <p>
            Fiche <strong>retirée du réseau</strong> le {retireLe}. Le lien du dossier ne fonctionne
            plus. Rien n&apos;a été effacé.
          </p>
          <div>
            <button type="submit" className="admin-button-secondary">
              Remettre dans le réseau
            </button>
          </div>
          <p className={PETIT}>Un nouveau lien de dossier est créé ; il n&apos;est pas envoyé.</p>
        </form>
      ) : (
        <details>
          <summary className="cursor-pointer font-medium">Retirer du réseau</summary>
          <form
            action={retirerDuReseauFormAction}
            className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]"
          >
            <input type="hidden" name="apporteurId" value={apporteurId} />
            <p>
              La fiche sortira des listes (onglet « Retirés » pour la revoir) et le lien du dossier
              sera désactivé. Rien n&apos;est effacé : contrat, pièces, commissions et autofactures
              restent.
            </p>
            {signe ? (
              <p className="admin-alert" role="note">
                Le contrat prévoit une fin avec 30 jours de préavis (art. 11.1) ; retirer la fiche
                ne résilie pas le contrat. Pour y mettre fin, utilisez{" "}
                <a href="#resiliation" className="underline">
                  « Résilier le contrat »
                </a>
                . Les commissions dues restent dues.
              </p>
            ) : null}
            <div>
              <button type="submit" className="admin-button">
                Confirmer le retrait
              </button>
            </div>
          </form>
        </details>
      )}

      <div className="mt-[var(--space-admin-4)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)]">
        {refusSuppression ? (
          <p className={PETIT}>Suppression définitive impossible — {refusSuppression}</p>
        ) : (
          <details>
            <summary className="cursor-pointer font-medium">
              Supprimer définitivement le dossier
            </summary>
            <form
              action={supprimerDefinitivementFormAction}
              className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]"
            >
              <input type="hidden" name="apporteurId" value={apporteurId} />
              <p>
                Le dossier d&apos;apporteur et ses pièces seront supprimés. La fiche candidat est
                conservée. Cette action ne peut pas être annulée.
              </p>
              <label className="flex flex-col gap-1">
                <span>
                  Pour confirmer, tapez le nom : <strong>{nomComplet}</strong>
                </span>
                <input
                  name="nomTape"
                  className="admin-input"
                  autoComplete="off"
                  maxLength={200}
                  required
                />
              </label>
              <label className="flex items-center gap-[var(--space-admin-2)]">
                <input type="checkbox" name="compris" value="oui" required />
                Je comprends que la suppression est définitive.
              </label>
              <div>
                <button type="submit" className="admin-button">
                  Supprimer définitivement
                </button>
              </div>
            </form>
          </details>
        )}
      </div>
    </AdminCard>
  );
}
