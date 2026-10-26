// Une réponse au questionnaire avant audit, lue EN ENTIER dans la console (audit des données du
// 24/10/2026, point 10) : en-tête (parcours, service, consentements datés, lien, référence),
// champs simples, champs répétables en tableaux, calculs, bloc « pré-rempli » entier, et la vue
// « données brutes » repliée. Une réponse illisible donne une ALERTE ROUGE, jamais du vide ; une
// réponse mise à l'écart (demande d'effacement d'un salarié) n'est pas montrée.
// Composant serveur : aucun JavaScript côté navigateur.

import {
  ecarterReponsesMembreAction,
  effacerReponsesMembreAction,
} from "@/features/questionnaire-preaudit/actions";
import {
  conservationEchue,
  echeanceConservation,
  RETENTION_ANS,
} from "@/features/questionnaire-preaudit/config";
import { LIBELLE_PREFILL, type ReponseLisible } from "@/features/questionnaire-preaudit/donnees";
import type { Tableau } from "@/features/questionnaire-preaudit/lecture";
import {
  AUCUN_LIBELLE,
  libelleDe,
  type Libelles,
} from "@/features/questionnaire-preaudit/libelles";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { adminPath } from "@/lib/admin-path";

const mutedCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const alerteCls =
  "my-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] border-2 border-[color:var(--color-admin-danger)] p-[var(--space-admin-2)] font-semibold text-[color:var(--color-admin-danger)]";
const boutonCls = "admin-button-secondary";
const celluleCls =
  "border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] align-top whitespace-pre-line";

