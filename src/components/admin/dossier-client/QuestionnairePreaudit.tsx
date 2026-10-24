// Questionnaire de pré-audit sur la fiche d'une rencontre (console, 2026-10-24).
//
// Will y dépose son HTML adapté, l'essaie, voit l'aperçu EXACT de l'e-mail, puis clique
// « Envoyer » : rien ne part tout seul. Les réponses arrivent par personne, regroupées ici,
// avec « à traiter » tant qu'il ne les a pas marquées lues (pas d'e-mail interne).

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import {
  deposerQuestionnaireAction,
  envoyerQuestionnaireAction,
  marquerQuestionnaireLuAction,
} from "@/features/questionnaire-preaudit/actions";
import { MESSAGE_REFUS, refusEnvoiReel } from "@/features/questionnaire-preaudit/config";
import { apercuEnvoi } from "@/features/questionnaire-preaudit/envoyer";
import {
  cheminPreaudit,
  lireDeLaRencontre,
  lireReponses,
} from "@/features/questionnaire-preaudit/serveur";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { timeInParis } from "@/lib/calendar-grid";

const carteCls =
  "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]";
const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const mutedCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const inputCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const boutonCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium";

const LIBELLE_MODE = {
  main: "Dirigeant",
  emp: "Collaborateur",
  it: "Référent informatique",
} as const;

function quand(d: Date): string {
  return `${formatDateFrShort(d)} à ${timeInParis(d)}`;
}

export async function QuestionnairePreaudit(props: {
  rencontreId: string;
  titulaire: { nom: string | null; email: string | null } | null;
  /** Adresse et prénom saisis pour l'aperçu (`?pa_email=&pa_prenom=`). */
  apercu: { email: string; prenom: string } | null;
}) {
  const { rencontreId } = props;
  const q = await lireDeLaRencontre(rencontreId);
  const refus = refusEnvoiReel();
  const reponses = q === null ? [] : await lireReponses(q.id);
  const aTraiter =
    q !== null &&
    reponses.length > 0 &&
    (q.luLe === null || reponses.some((r) => r.recuLe > (q.luLe as Date)));
  const chemin = q === null ? null : cheminPreaudit(q.id);

  let apercuMail: { sujet: string; html: string } | null = null;
  let erreurApercu: string | null = null;
  if (q !== null && props.apercu !== null && props.apercu.email !== "") {
    try {
      const m = await apercuEnvoi(q.id, props.apercu.email, props.apercu.prenom);
      apercuMail = { sujet: m.subject, html: m.html };
    } catch {
      erreurApercu = "L'aperçu n'a pas pu être préparé.";
    }
  }
  const emailPropose = props.apercu?.email || props.titulaire?.email || "";
  const prenomPropose = props.apercu?.prenom ?? (props.titulaire?.nom ?? "").split(" ")[0] ?? "";

  return (
    <section className={carteCls} id="questionnaire-avant-audit">
      <h2 className={titreCls}>
        Questionnaire avant audit{" "}
        {q === null ? null : q.envoyeLe === null ? (
          <AdminBadge tone="neutral">brouillon</AdminBadge>
        ) : (
          <AdminBadge tone="success">envoyé le {quand(q.envoyeLe)}</AdminBadge>
        )}{" "}
        {aTraiter ? <AdminBadge tone="warning">réponses à traiter</AdminBadge> : null}
      </h2>

      <form
        action={deposerQuestionnaireAction}
        className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)]"
      >
        <input type="hidden" name="rencontreId" value={rencontreId} />
        <input
          type="file"
          name="fichier"
          accept=".html,text/html"
          required
          className={inputCls}
          aria-label="Fichier HTML du questionnaire"
        />
        <button type="submit" className={boutonCls} disabled={q?.envoyeLe != null}>
          {q === null ? "Ajouter un questionnaire" : "Remplacer le questionnaire"}
        </button>
        {q?.envoyeLe != null ? (
          <span className={mutedCls}>Déjà envoyé : il ne peut plus être remplacé.</span>
        ) : null}
      </form>

      {q !== null && chemin !== null ? (
        <>
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
            <a
              href={`${chemin}?essai=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              Essayer le questionnaire
            </a>{" "}
            <span className={mutedCls}>
              (mode essai : rien n&apos;est enregistré, personne n&apos;est prévenu)
            </span>
          </p>

          <form
            method="get"
            className="mb-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]"
          >
            <input
              name="pa_email"
              type="email"
              defaultValue={emailPropose}
              placeholder="Adresse du destinataire"
              required
              className={inputCls}
              aria-label="Adresse du destinataire"
            />
            <input
              name="pa_prenom"
              defaultValue={prenomPropose}
              placeholder="Prénom"
              className={inputCls}
              aria-label="Prénom du destinataire"
            />
            <button type="submit" className={boutonCls}>
              Voir l&apos;aperçu de l&apos;e-mail
            </button>
          </form>

          {erreurApercu !== null ? (
            <p role="alert" className={mutedCls}>
              {erreurApercu}
            </p>
          ) : null}
          {apercuMail !== null && props.apercu !== null ? (
            <div className="mb-[var(--space-admin-3)]">
              <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
                <b>À :</b> {props.apercu.email} — <b>Objet :</b> {apercuMail.sujet}
              </p>
              <iframe
                title="Aperçu exact de l'e-mail"
                sandbox=""
                srcDoc={apercuMail.html}
                className="mb-[var(--space-admin-3)] h-[420px] w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)]"
              />
              {refus !== null ? (
                <p role="status" className="text-[length:var(--text-admin-sm)]">
                  {MESSAGE_REFUS[refus]}
                </p>
              ) : (
                <form action={envoyerQuestionnaireAction}>
                  <input type="hidden" name="rencontreId" value={rencontreId} />
                  <input type="hidden" name="destinataire" value={props.apercu.email} />
                  <input type="hidden" name="prenom" value={props.apercu.prenom} />
                  <button type="submit" className={boutonCls}>
                    Envoyer cet e-mail
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {reponses.length > 0 ? (
        <div>
          <h3 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
            Réponses reçues ({reponses.length})
          </h3>
          <ul className="space-y-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
            {reponses.map((r) => (
              <li key={r.id}>
                <details>
                  <summary>
                    {LIBELLE_MODE[r.mode]}
                    {r.membre !== null ? ` (${r.membre})` : ""} — {quand(r.recuLe)}
                  </summary>
                  <dl className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-1)]">
                    {r.lignes.map((l) => (
                      <div key={l.cle}>
                        <dt className={mutedCls}>{l.cle}</dt>
                        <dd className="whitespace-pre-line">{l.valeur}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </li>
            ))}
          </ul>
          {aTraiter ? (
            <form action={marquerQuestionnaireLuAction} className="mt-[var(--space-admin-3)]">
              <input type="hidden" name="rencontreId" value={rencontreId} />
              <button type="submit" className={boutonCls}>
                Marquer comme lues
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
