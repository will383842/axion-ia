/**
 * Chantier QNC, lot L06 — panneau « Émargement par demi-journée » de la page
 * d'émargement d'une session. Rendu SEULEMENT quand `qualiopi.emargement.actif`
 * agit sur la session : éteint, la page est celle d'avant.
 *
 * Quatre blocs, dans l'ordre où l'organisme travaille : la liste J0 (le jour
 * même), la fiche du jour J, la liste J-1 (préparer demain), les écarts et
 * leur rattrapage motivé.
 *
 * Server Component : de simples formulaires, aucun JavaScript client.
 */

import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  ecartsDuSuivi,
  LIBELLE_ETAT,
  type DemiJourneeSuivie,
  type SuiviEmargement,
} from "@/server/qualiopi/emargement/demi-journee/suivi";
import { LIBELLE_CASE } from "@/server/qualiopi/emargement/demi-journee/fiche-jour";
import { MOTIF_RATTRAPAGE_MIN } from "@/server/qualiopi/emargement/demi-journee/rattrapage";

export interface EmargementDemiJourneeProps {
  sessionId: string;
  /** Chemin de la page, pour le retour des formulaires. */
  retour: string;
  suivi: SuiviEmargement;
  ok?: string | undefined;
  erreur?: string | undefined;
  rattrapageAction: (formData: FormData) => Promise<void>;
  ficheJourAction: (formData: FormData) => Promise<void>;
}

const DEMI: Record<DemiJourneeSuivie["demiJournee"], string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  journee: "Journée",
};

