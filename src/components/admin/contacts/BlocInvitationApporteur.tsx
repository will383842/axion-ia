// Bloc « Inviter à un échange de 15 minutes » de la fiche d'un contact
// apporteur (Contacts › Commercial), 2026-09-19.
//
// Server Component, AUCUN JavaScript client : un formulaire posté vers une
// Server Action, qui redirige vers la fiche avec `?invitation=<résultat>`.
//
// Il dit, dans l'ordre : ce que l'e-mail contient, si une invitation est déjà
// partie ou attend validation (lu dans le JOURNAL DES ENVOIS et la corbeille,
// sur TOUTES les lignes de la personne — pas dans une intention), et le
// résultat du dernier geste. Le lien Calendly est pré-rempli par
// `CALENDLY_APPORTEUR_URL` et reste modifiable.
//
// 2026-09-19 — deux cases, sans JavaScript :
//   · « Renvoyer quand même », seulement si une invitation existe déjà, et
//     OBLIGATOIRE quand elle s'affiche : jamais deux invitations par mégarde. Le
//     navigateur demande la confirmation avant l'envoi, et l'action la revérifie ;
//   · « La personne a accepté d'être contactée », seulement pour une adresse
//     venue d'ailleurs (recommandation, autre) dont l'accord n'est pas encore
//     daté sur la fiche (L.34-5 CPCE).

import { envoyerInvitationDepuisFicheAction } from "@/features/commercial-application/invitation-actions";
import {
  lireInvitationsDeLaPersonne,
  type InvitationEnvoyee,
} from "@/features/commercial-application/invitation-apporteur";
import {
  ORIGINE_INTERDITE,
  ORIGINES_ACCORD_REQUIS,
} from "@/lib/commercial-application/saisie-manuelle";
import { ORIGINE_SAISIE_MANUELLE } from "@/lib/contact/accuse-attendu";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { estCodeIssue, phraseInvitation } from "@/lib/commercial-application/issues-invitation";
import { env } from "@/env";

/** Une invitation, en mots : « Déjà invité le … » ou « En attente de validation ». */
function ligneHistorique(e: InvitationEnvoyee): string {
  if (e.statut === "a_valider") {
    return `En attente de validation depuis le ${formatDateFrShort(e.le)}`;
  }
  if (e.statut === "pending") return `Déjà invité le ${formatDateFrShort(e.le)} (en cours d'envoi)`;
  return `Déjà invité le ${formatDateFrShort(e.le)}`;
}

export async function BlocInvitationApporteur({
  submissionId,
  resultat,
  details,
}: {
  submissionId: string;
  /** Valeur de `?invitation=` après un envoi, s'il y en a eu un. */
  resultat?: string | undefined;
  /** `details` de la fiche : origine d'une saisie manuelle et accord déjà daté. */
  details?: Record<string, unknown> | null | undefined;
}) {
  const invitations: InvitationEnvoyee[] = await lireInvitationsDeLaPersonne(submissionId);
  const lienParDefaut = env.CALENDLY_APPORTEUR_URL ?? "";
  // 🔑 Les phrases ne vivent PLUS ici. Elles vivaient en deux exemplaires —
  // un ici, un dans `invitation-apporteur.ts` — et SEPT DES NEUF avaient deja
  // diverge : le meme refus se lisait autrement selon la porte par laquelle on
  // etait entre. Le code vient de l'URL : un code inconnu n'affiche rien.
  const retour = estCodeIssue(resultat) ? phraseInvitation(resultat) : undefined;

  const saisieManuelle = details?.["origine"] === ORIGINE_SAISIE_MANUELLE;
  const origine = typeof details?.["origineSaisie"] === "string" ? details["origineSaisie"] : "";
  const origineInterdite = saisieManuelle && origine === ORIGINE_INTERDITE;
  const accordADemander =
    saisieManuelle &&
    ORIGINES_ACCORD_REQUIS.includes(origine) &&
    typeof details?.["accordContactAt"] !== "string";

  return (
    <div className="admin-card admin-card-wide" id="invitation">
      <h2 className="admin-h2">Inviter à un échange de 15 minutes</h2>
      <p className="admin-help">
        Un e-mail avec le lien de réservation Calendly, le document de présentation et le catalogue
        — et le lien du dossier si la personne ne l&apos;a pas encore envoyé. Rien ne part
        automatiquement : c&apos;est toi qui choisis qui inviter.
      </p>

      {retour ? (
        <p
          className={
            retour.ton === "success"
              ? "admin-alert admin-alert-success"
              : "admin-alert admin-alert-error"
          }
          role="status"
        >
          {retour.texte}
        </p>
      ) : null}

      {invitations.length > 0 ? (
        <p className="admin-help">{invitations.map(ligneHistorique).join(" · ")}</p>
      ) : null}

      {origineInterdite ? (
        <p className="admin-alert admin-alert-error">
          Adresse relevée sur l&apos;annonce d&apos;un tiers : pas d&apos;invitation. La personne ne
          nous a pas donné son adresse.
        </p>
      ) : (
        <form action={envoyerInvitationDepuisFicheAction} className="admin-form-row">
          <input type="hidden" name="submissionId" value={submissionId} />
          <div className="admin-field">
            <label htmlFor="calendlyUrl" className="admin-label">
              Lien Calendly de l&apos;échange (15 min)
            </label>
            <input
              id="calendlyUrl"
              name="calendlyUrl"
              type="url"
              required
              defaultValue={lienParDefaut}
              placeholder="https://calendly.com/axion-ia/echange-apporteur"
              className="admin-input"
            />
          </div>
          {accordADemander ? (
            <label className="admin-checkbox-label" htmlFor="accordContact">
              <input id="accordContact" name="accordContact" type="checkbox" value="on" required />{" "}
              La personne a accepté d&apos;être contactée
            </label>
          ) : null}
          {invitations.length > 0 ? (
            // `required` : le bouton dit déjà « Renvoyer l'invitation », donc un clic
            // sans la case ressemblait à un bouton cassé — l'action rendait
            // `deja-invitee` après l'aller-retour. Le navigateur demande la
            // confirmation AVANT le voyage ; le garde-fou serveur reste en place pour
            // un envoi qui arriverait sans elle.
            <label className="admin-checkbox-label" htmlFor="renvoyer">
              <input id="renvoyer" name="renvoyer" type="checkbox" value="on" required /> Renvoyer
              quand même — à cocher pour confirmer un second envoi
            </label>
          ) : null}
          <button type="submit" className="admin-button">
            {invitations.length > 0 ? "Renvoyer l'invitation" : "Envoyer l'invitation"}
          </button>
        </form>
      )}
    </div>
  );
}
