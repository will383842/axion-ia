/**
 * Bloc « Type de fiche » de la page de modification d'un client — HORS du formulaire différentiel
 * (`ClientEditForm`). Composant serveur, zéro JavaScript : `<details>` déplie le formulaire, la
 * soumission passe par une action serveur (`changerTypeClientFormAction`).
 *
 * `blocage` (calculé par la page) : la raison, déjà rédigée, pour laquelle le type ne peut pas
 * changer (pièces portées, informations d'employeur). Bloc grisé, aucun formulaire.
 */

import { SIREN_SAISIE_LONGUEUR_MAX } from "@/lib/siret";
import { changerTypeClientFormAction } from "@/server/actions/qualiopi/clients";
import type { ApercuCrmPro } from "@/server/crm-sync/apercu-dossier";

export interface ChangerTypeClientProps {
  clientId: string;
  type: "entreprise" | "particulier";
  /** Nom du contact de la fiche (`Client.contactNom`), qui ne change pas ; préremplit « Repasser en particulier ». */
  contactNom: string | null;
  /** Nom actuel de la fiche (`Client.raisonSociale`) : sert au lien d'aide vers l'annuaire des entreprises. */
  raisonSociale?: string | null;
  blocage: string | null;
  /**
   * Ce qui partira au CRM Pro, construit par les fonctions pures de l'envoi (`apercuPourCrm`) :
   * l'écran ne peut pas s'écarter de la synchro. `null` : lecture impossible, le dit sans rien annoncer.
   */
  apercu: ApercuCrmPro | null;
}

const champCls =
  "mt-1 block w-full rounded border border-[color:var(--color-admin-border)] bg-white px-2 py-1 text-[length:var(--text-admin-sm)]";
const boutonCls =
  "rounded bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] text-white";

function phraseCrmPro(apercu: ApercuCrmPro | null): string {
  if (apercu === null) {
    return "Le détail de l'envoi au CRM Pro n'a pas pu être lu : rien n'est annoncé ici.";
  }
  const propre = (v: string | null) => v?.trim() ?? "";
  const ville = [apercu.codePostal, apercu.ville]
    .map(propre)
    .filter((v) => v !== "")
    .join(" ");
  const adresse = [propre(apercu.rue), ville].filter((v) => v !== "").join(", ");
  const contacts =
    apercu.contacts.length === 0
      ? "aucun contact"
      : "contacts : " +
        apercu.contacts
          .map((c) => {
            const details = [c.fonction, c.telephone, c.email].map(propre).filter((v) => v !== "");
            return details.length > 0 ? `${c.nom} (${details.join(", ")})` : c.nom;
          })
          .join(" ; ");
  const { etape, questionnaire, nbEchanges, prochaineAction } = apercu.etat;
  const etat: string[] = [];
  if (etape !== null) etat.push(`étape : ${etape}`);
  if (questionnaire !== null) {
    etat.push(
      questionnaire.recuLe
        ? `questionnaire reçu le ${questionnaire.recuLe}`
        : questionnaire.envoyeLe
          ? `questionnaire envoyé le ${questionnaire.envoyeLe}`
          : "questionnaire",
    );
  }
  if (nbEchanges !== null) etat.push(`${nbEchanges} échange${nbEchanges > 1 ? "s" : ""}`);
  if (prochaineAction !== null) {
    etat.push(`prochaine action : ${prochaineAction.type} le ${prochaineAction.date}`);
  }
  const etatDossier =
    etat.length > 0 ? `l'état du dossier (${etat.join(", ")})` : "l'état du dossier";
  return `Partira au CRM Pro : le nom de l'entreprise saisi ci-dessus, ${adresse !== "" ? adresse : "aucune adresse renseignée"} ; ${contacts} ; et ${etatDossier}.`;
}

export function ChangerTypeClient(props: ChangerTypeClientProps) {
  const { clientId, type, blocage } = props;
  const estParticulier = type === "particulier";
  const termeAnnuaire = (props.raisonSociale ?? "").trim();
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
          className="mt-2 rounded bg-[color:var(--color-admin-surface-alt)] p-2 text-[length:var(--text-admin-xs)] opacity-70"
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
            {estParticulier ? (
              <div>
                <label className="block text-[length:var(--text-admin-sm)]">
                  SIREN (9 chiffres)
                  <input
                    type="text"
                    name="siren"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={SIREN_SAISIE_LONGUEUR_MAX}
                    placeholder="facultatif"
                    className={champCls}
                  />
                </label>
                <p className="mt-1 text-[length:var(--text-admin-xs)]">
                  Les espaces sont acceptés. Avec un SIREN valide, le CRM Pro rattache directement
                  le dossier à l&apos;entreprise ; sans SIREN, il le met en arbitrage manuel.
                  {termeAnnuaire !== "" ? (
                    <>
                      {" "}
                      <a
                        href={`https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(termeAnnuaire)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[color:var(--color-admin-accent)] underline"
                      >
                        Chercher dans l&apos;annuaire des entreprises
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}
            <label className="block text-[length:var(--text-admin-sm)]">
              Motif (facultatif)
              <input type="text" name="motif" maxLength={300} className={champCls} />
            </label>
            {estParticulier ? (
              <p className="text-[length:var(--text-admin-xs)]">{phraseCrmPro(props.apercu)}</p>
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
