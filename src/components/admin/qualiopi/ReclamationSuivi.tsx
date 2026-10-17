/**
 * ReclamationSuivi — le suivi daté d'une réclamation (chantier QNC, L09).
 *
 * Affiche le journal des étapes (date du serveur à l'heure de Paris, auteur
 * réel), les deux échéances en jours ouvrés, la session rattachée par
 * l'inscription, les actions d'amélioration qui la citent et l'état de l'e-mail
 * de réponse dans la corbeille. Propose seulement les étapes qui peuvent suivre.
 *
 * Server Component : la lecture (journal, échéances, rattachements) n'envoie
 * aucun JavaScript. Seul l'ajout d'une étape est interactif, dans
 * `ReclamationEtapeForm` (îlot client).
 */

import type { ajouterEtapeReclamationAction } from "@/server/actions/qualiopi/reclamations";
import { LIBELLE_ETAPE } from "@/server/qualiopi/reclamations/cycle";
import type { EtapeCode, EtatEcheance } from "@/server/qualiopi/reclamations/echeances";
import { ReclamationEtapeForm } from "./ReclamationEtapeForm";

const DATE_HEURE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
});
const DATE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const LIBELLE_ECHEANCE: Record<EtatEcheance, string> = {
  fait: "fait",
  dans_les_temps: "dans les temps",
  proche: "échéance proche",
  depassee: "échéance dépassée",
};

const CLASSE_ECHEANCE: Record<EtatEcheance, string> = {
  fait: "text-[color:var(--color-admin-success)]",
  dans_les_temps: "text-[color:var(--color-admin-fg-soft)]",
  proche: "text-[color:var(--color-admin-warning)]",
  depassee: "font-semibold text-[color:var(--color-admin-error)]",
};

const LIBELLE_EMAIL: Record<string, string> = {
  a_valider: "à valider dans la corbeille des e-mails",
  approuve: "approuvé, en cours d'envoi",
  envoye: "envoyé",
  refuse: "refusé dans la corbeille",
};

const petitCls = "text-[length:var(--text-admin-xs)]";

export interface ReclamationSuiviProps {
  reclamationId: string;
  numero: string;
  etapes: ReadonlyArray<{
    id: string;
    etape: EtapeCode;
    contenu: string;
    auteurNom: string;
    creeLe: Date;
  }>;
  possibles: ReadonlyArray<EtapeCode>;
  echeances: {
    accuse: EtatEcheance;
    reponse: EtatEcheance;
    accuseAvant: Date;
    reponseAvant: Date;
  };
  session: { libelle: string; href: string } | null;
  stagiaire: string | null;
  ameliorations: ReadonlyArray<{ id: string; numero: string; action: string }>;
  emailsReponse: ReadonlyArray<{ statut: string; creeLe: Date }>;
  /** Où ouvrir une action d'amélioration (registre AXI-AMC). */
  hrefAmelioration: string;
  ajouterEtapeAction: typeof ajouterEtapeReclamationAction;
}

export function ReclamationSuivi(props: ReclamationSuiviProps): React.ReactElement {
  return (
    <div className="flex min-w-72 flex-col gap-[var(--space-admin-3)]">
      <dl className={`${petitCls} grid grid-cols-[auto_1fr] gap-x-[var(--space-admin-2)]`}>
        <dt className="text-[color:var(--color-admin-fg-muted)]">Accusé</dt>
        <dd className={CLASSE_ECHEANCE[props.echeances.accuse]}>
          {LIBELLE_ECHEANCE[props.echeances.accuse]}
          {props.echeances.accuse !== "fait"
            ? ` — au plus tard le ${DATE_PARIS.format(props.echeances.accuseAvant)}`
            : ""}
        </dd>
        <dt className="text-[color:var(--color-admin-fg-muted)]">Réponse</dt>
        <dd className={CLASSE_ECHEANCE[props.echeances.reponse]}>
          {LIBELLE_ECHEANCE[props.echeances.reponse]}
          {props.echeances.reponse !== "fait"
            ? ` — au plus tard le ${DATE_PARIS.format(props.echeances.reponseAvant)}`
            : ""}
        </dd>
        <dt className="text-[color:var(--color-admin-fg-muted)]">Session</dt>
        <dd>
          {props.session ? (
            <a
              href={props.session.href}
              className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              {props.session.libelle}
            </a>
          ) : (
            "non rattachée"
          )}
          {props.stagiaire ? ` · ${props.stagiaire}` : ""}
        </dd>
        <dt className="text-[color:var(--color-admin-fg-muted)]">Amélioration</dt>
        <dd>
          {props.ameliorations.length > 0
            ? props.ameliorations.map((a) => a.numero).join(", ")
            : "aucune action liée"}{" "}
          <a
            href={props.hrefAmelioration}
            className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
          >
            (registre d&apos;amélioration)
          </a>
        </dd>
        {props.emailsReponse.length > 0 && (
          <>
            <dt className="text-[color:var(--color-admin-fg-muted)]">E-mail</dt>
            <dd>
              {props.emailsReponse
                .map(
                  (m) =>
                    `${LIBELLE_EMAIL[m.statut] ?? m.statut} (${DATE_HEURE_PARIS.format(m.creeLe)})`,
                )
                .join(" · ")}
            </dd>
          </>
        )}
      </dl>

      <ol className="flex flex-col gap-[var(--space-admin-2)] border-l border-[color:var(--color-admin-border)] pl-[var(--space-admin-3)]">
        {props.etapes.map((e) => (
          <li key={e.id} className={petitCls}>
            <span className="block font-medium">{LIBELLE_ETAPE[e.etape]}</span>
            <span className="block text-[color:var(--color-admin-fg-muted)]">
              {DATE_HEURE_PARIS.format(e.creeLe)} — {e.auteurNom}
            </span>
            <span className="whitespace-pre-line">{e.contenu}</span>
          </li>
        ))}
      </ol>

      <ReclamationEtapeForm
        reclamationId={props.reclamationId}
        numero={props.numero}
        possibles={props.possibles}
        ajouterEtapeAction={props.ajouterEtapeAction}
      />
    </div>
  );
}
