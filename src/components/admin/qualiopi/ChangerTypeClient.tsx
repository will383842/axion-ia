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
  /** Nom du contact de la fiche (`Client.contactNom`), qui ne change pas ; préremplit « Repasser en particulier ». */
  contactNom: string | null;
  blocage: string | null;
  /** Adresse de la fiche (déjà visible sur elle) : dite avant l'envoi au CRM Pro. */
  adresseCodePostal: string | null;
  adresseVille: string | null;
  /** Contacts de la fiche (déjà visibles sur elle) : nom, fonction, téléphone. */
  contacts: ReadonlyArray<{
    nom: string;
    fonction: string | null;
    telephone: string | null;
  }>;
}

const champCls =
  "mt-1 block w-full rounded border border-[color:var(--color-admin-border)] bg-white px-2 py-1 text-[length:var(--text-admin-sm)]";
const boutonCls =
  "rounded bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] text-white";

function phraseCrmPro(props: ChangerTypeClientProps): string {
  const ville = [props.adresseCodePostal, props.adresseVille]
    .map((v) => v?.trim() ?? "")
    .filter((v) => v !== "")
    .join(" ");
  const adresse = ville !== "" ? `l'adresse de la fiche (${ville})` : "aucune adresse renseignée";
  const contacts =
    props.contacts.length === 0
      ? "aucun contact sur la fiche"
      : "pour chaque contact son nom, sa fonction et son téléphone : " +
        props.contacts
          .map((c) => {
            const details = [c.fonction, c.telephone]
              .map((v) => v?.trim() ?? "")
              .filter((v) => v !== "");
            return details.length > 0 ? `${c.nom} (${details.join(", ")})` : c.nom;
          })
          .join(" ; ");
  return `Partira au CRM Pro : le nom de l'entreprise, ${adresse}, et ${contacts}.`;
}

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
                  defaultValue={props.contactNom ?? ""}
                  className={champCls}
                />
              </label>
            )}
            <label className="block text-[length:var(--text-admin-sm)]">
              Motif (facultatif)
              <input type="text" name="motif" maxLength={300} className={champCls} />
            </label>
            {estParticulier ? (
              <p className="text-[length:var(--text-admin-xs)]">{phraseCrmPro(props)}</p>
            ) : null}
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
