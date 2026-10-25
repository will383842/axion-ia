// Vue « Questionnaires sans rencontre » de la page Rendez-vous (25/10/2026) : les questionnaires
// de pré-audit dont la rencontre a été supprimée gardent leurs réponses (plus d'effacement en
// cascade). LECTURE, plus les gestes RGPD déjà connus (export, mise à l'écart, effacement par
// Williams). Rien n'est supprimé automatiquement. Composant serveur, aucun JavaScript.

import { ReponsePreaudit } from "@/components/admin/dossier-client/ReponsePreaudit";
import { conservationEchue, RETENTION_ANS } from "@/features/questionnaire-preaudit/config";
import { listerQuestionnairesSansRencontre } from "@/features/questionnaire-preaudit/serveur";
import { formatDateFrShort } from "@/lib/format-date-fr";

const LIBELLE_MODE = { main: "Dirigeant", emp: "Collaborateur", it: "Référent informatique" };
const carteCls =
  "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]";
const mutedCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const alerteCls = "my-[var(--space-admin-2)] font-semibold text-[color:var(--color-admin-danger)]";

export async function QuestionnairesSansRencontre(props: {
  peutEffacer: boolean;
  erreur: string | null;
  message: string | null;
  /** Numéro de page (1 par défaut) et adresse de la vue, pour « Page suivante ». */
  page?: number;
  base: string;
}) {
  const { liste, page, suivante } = await listerQuestionnairesSansRencontre(props.page ?? 1);
  const lienPage = (n: number) => `${props.base}?vue=questionnaires${n > 1 ? `&page=${n}` : ""}`;
  return (
    <section aria-label="Questionnaires sans rencontre">
      {props.erreur !== null ? (
        <p role="alert" className={alerteCls}>
          {props.erreur}
        </p>
      ) : null}
      {props.message !== null ? <p role="status">{props.message}</p> : null}
      <p className={mutedCls}>
        Questionnaires dont la rencontre a été supprimée : leurs réponses sont gardées (
        {RETENTION_ANS} ans, suppression à la main seulement).
      </p>
      {liste.length === 0 ? (
        <p>
          {page > 1 ? "Aucun questionnaire sur cette page." : "Aucun questionnaire sans rencontre."}
        </p>
      ) : (
        liste.map((q) => (
          <div key={q.id} className={carteCls}>
            <p className="font-semibold">
              Référence {q.ref}
              {q.envoyeLe !== null ? ` — envoyé le ${formatDateFrShort(q.envoyeLe)}` : ""}
              {q.closLe !== null ? " — clos" : ""} — {q.reponses.length} réponse(s)
            </p>
            {q.reponses.some((r) => conservationEchue(r.recuLe)) ? (
              <p role="alert" className={alerteCls}>
                Échéance de conservation dépassée pour au moins une réponse : à supprimer à la main
                si plus rien ne justifie de la garder.
              </p>
            ) : null}
            <ul className="space-y-[var(--space-admin-2)]">
              {q.reponses.map((r) => (
                <li key={r.id}>
                  <ReponsePreaudit
                    r={r}
                    rencontreId={null}
                    reference={q.ref}
                    peutEffacer={props.peutEffacer}
                    libelleMode={LIBELLE_MODE[r.mode]}
                    quand={formatDateFrShort(r.recuLe)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      {page > 1 || suivante ? (
        <nav aria-label="Pages" className="flex gap-[var(--space-admin-4)]">
          {page > 1 ? <a href={lienPage(page - 1)}>Page précédente</a> : null}
          <span className={mutedCls}>Page {page}</span>
          {suivante ? <a href={lienPage(page + 1)}>Page suivante</a> : null}
        </nav>
      ) : null}
    </section>
  );
}
