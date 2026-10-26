// Suppression MANUELLE depuis la console (demande de Will du 25/10/2026). Composant serveur.
//
// Fermé : un lien « Supprimer… » (rien n'est lu en base). Ouvert (`?supprimer=<type>`) : l'écran de
// confirmation — nom, e-mail, ce qui sera supprimé (compteurs), ce qui l'empêche — et le
// formulaire avec le mot EFFACER. Super-administrateur seul : sinon rien n'est affiché.

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { supprimerManuellementAction } from "@/features/dossier-client/actions-suppression";
import {
  bilanSuppression,
  MESSAGE_BLOQUE,
  MOT_CONFIRMATION,
  type TypeCible,
} from "@/features/dossier-client/suppression-manuelle";

const mutedCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

const QUOI: Readonly<Record<TypeCible, string>> = {
  questionnaire: "le questionnaire et toutes ses réponses",
  rencontre: "ce rendez-vous",
  client: "cette fiche client",
};

interface Proprietes {
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
}

/**
 * SYNCHRONE : fermé (ou sans droit), rien n'est lu et rien ne suspend le rendu de la page. Seul
 * l'écran de confirmation, ouvert à la demande, lit la base (`EcranDeConfirmation`).
 */
export function SuppressionManuelle(props: Proprietes) {
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
  return <EcranDeConfirmation {...props} />;
}

async function EcranDeConfirmation(props: Proprietes) {
  const bilan = await bilanSuppression(props.type, props.id).catch(() => null);
  return (
    <AdminBloc
      teinte="terracotta"
      haut
      id={`suppression-${props.type}`}
      titre={`Supprimer ${QUOI[props.type]} : définitif`}
    >
      <div data-bloc={`suppression-${props.type}`}>
        {props.erreur ? (
          <p
            role="alert"
            data-erreur-suppression
            className="mb-[var(--space-admin-2)] font-semibold"
          >
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
              Les e-mails déjà partis restent dans le journal des envois. Une trace (qui, quand,
              quoi, sans contenu) est gardée.
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
                  className="admin-input"
                />
                <AdminButton type="submit" variant="danger">
                  Supprimer définitivement
                </AdminButton>
              </form>
            )}
          </>
        )}
        <p className="mt-[var(--space-admin-2)]">
          <a href={props.page} className="underline">
            Annuler
          </a>
        </p>
      </div>
    </AdminBloc>
  );
}
