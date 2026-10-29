// Bloc « Questionnaire avant audit » de la fiche client (lot 1, 25/10/2026).
//
// Composant SERVEUR sans JavaScript, en lecture seule : il ne déclenche aucun envoi. L'envoi
// reste le clic de Will sur la page du rendez-vous, après l'aperçu exact de l'e-mail.

import Link from "next/link";

import type { QuestionnaireDeLaFiche } from "@/features/dossier-client/questionnaires-de-la-fiche";

import type { ActionLireBrouillon } from "./LireBrouillonPreaudit";
import { SuiviParPersonne } from "./SuiviParPersonne";

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
  lireBrouillon,
  voitBrouillons = false,
  voitAdresses = false,
  peutExporter = false,
}: {
  questionnaires: ReadonlyArray<QuestionnaireDeLaFiche>;
  adminPrefix: string;
  /** La fiche : un questionnaire envoyé sans rendez-vous s'ouvre dans sa page « Questionnaire ». */
  ficheHref: string;
  /** Interrupteur `QUESTIONNAIRE_SUIVI_ENABLED` : ouvertures et avancée. */
  afficherOuvertures?: boolean;
  /**
   * L'action « Lire le brouillon », passée par la page au super-administrateur seulement, interrupteur
   * `QUESTIONNAIRE_SUIVI_ENABLED` allumé (l'action revérifie). Absente : pas de bouton.
   */
  lireBrouillon?: ActionLireBrouillon;
  /** Super-administrateur, interrupteur du suivi allumé : voit aussi les noms tirés d'un brouillon. */
  voitBrouillons?: boolean;
  voitAdresses?: boolean;
  /** Super-administrateur, interrupteur d'export allumé : lien « Télécharger une copie ». */
  peutExporter?: boolean;
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
              {q.envoyeLe !== null && q.parPersonne != null && r.aTraiter > 0 ? (
                <p>{r.aTraiter} à traiter.</p>
              ) : null}
              {q.envoyeLe !== null && q.parPersonne == null ? (
                <p>
                  {r.dirigeant + r.referentInformatique + r.collaborateurs === 0
                    ? "Aucune réponse reçue pour l'instant."
                    : `Réponses reçues : dirigeant ${r.dirigeant}, collaborateurs ${r.collaborateurs}, référent informatique ${r.referentInformatique}.`}
                  {r.aTraiter > 0 ? ` ${r.aTraiter} à traiter.` : ""}
                </p>
              ) : null}
              {q.envoyeLe !== null ? (
                <SuiviParPersonne
                  q={q}
                  ficheHref={ficheHref}
                  afficherOuvertures={afficherOuvertures}
                  voitBrouillons={voitBrouillons}
                  voitAdresses={voitAdresses}
                  peutExporter={peutExporter}
                  lireBrouillon={lireBrouillon}
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
