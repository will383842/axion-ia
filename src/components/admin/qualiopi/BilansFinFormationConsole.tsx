/**
 * Console — le bilan de fin de formation des formateurs indépendants d'une session
 * (lot G2), sur la page « Évaluations des acquis ».
 *
 * Pour chacun : bilan terminé ou non, le MOTIF EXACT qui retient son paiement (même règle
 * que le passage du paiement), et le geste « Payer quand même » (motif obligatoire,
 * confirmation). Composant serveur ; rendu seulement si l'interrupteur
 * `formateurs.bilan_fin_formation` est allumé (la page passe `null` sinon).
 */

import { payerQuandMemeBilanFormAction } from "@/server/actions/qualiopi/bilan-fin-formation";
import type { LigneBilanConsole } from "@/server/qualiopi/formateurs-independants/bilan-fin-formation/console";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export interface BilansFinFormationConsoleProps {
  readonly sessionId: string;
  readonly retour: string;
  readonly lignes: readonly LigneBilanConsole[];
  readonly ok: string | null;
  readonly erreur: string | null;
}

export function BilansFinFormationConsole({
  sessionId,
  retour,
  lignes,
  ok,
  erreur,
}: BilansFinFormationConsoleProps): React.ReactElement {
  const texte = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const discret = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
  return (
    <section
      id="bilans-fin-formation"
      className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <h3 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Bilan de fin de formation des formateurs indépendants
      </h3>
      <p className={`${discret} mb-[var(--space-admin-3)]`}>
        Saisi par le formateur depuis son espace (évaluations finales et avis). La saisie des
        évaluations reste possible ici, plus bas.
      </p>
      {ok !== null ? <p className={`${texte} mb-[var(--space-admin-3)]`}>{ok}</p> : null}
      {erreur !== null ? (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      ) : null}
      {lignes.length === 0 ? (
        <p className={discret}>Aucun formateur indépendant sur cette session.</p>
      ) : (
        <ul className="space-y-[var(--space-admin-4)]">
          {lignes.map((l) => (
            <li
              key={l.trainerId}
              className="border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)] first:border-t-0 first:pt-0"
            >
              <p className={`${texte} font-medium`}>{l.nom}</p>
              <p className={texte}>
                {l.termineAt !== null
                  ? `Bilan terminé le ${dateFmt.format(l.termineAt)}.`
                  : `Bilan non terminé${l.avisDonne ? " (avis donné)" : ""}.`}
              </p>
              <p className={texte}>
                Paiement : {l.motif === null ? "rien ne manque." : <strong>{l.motif}</strong>}
                {!l.exige && l.termineAt === null ? (
                  <span className={discret}>
                    {" "}
                    — session finie avant l&apos;allumage : le bilan n&apos;est pas attendu.
                  </span>
                ) : null}
              </p>
              {l.payerQuandMeme !== null ? (
                <p className={discret}>
                  « Payer quand même » posé le {dateFmt.format(l.payerQuandMeme.at)}
                  {l.payerQuandMeme.motif !== null ? ` — motif : ${l.payerQuandMeme.motif}` : ""}
                </p>
              ) : l.exige && l.termineAt === null ? (
                <form
                  action={payerQuandMemeBilanFormAction}
                  className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-2)]"
                >
                  <input type="hidden" name="sessionId" value={sessionId} />
                  <input type="hidden" name="trainerId" value={l.trainerId} />
                  <input type="hidden" name="retour" value={retour} />
                  <label className={`${discret} block`}>
                    Motif (obligatoire, gardé au dossier)
                    <textarea
                      name="motif"
                      required
                      minLength={10}
                      maxLength={500}
                      rows={2}
                      className="mt-1 block w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
                    />
                  </label>
                  <label className={`${discret} flex items-center gap-2`}>
                    <input type="checkbox" name="confirmer" value="oui" required />
                    Le paiement n&apos;attendra plus ce bilan.
                  </label>
                  <button
                    type="submit"
                    className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
                  >
                    Payer quand même
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
