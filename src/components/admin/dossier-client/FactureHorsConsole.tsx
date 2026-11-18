// « Facture établie hors console » (étape 4, 2026-10-26) : la case, la date, et ce que ça change.
// Composant SERVEUR sans JavaScript. Une fois cochée, la case ne se décoche pas (rien n'est
// supprimé) : la date se corrige. Aucun envoi.

import { factureHorsConsoleAction } from "@/features/dossier-client/actions-facture-hors-console";

const inputCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]";

const jourFr = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", dateStyle: "long" }).format(d);

export function FactureHorsConsole({
  clientId,
  etabliLe,
  peutEcrire,
  aujourdhui,
  message,
  erreur,
}: {
  clientId: string;
  /** NULL : aucune facture hors console notée. */
  etabliLe: Date | null;
  peutEcrire: boolean;
  /** AAAA-MM-JJ, heure de Paris : borne la date saisie. */
  aujourdhui: string;
  message: string | null;
  erreur: string | null;
}): React.ReactElement {
  return (
    <section
      aria-labelledby="facture-hors-console"
      data-bloc="facture-hors-console"
      className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      <h2
        id="facture-hors-console"
        className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold"
      >
        Facture établie hors console
      </h2>
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Une facture faite ailleurs (Tiime…) compte : la fiche d&apos;un prospect devient un client.
        Un client inactif ou perdu n&apos;est jamais rouvert tout seul.
      </p>
      {erreur !== null ? (
        <p role="alert" className="mb-[var(--space-admin-2)] text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      ) : null}
      {message !== null ? (
        <p role="status" className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          {message}
        </p>
      ) : null}
      {etabliLe !== null ? (
        <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          Facture établie hors console le <b>{jourFr(etabliLe)}</b>.
        </p>
      ) : null}
      {peutEcrire ? (
        <form
          action={factureHorsConsoleAction}
          className="flex flex-wrap items-end gap-[var(--space-admin-3)]"
        >
          <input type="hidden" name="clientId" value={clientId} />
          {etabliLe === null ? (
            <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
              <input type="checkbox" name="facture_hors_console" value="1" required />
              Une facture a été établie hors console
            </label>
          ) : (
            <input type="hidden" name="facture_hors_console" value="1" />
          )}
          <label className="flex flex-col text-[length:var(--text-admin-xs)]">
            {etabliLe === null ? "Date de la facture" : "Corriger la date"}
            <input
              type="date"
              name="date"
              required
              max={aujourdhui}
              defaultValue={etabliLe === null ? "" : etabliLe.toISOString().slice(0, 10)}
              className={inputCls}
            />
          </label>
          <button type="submit" className="admin-button-secondary">
            Enregistrer
          </button>
        </form>
      ) : null}
    </section>
  );
}
