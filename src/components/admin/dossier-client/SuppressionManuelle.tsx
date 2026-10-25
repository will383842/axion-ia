// Suppression MANUELLE depuis la console (demande de Will du 25/10/2026). Composant serveur.
//
// Fermé : un lien « Supprimer… » (rien n'est lu en base). Ouvert (`?supprimer=<type>`) : l'écran de
// confirmation — nom, e-mail, ce qui sera supprimé (compteurs), ce qui l'empêche — et le
// formulaire avec le mot EFFACER. Super-administrateur seul : sinon rien n'est affiché.

import { supprimerManuellementAction } from "@/features/dossier-client/actions-suppression";
import {
  bilanSuppression,
  MESSAGE_BLOQUE,
  MOT_CONFIRMATION,
  type TypeCible,
} from "@/features/dossier-client/suppression-manuelle";

const carteCls =
  "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border-2 border-[color:var(--color-admin-danger)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]";
const mutedCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const boutonCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-danger)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-danger)]";

const QUOI: Readonly<Record<TypeCible, string>> = {
  questionnaire: "le questionnaire et toutes ses réponses",
  rencontre: "cette rencontre",
  client: "cette fiche client",
};

export async function SuppressionManuelle(props: {
  type: TypeCible;
  id: string;
  /** Super-administrateur : seul à voir et à utiliser ce bloc. */
  peutSupprimer: boolean;
  /** La page courante, SANS paramètre (`?supprimer=` y est ajouté). */
  page: string;
  /** Vrai si `?supprimer=<type>` est dans l'adresse : l'écran de confirmation. */
  ouvert: boolean;
  /** Raison d'un refus (message scellé de la page), affichée sur l'écran de confirmation. */
  erreur?: string | null;
}) {
  if (!props.peutSupprimer) return null;
  const lienOuvrir = `${props.page}?supprimer=${props.type}#suppression-${props.type}`;
  if (!props.ouvert) {
    return (
      <p className={mutedCls} id={`suppression-${props.type}`}>
        <a href={lienOuvrir} className="underline" data-ouvrir-suppression={props.type}>
          Supprimer {QUOI[props.type]}…
        </a>{" "}
        (super-administrateur, après confirmation)
      </p>
    );
  }
  const bilan = await bilanSuppression(props.type, props.id).catch(() => null);
  return (
    <section
      className={carteCls}
      id={`suppression-${props.type}`}
      data-bloc={`suppression-${props.type}`}
    >
      <h2 className="mb-[var(--space-admin-2)] font-semibold">
        Supprimer {QUOI[props.type]} : définitif
      </h2>
      {props.erreur ? (
        <p role="alert" data-erreur-suppression className="mb-[var(--space-admin-2)] font-semibold">
          {props.erreur}
        </p>
      ) : null}
      {bilan === null ? (
        <p role="alert">Introuvable ou illisible : rien ne peut être supprimé d&apos;ici.</p>
      ) : (
        <>
          <p>
            <strong>{bilan.nom}</strong>
            {bilan.email ? ` · ${bilan.email}` : ""}
          </p>
          <p className="mt-[var(--space-admin-2)]">Ce qui sera supprimé :</p>
          <ul data-compteurs>
            {bilan.compteurs.map((c) => (
              <li key={c.libelle}>
                {c.n} {c.libelle}
              </li>
            ))}
          </ul>
          <p className={mutedCls}>
            Les e-mails déjà partis restent dans le journal des envois. Une trace (qui, quand, quoi,
            sans contenu) est gardée.
          </p>
          {bilan.bloquants.length > 0 ? (
            <div role="alert" data-bloquants className="mt-[var(--space-admin-2)] font-semibold">
              <p>{MESSAGE_BLOQUE}</p>
              <ul>
                {bilan.bloquants.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <form
              action={supprimerManuellementAction}
              className="mt-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)]"
            >
              <input type="hidden" name="type" value={props.type} />
              <input type="hidden" name="id" value={props.id} />
              <input type="hidden" name="page" value={props.page} />
              <input
                name="confirmation"
                required
                autoComplete="off"
                placeholder={`Écrivez ${MOT_CONFIRMATION}`}
                aria-label="Confirmation de la suppression définitive"
                className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-1)]"
              />
              <button type="submit" className={boutonCls}>
                Supprimer définitivement
              </button>
            </form>
          )}
        </>
      )}
      <p className="mt-[var(--space-admin-2)]">
        <a href={props.page} className="underline">
          Annuler
        </a>
      </p>
    </section>
  );
}