function dateParis(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

function TableauLisible({ t }: { t: Tableau }) {
  return (
    <div className="my-[var(--space-admin-2)] overflow-x-auto">
      <p className="font-semibold">
        {t.libelle} ({t.lignes.length})
      </p>
      <table className="text-[length:var(--text-admin-xs)]">
        <thead>
          <tr>
            {t.colonnes.map((c) => (
              <th key={c} className={`${celluleCls} text-left`} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.lignes.map((l, i) => (
            <tr key={i}>
              {l.map((v, j) => (
                <td key={j} className={celluleCls}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReponsePreaudit(props: {
  r: ReponseLisible;
  /** `null` : questionnaire SANS rencontre (rencontre supprimée, réponses gardées). */
  rencontreId: string | null;
  /** La fiche visée quand le questionnaire est envoyé sans rendez-vous (retour sur sa page). */
  clientId?: string | null;
  /** Le questionnaire visé de la fiche : le retour du geste revient sur celui-là. */
  questionnaireId?: string | null;
  /** Référence du questionnaire : avec le code `membre`, elle identifie un salarié (RGPD). */
  reference: string;
  /** Williams (super-administrateur) : seul à pouvoir effacer définitivement. */
  peutEffacer: boolean;
  libelleMode: string;
  quand: string;
  /** Les questions en français (copie déposée) ; sans elles, un repli lisible. */
  libelles?: Libelles;
}) {
  const { r, reference: ref } = props;
  const libelles = props.libelles ?? AUCUN_LIBELLE;
  const question = (cle: string) => libelleDe(cle, libelles, r.mode);
  const salarie = r.mode !== "main" && r.membre !== null;
  const exportHref =
    salarie && r.membre !== null
      ? adminPath(
          "fr",
          `/rendez-vous/rencontres/${props.rencontreId ?? "sans-rencontre"}/preaudit-export?ref=${encodeURIComponent(ref)}&membre=${encodeURIComponent(r.membre)}`,
        )
      : null;
  return (
    <details>
      <summary>
        {props.libelleMode}
        {r.membre !== null ? ` (code ${r.membre})` : ""} — {props.quand}
        {r.illisible ? " — ILLISIBLE" : ""}
        {r.ecarteLe !== null ? " — MISE À L'ÉCART" : ""}
      </summary>

      {salarie ? (
        <div className="mt-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-2)]">
          <span className={mutedCls}>
            Référence {ref} · code {r.membre} (à noter pour une demande d&apos;accès ou
            d&apos;effacement de ce collaborateur)
          </span>
          {exportHref !== null ? (
            <a href={exportHref} className={boutonCls}>
              Exporter ses réponses (droit d&apos;accès)
            </a>
          ) : null}
          {r.ecarteLe === null ? (
            <form action={ecarterReponsesMembreAction}>
              {props.rencontreId !== null ? (
                <input type="hidden" name="rencontreId" value={props.rencontreId} />
              ) : props.clientId != null ? (
                <>
                  <input type="hidden" name="clientId" value={props.clientId} />
                  {props.questionnaireId != null ? (
                    <input type="hidden" name="questionnaireId" value={props.questionnaireId} />
                  ) : null}
                </>
              ) : (
                <input type="hidden" name="retour" value="questionnaires" />
              )}
              <input type="hidden" name="ref" value={ref} />
              <input type="hidden" name="membre" value={r.membre ?? ""} />
              <AdminButton type="submit" variant="secondary">
                Demande d&apos;effacement : mettre à l&apos;écart
              </AdminButton>
            </form>
          ) : null}
        </div>
      ) : null}

      {r.ecarteLe !== null ? (
        <div role="alert" className={alerteCls}>
          Demande d&apos;effacement : réponses mises à l&apos;écart le{" "}
          {r.ecarteLe.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}. Rien n&apos;est
          supprimé sans votre décision.
          {props.peutEffacer ? (
            <form
              action={effacerReponsesMembreAction}
              className="mt-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-2)]"
            >
              {props.rencontreId !== null ? (
                <input type="hidden" name="rencontreId" value={props.rencontreId} />
              ) : props.clientId != null ? (
                <>
                  <input type="hidden" name="clientId" value={props.clientId} />
                  {props.questionnaireId != null ? (
                    <input type="hidden" name="questionnaireId" value={props.questionnaireId} />
                  ) : null}
                </>
              ) : (
                <input type="hidden" name="retour" value="questionnaires" />
              )}
              <input type="hidden" name="ref" value={ref} />
              <input type="hidden" name="membre" value={r.membre ?? ""} />
              <input
                name="confirmation"
                placeholder="Écrivez EFFACER"
                aria-label="Confirmation de l'effacement définitif"
                className="admin-input"
              />
              <AdminButton type="submit" variant="danger">
                Effacer définitivement
              </AdminButton>
            </form>
          ) : (
            <span> Williams seul peut effacer définitivement.</span>
          )}
        </div>
      ) : null}

      <p className={`mt-[var(--space-admin-2)] ${mutedCls}`}>
        Accepte de recevoir des informations par e-mail :{" "}
        {r.infosEmail === null
          ? "non renseigné"
          : `${r.infosEmail ? "oui" : "non"} (le ${dateParis(r.recuLe)})`}
        . Aucun envoi ni abonnement automatique.
      </p>
      <p className={mutedCls}>
        Conservation jusqu&apos;au {dateParis(echeanceConservation(r.recuLe))} ({RETENTION_ANS} ans)
        : rien n&apos;est supprimé automatiquement.
      </p>
      {conservationEchue(r.recuLe) ? (
        <div role="alert" className={alerteCls}>
          Échéance de conservation dépassée : cette réponse est à supprimer À LA MAIN si plus rien
          ne justifie de la garder. Rien n&apos;a été supprimé.
        </div>
      ) : null}

      {r.illisible ? (
        <div role="alert" className={alerteCls}>
          Cette réponse n&apos;a pas pu être lue (clé de déchiffrement absente ou réponse abîmée).
          Elle est conservée telle quelle : ne la supprimez pas, prévenez la session technique.
        </div>
      ) : null}

      {r.lecture !== null ? (
        <div className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-2)]">
          <dl className="space-y-[var(--space-admin-1)]">
            {r.lecture.entete.map((p) => (
              <div key={p.libelle}>
                <dt className={mutedCls}>{p.libelle}</dt>
                <dd>{p.valeur}</dd>
              </div>
            ))}
          </dl>

          <dl className="space-y-[var(--space-admin-1)]">
            {r.lecture.champs.map((l) => (
              <div key={l.cle} data-champ={l.cle}>
                <dt className={mutedCls} title={l.cle}>
                  {question(l.cle)}
                </dt>
                <dd className="whitespace-pre-line">
                  {l.valeur}
                  {l.prefill !== undefined ? (
                    <span className={mutedCls}> ({LIBELLE_PREFILL[l.prefill]})</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          {r.lecture.tableaux.map((t) => (
            <TableauLisible
              key={t.cle}
              t={t.libelle === t.cle ? { ...t, libelle: question(t.cle) } : t}
            />
          ))}

          {r.lecture.calc !== null ? (
            <div>
              <p className="font-semibold">Calculs de la page</p>
              <dl className="space-y-[var(--space-admin-1)]">
                {r.lecture.calc.paires.map((p) => (
                  <div key={p.libelle}>
                    <dt className={mutedCls}>{p.libelle}</dt>
                    <dd>{p.valeur}</dd>
                  </div>
                ))}
              </dl>
              {r.lecture.calc.tableaux.map((t) => (
                <TableauLisible key={t.cle} t={t} />
              ))}
            </div>
          ) : null}

          <div>
            <p className="font-semibold">Cases pré-remplies par Axion</p>
            <ul>
              {r.lecture.prefill.map((b) => (
                <li key={b.etat}>
                  {b.libelle} ({b.cles.length}) :{" "}
                  {b.cles.length === 0 ? "aucune" : b.cles.map(question).join(" ; ")}
                </li>
              ))}
            </ul>
          </div>

          <details>
            <summary className={mutedCls}>Données brutes (JSON reçu)</summary>
            <pre className="overflow-x-auto text-[length:var(--text-admin-xs)] whitespace-pre-wrap">
              {r.lecture.brut}
            </pre>
          </details>
        </div>
      ) : null}
    </details>
  );
}
