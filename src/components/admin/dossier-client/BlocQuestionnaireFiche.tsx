// Bloc « Questionnaire avant audit » de la fiche client (lot 1, 25/10/2026).
//
// Composant SERVEUR sans JavaScript, en lecture seule : il ne déclenche aucun envoi. L'envoi
// reste le clic de Will sur la page du rendez-vous, après l'aperçu exact de l'e-mail.

import Link from "next/link";

import type { QuestionnaireDeLaFiche } from "@/features/dossier-client/questionnaires-de-la-fiche";
import {
  lignesSuivi,
  personneLisible,
  TEXTE_JAMAIS_OUVERT,
} from "@/features/questionnaire-preaudit/ouvertures";

import { LireBrouillonPreaudit } from "./LireBrouillonPreaudit";

const jourHeure = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/** Le libellé dit ce qui est vrai : un échec ou un rebond n'est pas « en attente ». */
function libelleLienInvitation(statut: string | null): string {
  switch (statut) {
    case "sent":
      return "Voir l'e-mail d'invitation tel qu'il est parti";
    case "bounced":
      return "Voir l'e-mail d'invitation (rejeté par la boîte du destinataire)";
    case "failed":
      return "Voir l'e-mail d'invitation (échec d'envoi)";
    case "cancelled":
      return "Voir l'e-mail d'invitation (annulé)";
    default:
      return "Voir l'e-mail d'invitation (pas encore parti)";
  }
}

export function BlocQuestionnaireFiche({
  questionnaires,
  adminPrefix,
  ficheHref,
  afficherOuvertures = false,
  peutLireBrouillon = false,
}: {
  questionnaires: ReadonlyArray<QuestionnaireDeLaFiche>;
  adminPrefix: string;
  /** La fiche : un questionnaire envoyé sans rendez-vous s'ouvre dans sa page « Questionnaire ». */
  ficheHref: string;
  /** Interrupteur `QUESTIONNAIRE_SUIVI_OUVERTURES_ENABLED` : ouvertures et avancée. */
  afficherOuvertures?: boolean;
  /** Super-administrateur ET `QUESTIONNAIRE_SUIVI_BROUILLON_VISIBLE` : bouton « Lire le brouillon ». */
  peutLireBrouillon?: boolean;
}): React.ReactElement | null {
  if (questionnaires.length === 0) return null;
  const base = `/fr/${adminPrefix}`;
  return (
    <section aria-labelledby="questionnaire-fiche" className="admin-carte">
      <h2 id="questionnaire-fiche" className="admin-carte-titre">
        Questionnaire avant audit
      </h2>
      <ul className="space-y-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
        {questionnaires.map((q) => {
          const r = q.reponses;
          const total = r.dirigeant + r.referentInformatique + r.collaborateurs;
          const lienRdv =
            q.rencontreId === null
              ? `${ficheHref}/questionnaire?q=${q.id}`
              : `${base}/rendez-vous/rencontres/${q.rencontreId}`;
          return (
            <li key={q.id}>
              <p className="font-medium">
                {q.rencontreTitre ?? "Envoyé sans rendez-vous"}
                {q.rencontreDebut ? ` · ${jourHeure(q.rencontreDebut)}` : ""}
              </p>
              <p>
                {q.envoyeLe === null
                  ? "Pas encore envoyé : brouillon (rien n'est parti)."
                  : `Envoyé le ${jourHeure(q.envoyeLe)}.`}
                {q.closLe ? ` Clos le ${jourHeure(q.closLe)}.` : ""}
              </p>
              {q.envoyeLe !== null ? (
                <p>
                  {total === 0
                    ? "Aucune réponse reçue pour l'instant."
                    : `Réponses reçues : dirigeant ${r.dirigeant}, collaborateurs ${r.collaborateurs}, référent informatique ${r.referentInformatique}.`}
                  {r.aTraiter > 0 ? ` ${r.aTraiter} à traiter.` : ""}
                </p>
              ) : null}
              {q.envoyeLe !== null ? (
                <SuiviDuLien
                  q={q}
                  afficherOuvertures={afficherOuvertures}
                  peutLireBrouillon={peutLireBrouillon}
                />
              ) : null}
              <p className="mt-[var(--space-admin-1)] flex flex-wrap gap-x-[var(--space-admin-4)]">
                <Link href={lienRdv} className="admin-link">
                  {q.rencontreId === null
                    ? "Ouvrir le questionnaire"
                    : "Ouvrir le rendez-vous et le questionnaire"}
                </Link>
                {q.invitationEmailLogId ? (
                  <Link
                    href={`${base}/emails-envoyes/${q.invitationEmailLogId}`}
                    className="admin-link"
                  >
                    {libelleLienInvitation(q.invitationStatut)}
                  </Link>
                ) : (
                  <Link href={lienRdv} className="admin-link">
                    Voir l&apos;aperçu de l&apos;e-mail qui partira
                  </Link>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Ouvertures, avancée et brouillons d'un questionnaire envoyé (2026-10-27). Rien quand les deux
 * interrupteurs sont éteints. Une lecture en panne le DIT : jamais « jamais ouvert » à tort.
 */
function SuiviDuLien({
  q,
  afficherOuvertures,
  peutLireBrouillon,
}: {
  q: QuestionnaireDeLaFiche;
  afficherOuvertures: boolean;
  peutLireBrouillon: boolean;
}): React.ReactElement | null {
  if (!afficherOuvertures && !peutLireBrouillon) return null;
  if (q.suiviEnPanne === true) {
    return <p>Suivi des ouvertures : lecture impossible pour le moment.</p>;
  }
  const suivi = q.suivi;
  if (suivi == null) return null;
  if (afficherOuvertures) {
    const lignes = lignesSuivi(suivi);
    return (
      <div className="mt-[var(--space-admin-2)]" data-bloc="suivi-ouvertures">
        <p className="font-medium">Ouvertures et avancée</p>
        {lignes.length === 0 ? (
          <p>{TEXTE_JAMAIS_OUVERT}</p>
        ) : (
          <ul className="space-y-[var(--space-admin-1)]">
            {lignes.map((l) => (
              <li key={l.cle}>
                <span className="font-medium">{l.personne}</span> : {l.texte}
                {peutLireBrouillon && l.brouillonId !== null ? (
                  <LireBrouillonPreaudit brouillonId={l.brouillonId} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  // Seule la lecture des brouillons est allumée : la liste des brouillons, sans les ouvertures.
  if (suivi.brouillons.length === 0) return null;
  return (
    <div className="mt-[var(--space-admin-2)]" data-bloc="suivi-brouillons">
      <p className="font-medium">Brouillons en cours</p>
      <ul className="space-y-[var(--space-admin-1)]">
        {suivi.brouillons.map((b) => (
          <li key={b.id}>
            <span className="font-medium">{personneLisible(b.mode, b.membre)}</span> : enregistré le{" "}
            {jourHeure(b.majLe)}
            <LireBrouillonPreaudit brouillonId={b.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
