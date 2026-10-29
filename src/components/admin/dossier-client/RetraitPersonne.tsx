// RETIRER UNE PERSONNE d'une fiche client (ordre de Will du 26/10/2026). Composant serveur.
//
// Fermé : un lien « Retirer cette personne… » (rien n'est lu en base). Ouvert (`&retirer=<id>`) :
// le bilan — ce qui sera supprimé, ce qui l'empêche — et le mot EFFACER (validation 1 sur 2). Avec
// le jeton signé de la 1re étape (`&jeton=`), la validation 2 sur 2 : recopie du code ou du nom.
// Super-administrateur seul : sinon rien n'est affiché. Même dispositif que `SuppressionManuelle`.

import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  preparerRetraitPersonneAction,
  retirerPersonneAction,
} from "@/features/dossier-client/actions-suppression";
import {
  bilanRetraitPersonne,
  empreinteRetrait,
  MESSAGE_RETRAIT_BLOQUE,
} from "@/features/dossier-client/retrait-personne";
import { lireJetonSuppression } from "@/features/dossier-client/suppression-jeton";
import { MOT_CONFIRMATION } from "@/features/dossier-client/suppression-manuelle";

const mutedCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const formCls = "mt-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)]";

interface Proprietes {
  contactId: string;
  /** La fiche de la page : vérifiée côté serveur (la personne doit lui appartenir). */
  clientId: string;
  /** Super-administrateur : seul à voir et à utiliser ce bloc. */
  peutRetirer: boolean;
  /** La fiche, SANS paramètre (`?onglet=personnes&retirer=` y est ajouté). */
  page: string;
  /** Vrai si `&retirer=<cette personne>` est dans l'adresse : l'écran de confirmation. */
  ouvert: boolean;
  /** Raison d'un refus (message scellé de la page). */
  erreur?: string | null;
  /** Le jeton signé de la 1re validation : ouvre la 2e étape. */
  jeton?: string | null;
}

/** SYNCHRONE fermé : rien n'est lu. Seul l'écran ouvert à la demande lit la base. */
export function RetraitPersonne(props: Proprietes) {
  if (!props.peutRetirer) return null;
  if (!props.ouvert) {
    return (
      <p className={`mt-[var(--space-admin-2)] ${mutedCls}`} id={`retrait-${props.contactId}`}>
        <a
          href={`${props.page}?onglet=personnes&retirer=${props.contactId}#retrait-${props.contactId}`}
          className="underline"
          data-ouvrir-retrait={props.contactId}
        >
          Retirer cette personne…
        </a>{" "}
        (super-administrateur, double validation)
      </p>
    );
  }
  return <EcranDeRetrait {...props} />;
}

async function EcranDeRetrait(props: Proprietes) {
  const { bilan, cause } = await bilanRetraitPersonne(props.contactId).then(
    (b) => ({ bilan: b, cause: null as string | null }),
    (e: unknown) => {
      const texte = (e instanceof Error ? `${e.name} : ${e.message}` : String(e)).slice(0, 400);
      console.error("[retrait-personne] bilan illisible", props.contactId, texte);
      return { bilan: null, cause: texte as string | null };
    },
  );
  const lu = props.jeton ? lireJetonSuppression(props.jeton) : null;
  const jetonBon =
    lu !== null &&
    lu.ok &&
    bilan !== null &&
    lu.contenu.t === "personne" &&
    lu.contenu.i === props.contactId &&
    lu.contenu.b === empreinteRetrait(bilan);
  const alerteJeton =
    lu === null
      ? null
      : !lu.ok
        ? lu.motif
        : !jetonBon && bilan !== null
          ? "Ce qui serait supprimé a changé : recommencez."
          : null;
  return (
    <div
      id={`retrait-${props.contactId}`}
      data-bloc="retrait-personne"
      className="mt-[var(--space-admin-3)] rounded border border-[color:var(--color-admin-error)] p-[var(--space-admin-3)]"
    >
      <p className="font-semibold">Retirer cette personne de la fiche : définitif</p>
      {props.erreur ? (
        <p role="alert" data-erreur-retrait className="mt-[var(--space-admin-2)] font-semibold">
          {props.erreur}
        </p>
      ) : null}
      {alerteJeton ? (
        <p role="alert" data-erreur-jeton className="mt-[var(--space-admin-2)] font-semibold">
          {alerteJeton}
        </p>
      ) : null}
      {bilan === null ? (
        <>
          <p role="alert">Introuvable ou illisible : rien ne peut être retiré d&apos;ici.</p>
          {cause ? <p className={mutedCls}>Cause : {cause}</p> : null}
        </>
      ) : (
        <>
          <p className="mt-[var(--space-admin-2)]">
            <strong>{bilan.nom}</strong> · fiche {bilan.numeroFiche}
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
            La fiche, ses factures et ses devis restent. Le CRM Pro n&apos;est pas modifié. Une
            trace (qui, quand, quoi, sans nom ni adresse) est gardée.
          </p>
          {bilan.bloquants.length > 0 ? (
            <div role="alert" data-bloquants className="mt-[var(--space-admin-2)] font-semibold">
              <p>{MESSAGE_RETRAIT_BLOQUE}</p>
              <ul>
                {bilan.bloquants.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : jetonBon && props.jeton ? (
            <form action={retirerPersonneAction} className={formCls}>
              <input type="hidden" name="contactId" value={props.contactId} />
              <input type="hidden" name="clientId" value={props.clientId} />
              <input type="hidden" name="page" value={props.page} />
              <input type="hidden" name="jeton" value={props.jeton} />
              <p className="w-full font-semibold">Validation 2 sur 2 : dernière étape</p>
              <p className="w-full">
                Pour confirmer, recopiez le code <strong data-code-retrait>{bilan.code}</strong> ou
                le nom de la personne.
              </p>
              <input
                name="code"
                required
                autoComplete="off"
                placeholder="Recopiez le code ou le nom"
                aria-label="Recopie du code ou du nom"
                className="admin-input"
              />
              <AdminButton type="submit" variant="danger">
                Retirer définitivement
              </AdminButton>
              <p className={`w-full ${mutedCls}`}>
                Valable 5 minutes. Après ce clic, rien ne peut être annulé.
              </p>
            </form>
          ) : (
            <form action={preparerRetraitPersonneAction} className={formCls}>
              <input type="hidden" name="contactId" value={props.contactId} />
              <input type="hidden" name="clientId" value={props.clientId} />
              <input type="hidden" name="page" value={props.page} />
              <input
                name="confirmation"
                required
                autoComplete="off"
                placeholder={`Écrivez ${MOT_CONFIRMATION}`}
                aria-label="Confirmation du retrait définitif"
                className="admin-input"
              />
              <AdminButton type="submit" variant="danger">
                Continuer : validation 1 sur 2
              </AdminButton>
            </form>
          )}
        </>
      )}
      <p className="mt-[var(--space-admin-2)]">
        <a href={`${props.page}?onglet=personnes`} className="underline">
          Annuler
        </a>
      </p>
    </div>
  );
}
