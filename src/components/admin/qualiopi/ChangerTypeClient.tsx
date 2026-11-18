/**
 * Bloc « Type de fiche » de la page de modification d'un client — HORS du formulaire différentiel
 * (`ClientEditForm`). Composant serveur, zéro JavaScript : `<details>` déplie le formulaire, la
 * soumission passe par une action serveur (`changerTypeClientFormAction`).
 *
 * `blocage` (calculé par la page) : la raison, déjà rédigée, pour laquelle le type ne peut pas
 * changer (pièces portées, informations d'employeur). Bloc grisé, aucun formulaire.
 */

import { changerTypeClientFormAction } from "@/server/actions/qualiopi/clients";

export interface ChangerTypeClientProps {
  clientId: string;
  type: "entreprise" | "particulier";
  raisonSociale: string;
  /** Nom du contact de la fiche (`Client.contactNom`), qui ne change pas. */
  contactNom: string | null;
  /** Nom du contact de facturation, qui préremplit « Repasser en particulier ». */
  contactFacturationNom: string | null;
  blocage: string | null;
}

const champCls =
  "mt-1 block w-full rounded border border-[color:var(--color-admin-border)] bg-white px-2 py-1 text-[length:var(--text-admin-sm)]";
const boutonCls =
  "rounded bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] text-white";

export function ChangerTypeClient(props: ChangerTypeClientProps) {
  const { clientId, type, blocage } = props;
  const estParticulier = type === "particulier";
  const nomContact = props.contactNom ?? "";

  return (
    <section
      aria-labelledby="type-de-fiche"
      className="mb-[var(--space-admin-4)] rounded border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]"
    >
      <h2 id="type-de-fiche" className="text-[length:var(--text-admin-md)] font-medium">
        Type de fiche
      </h2>
      <p className="mt-1 text-[length:var(--text-admin-sm)]">
        {estParticulier ? "Particulier" : "Entreprise"}
      </p>

      {blocage !== null ? (
        <p
          aria-disabled="true"
          className="mt-2 rounded bg-[color:var(--color-admin-surface-muted)] p-2 text-[length:var(--text-admin-xs)] opacity-70"
        >
          {blocage}
        </p>
      ) : (
        <details className="mt-2">
          <summary className="cursor-pointer text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)]">
            {estParticulier ? "Passer en entreprise" : "Repasser en particulier"}
          </summary>
          <form action={changerTypeClientFormAction} className="mt-2 space-y-2">
            <input type="hidden" name="id" value={clientId} />
            <input
              type="hidden"
              name="type"
              value={estParticulier ? "entreprise" : "particulier"}
            />
            {estParticulier ? (
              <>
                <label className="block text-[length:var(--text-admin-sm)]">
                  Nom de l&apos;entreprise
                  <input
                    type="text"
                    name="raisonSociale"
                    required
                    maxLength={250}
                    className={champCls}
                  />
                </label>
                <p className="text-[length:var(--text-admin-xs)]">
                  Le contact garde son nom : {nomContact}.
                </p>
              </>
            ) : (
              <label className="block text-[length:var(--text-admin-sm)]">
                Prénom et nom du client
                <input
                  type="text"
                  name="raisonSociale"
                  required
                  maxLength={250}
                  defaultValue={props.contactFacturationNom ?? ""}
                  className={champCls}
                />
              </label>
            )}
            <button type="submit" className={boutonCls}>
              {estParticulier
                ? "Confirmer le passage en entreprise"
                : "Confirmer le retour en particulier"}
            </button>
          </form>
        </details>
      )}

      <p className="mt-2 text-[length:var(--text-admin-xs)] opacity-80">
        Une fiche entreprise part au CRM Pro ; repasser en particulier ne la retire pas du CRM Pro.
      </p>
    </section>
  );
}