function heureParis(d: Date): string {
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function jourLisible(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

const titreCls =
  "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-2)]";
const texteCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";
const tableCls =
  "w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const thCls =
  "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-fg-muted)] uppercase";
const tdCls = "px-[var(--space-admin-3)] py-[var(--space-admin-2)] align-top";
const cadreCls =
  "mb-[var(--space-admin-5)] overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]";

function tonEtat(etat: DemiJourneeSuivie["etat"]): string {
  if (etat === "signee") return "text-[color:var(--color-admin-success)]";
  if (etat === "a_signer" || etat === "a_venir") return "text-[color:var(--color-admin-fg-muted)]";
  return "text-[color:var(--color-admin-warning)]";
}

export function EmargementDemiJournee({
  sessionId,
  retour,
  suivi,
  ok,
  erreur,
  rattrapageAction,
  ficheJourAction,
}: EmargementDemiJourneeProps): React.ReactElement {
  const duJour = suivi.stagiaires.flatMap((s) =>
    s.demiJournees.filter((d) => d.date === suivi.aujourdHui).map((d) => ({ s, d })),
  );
  const deDemain = suivi.stagiaires
    .map((s) => ({ s, djs: s.demiJournees.filter((d) => d.date === suivi.demain) }))
    .filter((x) => x.djs.length > 0);
  const ecarts = ecartsDuSuivi(suivi);
  const fiche = suivi.ficheDuJour;

  return (
    <section id="demi-journee" className="mb-[var(--space-admin-8)]">
      <h2 className={titreCls}>Émargement par demi-journée</h2>
      <p className={`mb-[var(--space-admin-4)] ${texteCls}`}>
        Chaque stagiaire signe pendant la demi-journée, avec un lien qui ne sert qu&apos;elle et qui
        lui est envoyé à son début. Le lien est fermé avant et après. Une demi-journée oubliée ne se
        rouvre pas : elle se rattrape ci-dessous, avec un motif, et reste comptée comme écart.
      </p>

      {ok !== undefined && (
        <p
          role="status"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {ok}
        </p>
      )}
      {erreur !== undefined && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </p>
      )}

      <h3 className={titreCls}>Aujourd&apos;hui (J0) — {jourLisible(suivi.aujourdHui)}</h3>
      {duJour.length === 0 ? (
        <p className={`mb-[var(--space-admin-5)] ${texteCls}`}>
          Aucune demi-journée aujourd&apos;hui.
        </p>
      ) : (
        <div className={cadreCls}>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={thCls}>Stagiaire</th>
                <th className={thCls}>Demi-journée</th>
                <th className={thCls}>État</th>
                <th className={thCls}>Rappel du début</th>
              </tr>
            </thead>
            <tbody>
              {duJour.map(({ s, d }) => (
                <tr key={d.creneauId} className="border-t border-[color:var(--color-admin-border)]">
                  <td className={tdCls}>{s.stagiaireNom}</td>
                  <td className={tdCls}>
                    {DEMI[d.demiJournee]} · {d.heureDebut}–{d.heureFin}
                  </td>
                  <td className={`${tdCls} ${tonEtat(d.etat)}`}>
                    {LIBELLE_ETAT[d.etat]}
                    {d.signeAt !== null && ` · ${heureParis(d.signeAt)}`}
                  </td>
                  <td className={tdCls}>
                    {d.rappelEnvoyeLe !== null
                      ? `Envoyé à ${heureParis(d.rappelEnvoyeLe)}`
                      : s.emailPresent
                        ? "Pas encore envoyé"
                        : "Impossible : aucune adresse"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {suivi.contresignaturesDuJour.length > 0 && (
        <p className={`mb-[var(--space-admin-5)] ${texteCls}`}>
          Contresignature du formateur, le jour même :{" "}
          {suivi.contresignaturesDuJour
            .map((c) => `${DEMI[c.demiJournee]} ${c.faite ? "faite" : "à faire aujourd'hui"}`)
            .join(" · ")}
        </p>
      )}

      <h3 className={titreCls}>Fiche du jour J</h3>
      {!suivi.sessionAJourAujourdHui ? (
        <p className={`mb-[var(--space-admin-5)] ${texteCls}`}>
          Aujourd&apos;hui n&apos;est pas une journée de cette session.
        </p>
      ) : (
        <form
          action={ficheJourAction}
          className="mb-[var(--space-admin-5)] flex flex-col gap-[var(--space-admin-2)]"
        >
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="retour" value={retour} />
          <label className="flex items-start gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            <input
              type="checkbox"
              name="rappelCadre"
              value="oui"
              disabled={fiche.rappelCadreLe !== null}
            />
            <span>
              {LIBELLE_CASE.rappel_cadre}
              {fiche.rappelCadreLe !== null && ` — consigné à ${heureParis(fiche.rappelCadreLe)}`}
            </span>
          </label>
          <label className="flex items-start gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            <input
              type="checkbox"
              name="supportsRemis"
              value="oui"
              disabled={fiche.supportsRemisLe !== null}
            />
            <span>
              {LIBELLE_CASE.supports_remis}
              {fiche.supportsRemisLe !== null &&
                ` — consigné à ${heureParis(fiche.supportsRemisLe)}`}
            </span>
          </label>
          <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            <span>Supports remis par</span>
            <select name="canalSupports" defaultValue="papier">
              <option value="papier">papier</option>
              <option value="espace">l&apos;espace stagiaire</option>
              <option value="email">e-mail</option>
              <option value="autre">autre</option>
            </select>
          </label>
          <p className={texteCls}>
            Une case consignée ne se décoche pas : elle vaut trace, pour chaque stagiaire inscrit.
          </p>
          <div>
            <AdminButton type="submit" variant="secondary" size="sm">
              Consigner la fiche du jour
            </AdminButton>
          </div>
        </form>
      )}

      <h3 className={titreCls}>Demain (J-1) — {jourLisible(suivi.demain)}</h3>
      {deDemain.length === 0 ? (
        <p className={`mb-[var(--space-admin-5)] ${texteCls}`}>Aucune demi-journée demain.</p>
      ) : (
        <div className={cadreCls}>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={thCls}>Stagiaire</th>
                <th className={thCls}>Demi-journées</th>
                <th className={thCls}>Signature « nom tapé »</th>
                <th className={thCls}>Lien par e-mail</th>
              </tr>
            </thead>
            <tbody>
              {deDemain.map(({ s, djs }) => (
                <tr
                  key={s.enrollmentId}
                  className="border-t border-[color:var(--color-admin-border)]"
                >
                  <td className={tdCls}>{s.stagiaireNom}</td>
                  <td className={tdCls}>
                    {djs
                      .map((d) => `${DEMI[d.demiJournee]} ${d.heureDebut}–${d.heureFin}`)
                      .join(" · ")}
                  </td>
                  <td className={tdCls}>{s.adaptation ? "Ouverte (adaptation)" : "Non : tracé"}</td>
                  <td className={tdCls}>
                    {s.emailPresent
                      ? "Au début de chaque demi-journée"
                      : "Aucune adresse : à corriger"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className={titreCls}>Écarts ({ecarts.length})</h3>
      {ecarts.length === 0 ? (
        <p className={texteCls}>Aucun écart.</p>
      ) : (
        <div className={cadreCls}>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={thCls}>Stagiaire</th>
                <th className={thCls}>Demi-journée</th>
                <th className={thCls}>Écart</th>
                <th className={thCls}>Rattrapage</th>
              </tr>
            </thead>
            <tbody>
              {ecarts.map(({ stagiaire, demiJournee: d }) => (
                <tr key={d.creneauId} className="border-t border-[color:var(--color-admin-border)]">
                  <td className={tdCls}>{stagiaire.stagiaireNom}</td>
                  <td className={tdCls}>
                    {d.date} · {DEMI[d.demiJournee]} · {d.heureDebut}–{d.heureFin}
                  </td>
                  <td className={`${tdCls} ${tonEtat(d.etat)}`}>
                    {LIBELLE_ETAT[d.etat]}
                    {d.motifRattrapage !== null && ` — ${d.motifRattrapage}`}
                  </td>
                  <td className={tdCls}>
                    {d.etat === "non_signee" ? (
                      <form
                        action={rattrapageAction}
                        className="flex flex-col gap-[var(--space-admin-1)]"
                      >
                        <input type="hidden" name="sessionId" value={sessionId} />
                        <input type="hidden" name="retour" value={retour} />
                        <input type="hidden" name="creneauId" value={d.creneauId} />
                        <label className="flex flex-col gap-[var(--space-admin-1)]">
                          <span className="text-[length:var(--text-admin-xs)]">
                            Motif (au moins {MOTIF_RATTRAPAGE_MIN} caractères, aucune information de
                            santé)
                          </span>
                          <textarea
                            name="motif"
                            required
                            minLength={MOTIF_RATTRAPAGE_MIN}
                            maxLength={500}
                            rows={2}
                          />
                        </label>
                        <div>
                          <AdminButton type="submit" variant="secondary" size="sm">
                            Consigner le rattrapage
                          </AdminButton>
                        </div>
                      </form>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
