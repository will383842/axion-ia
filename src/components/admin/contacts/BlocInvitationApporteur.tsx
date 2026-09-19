// Bloc « Inviter à un échange de 15 minutes » de la fiche d'un contact
// apporteur (Contacts › Commercial), 2026-09-19.
//
// Server Component, AUCUN JavaScript client : un formulaire posté vers une
// Server Action, qui redirige vers la fiche avec `?invitation=<résultat>`.
//
// Il dit, dans l'ordre : ce que l'e-mail contient, si une invitation est déjà
// partie (lu dans le JOURNAL DES ENVOIS, pas dans une intention), et le
// résultat du dernier geste. Le lien Calendly est pré-rempli par
// `CALENDLY_APPORTEUR_URL` et reste modifiable.

import { envoyerInvitationDepuisFicheAction } from "@/features/commercial-application/invitation-actions";
import {
  lireInvitationsEnvoyees,
  type InvitationEnvoyee,
} from "@/features/commercial-application/invitation-apporteur";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { env } from "@/env";

/** Ce que l'écran dit après le geste — une phrase par issue possible. */
const RESULTATS: Record<string, { ton: "success" | "error"; texte: string }> = {
  envoyee: {
    ton: "success",
    texte:
      "Invitation mise en file : elle part dans la minute, avec le document de présentation et le catalogue.",
  },
  "lien-invalide": {
    ton: "error",
    texte: "Rien n'est parti : le lien doit être une adresse https://calendly.com/… complète.",
  },
  retenu: {
    ton: "error",
    texte: "Rien n'est parti : cette adresse est retenue (désinscription ou adresse en erreur).",
  },
  "file-indisponible": {
    ton: "error",
    texte: "Rien n'est parti : la file d'envoi est indisponible. Réessaie dans un instant.",
  },
  efface: {
    ton: "error",
    texte: "Rien n'est parti : les coordonnées de cette personne ont été effacées.",
  },
  "pas-un-apporteur": {
    ton: "error",
    texte: "Rien n'est parti : cette fiche n'est pas un contact du réseau d'apporteurs.",
  },
  introuvable: { ton: "error", texte: "Rien n'est parti : cette fiche n'existe plus." },
  "non-autorise": {
    ton: "error",
    texte: "Rien n'est parti : ton rôle ne permet pas d'envoyer d'e-mail depuis la console.",
  },
};

/** Le statut du journal, en mots. */
function statutLisible(s: string): string {
  if (s === "sent") return "envoyée";
  if (s === "failed") return "en échec";
  if (s === "bounced") return "adresse en erreur";
  if (s === "cancelled") return "annulée";
  return "en cours d'envoi";
}

export async function BlocInvitationApporteur({
  submissionId,
  resultat,
}: {
  submissionId: string;
  /** Valeur de `?invitation=` après un envoi, s'il y en a eu un. */
  resultat?: string | undefined;
}) {
  const envoyees: InvitationEnvoyee[] = await lireInvitationsEnvoyees(submissionId);
  const lienParDefaut = env.CALENDLY_APPORTEUR_URL ?? "";
  const retour = resultat ? RESULTATS[resultat] : undefined;

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

      {envoyees.length > 0 ? (
        <p className="admin-help">
          Invitation déjà envoyée :{" "}
          {envoyees
            .map((e) => `${formatDateFrShort(e.le)} (${statutLisible(e.statut)})`)
            .join(" · ")}
        </p>
      ) : null}

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
        <button type="submit" className="admin-button">
          {envoyees.length > 0 ? "Renvoyer l'invitation" : "Envoyer l'invitation"}
        </button>
      </form>
    </div>
  );
}
