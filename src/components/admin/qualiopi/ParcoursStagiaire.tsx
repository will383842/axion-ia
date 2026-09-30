/**
 * Le dossier d'une personne, inscription par inscription (audit du 2026-09-30).
 * Composant serveur, lecture seule : aucune donnée de santé n'y figure.
 */

import Link from "next/link";

import type { ParcoursStagiaire } from "@/server/qualiopi/trainees/parcours-stagiaire";
import { libelleTypeDocument } from "@/server/qualiopi/documents/libelles-type-document";

const STATUT_INSCRIPTION: Readonly<Record<string, string>> = {
  planifiee: "Planifiée",
  presente: "Présente",
  abandon: "Abandon",
  exclu: "Exclu(e)",
};

const STATUT_SESSION: Readonly<Record<string, string>> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

const TYPE_QUESTIONNAIRE: Readonly<Record<string, string>> = {
  positionnement: "Positionnement",
  satisfaction_chaud: "Satisfaction à chaud",
  satisfaction_froid: "Satisfaction à froid",
  satisfaction_entreprise: "Satisfaction entreprise",
};

const RESULTAT_ATTESTATION: Readonly<Record<string, string>> = {
  complete: "complète",
  partielle: "partielle",
  aucune: "aucune heure suivie",
};

/** Une valeur inconnue reste visible, entre guillemets, plutôt que de disparaître. */
function libelle(table: Readonly<Record<string, string>>, cle: string): string {
  return table[cle] ?? `« ${cle} »`;
}

const jour = (d: Date): string =>
  d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const cellCls =
  "px-[var(--space-admin-3)] py-[var(--space-admin-2)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const headCls =
  "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

export function ParcoursStagiaireSection({
  parcours,
  sessionsHref,
}: {
  parcours: ParcoursStagiaire;
  /** `/…/qualiopi/sessions` — la fiche de chaque session s'y ouvre par son id. */
  sessionsHref: string;
}): React.ReactElement {
  return (
    <section
      aria-labelledby="parcours-titre"
      className="mt-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]"
    >
      <h2
        id="parcours-titre"
        className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
      >
        Parcours et dossier
      </h2>
      <p className="mt-[var(--space-admin-1)] mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Ce que l&apos;auditeur demande en disant « montrez-moi le dossier de cette personne » :
        chaque inscription, et les pièces nominatives émises pour elle.
      </p>

      {parcours.inscriptions.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune inscription à ce jour.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={headCls}>Session</th>
                <th className={headCls}>Inscription</th>
                <th className={headCls}>Convocation</th>
                <th className={headCls}>Présence</th>
                <th className={headCls}>Questionnaires</th>
                <th className={headCls}>Évaluation finale</th>
                <th className={headCls}>Attestation</th>
              </tr>
            </thead>
            <tbody>
              {parcours.inscriptions.map((i) => (
                <tr
                  key={i.enrollmentId}
                  className="border-t border-[color:var(--color-admin-border)]"
                >
                  <td className={cellCls}>
                    <Link
                      href={`${sessionsHref}/${i.sessionId}`}
                      className="font-medium text-[color:var(--color-admin-accent)] underline"
                    >
                      {i.sessionNumero}
                    </Link>
                    <span className="block">{i.formationTitre}</span>
                    <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {`${jour(i.dateDebut)} → ${jour(i.dateFin)} · ${libelle(STATUT_SESSION, i.statutSession)}`}
                    </span>
                  </td>
                  <td className={cellCls}>{libelle(STATUT_INSCRIPTION, i.statutInscription)}</td>
                  <td className={cellCls}>
                    {i.convocationEnvoyeeAt
                      ? `Envoyée le ${jour(i.convocationEnvoyeeAt)}`
                      : "Non envoyée"}
                  </td>
                  <td className={cellCls}>
                    {i.tauxPresencePct !== null ? `${i.tauxPresencePct} %` : "—"}
                    <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {i.emargementSigneAt
                        ? `Émargement signé le ${jour(i.emargementSigneAt)}`
                        : "Émargement non signé"}
                    </span>
                  </td>
                  <td className={cellCls}>
                    {i.questionnaires.length === 0 ? (
                      "—"
                    ) : (
                      <ul>
                        {i.questionnaires.map((q) => (
                          <li key={q.type}>
                            {libelle(TYPE_QUESTIONNAIRE, q.type)} :{" "}
                            {q.reponduAt
                              ? `répondu le ${jour(q.reponduAt)}${q.noteGlobale !== null ? ` (${q.noteGlobale}/5)` : ""}`
                              : q.envoyeAt
                                ? `envoyé le ${jour(q.envoyeAt)}, sans réponse`
                                : "non envoyé"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={cellCls}>
                    {i.evaluationFinaleAt ? `Le ${jour(i.evaluationFinaleAt)}` : "—"}
                  </td>
                  <td className={cellCls}>
                    {i.attestation ? (
                      <a
                        href={`/api/qualiopi/documents/${i.attestation.documentId}`}
                        className="text-[color:var(--color-admin-accent)] underline"
                        target="_blank"
                        rel="noopener"
                      >
                        {i.attestation.numero}
                      </a>
                    ) : (
                      "Non émise"
                    )}
                    {i.attestationResultat ? (
                      <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {`Résultat : ${libelle(RESULTAT_ATTESTATION, i.attestationResultat)}`}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mt-[var(--space-admin-5)] mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
        Pièces nominatives
      </h3>
      {parcours.pieces.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune pièce nominative émise.
        </p>
      ) : (
        <ul className="space-y-1 text-[length:var(--text-admin-sm)]">
          {parcours.pieces.map((p) => (
            <li key={p.id}>
              <a
                href={`/api/qualiopi/documents/${p.id}`}
                className="text-[color:var(--color-admin-accent)] underline"
                target="_blank"
                rel="noopener"
              >
                {p.numero}
              </a>{" "}
              — {libelleTypeDocument(p.type)} · {jour(p.createdAt)}
              {p.annuleeAt ? ` · ANNULÉE le ${jour(p.annuleeAt)}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
