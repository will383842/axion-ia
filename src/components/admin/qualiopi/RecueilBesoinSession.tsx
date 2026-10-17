/**
 * RecueilBesoinSession — le recueil du besoin (temps 1) sur la fiche de la
 * session (chantier QNC, L03). Serveur : charge sa vue, ne montre RIEN tant que
 * `qualiopi.recueil.actif` est éteint pour cette session.
 */

import { lireVueRecueil, resumer } from "@/server/qualiopi/recueil/vue";

import { RecueilBesoinActions } from "./RecueilBesoinActions";

const date = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

const STATUT: Record<string, string> = {
  copie: "envoyé, en attente de la réponse de l'entreprise",
  reponse_recue: "réponses reçues",
  clos: "clos",
  brouillon: "brouillon",
};

export async function RecueilBesoinSession({ sessionId }: { readonly sessionId: string }) {
  const vue = await lireVueRecueil(sessionId);
  if (vue === null) return null;
  const r = resumer(vue);
  const q = vue.questionnaire;
  return (
    <section id="recueil-besoin" className="mb-[var(--space-admin-8)]">
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Recueil du besoin
      </h2>

      {r.derogationRouge !== null && (
        <p role="alert" className="admin-alert admin-alert-error mb-[var(--space-admin-3)]">
          <strong>Dérogation en cours :</strong> la convention peut partir sans cadrage validé ou
          sans devis accepté. Motif : « {r.derogationRouge.motif} » (accordée le{" "}
          {date.format(r.derogationRouge.accordeeLe)}).
        </p>
      )}
      {r.bloque && vue.decision.autorise === false && (
        <p role="status" className="admin-alert admin-alert-warning mb-[var(--space-admin-3)]">
          {vue.decision.message}
        </p>
      )}

      <ul className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
        <li>Projet : {vue.projet === null ? "aucun projet rattaché" : vue.projet.titre}</li>
        <li>
          Questionnaire :{" "}
          {q === null
            ? "pas encore envoyé"
            : `version ${q.version}, ${STATUT[q.statut] ?? q.statut}${
                q.reponseRecueLe !== null ? ` (le ${date.format(q.reponseRecueLe)})` : ""
              }`}
        </li>
        <li>
          Analyse :{" "}
          {q?.valideLe != null ? `validée le ${date.format(q.valideLe)}` : "pas encore validée"}
        </li>
      </ul>

      <RecueilBesoinActions
        sessionId={sessionId}
        questionnaireId={q?.id ?? null}
        projetsCandidats={vue.projetsCandidats}
        peutEnvoyer={r.peutEnvoyer}
        peutValider={r.peutValider}
        peutRattacher={r.peutRattacher}
        peutDeroger={r.peutDeroger}
      />
    </section>
  );
}
