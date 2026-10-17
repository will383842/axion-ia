/**
 * Admin — Formateurs › fiche › SUIVI QUALITÉ (Qualiopi ind. 21, NC majeure).
 *
 * Le dossier de suivi de la qualité pédagogique d'un intervenant externe : observation de
 * la 1re mission, grille après chaque mission, satisfaction des stagiaires et décisions
 * motivées, réévaluation annuelle. Chaque grille est AJOUTÉE (jamais modifiée), versionnée,
 * datée et signée par l'auteur de la console, rangée ici ET rattachée à sa session.
 *
 * 🔴 LIVRÉ ÉTEINT : interrupteur `formateurs.suivi_qualite` coupé = l'écran l'annonce.
 * Réservé à l'acte `habiliter_formateur`. Le formateur ne voit jamais cet écran.
 * Formulaires HTML simples : aucun JavaScript client.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EcranPasEncoreOuvert } from "@/components/admin/qualiopi/EcranPasEncoreOuvert";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import {
  enregistrerDecisionSuiviFormAction,
  enregistrerGrilleSuiviFormAction,
} from "@/server/actions/qualiopi/suivi-qualite-formateurs";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import { jourParis } from "@/server/qualiopi/formateurs-independants/argent/dates";
import { INTERRUPTEURS_SIGNATURE } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import {
  lireEcranSuiviQualite,
  type GrilleConsole,
} from "@/server/qualiopi/formateurs-independants/suivi-qualite/console";
import {
  GRILLES_SUIVI_QUALITE,
  REGLAGES_SUIVI_QUALITE,
  type TypeGrilleSuivi,
} from "@/server/qualiopi/formateurs-independants/suivi-qualite/reglages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateur — Suivi qualité | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const R = REGLAGES_SUIVI_QUALITE;

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});
const jourFr = (j: string) => j.split("-").reverse().join("/");
const sur5 = (centiemes: number) => `${(centiemes / 100).toFixed(2).replace(".", ",")}/5`;
const virgule = (n: number) => String(n).replace(".", ",");

const LIBELLE_TYPE: Record<TypeGrilleSuivi, string> = {
  observation: "Observation de la 1re mission",
  evaluation_mission: "Évaluation après mission",
  reevaluation: "Réévaluation annuelle",
};

const texte = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const discret = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const carte =
  "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titre =
  "mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const champ =
  "mt-1 block w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const bouton =
  "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const alerte = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]";

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}

function Criteres({ type }: { type: TypeGrilleSuivi }) {
  return (
    <fieldset className="space-y-[var(--space-admin-2)]">
      <legend className={discret}>
        Critères notés de 1 (insuffisant) à 5 (excellent) — grille v
        {GRILLES_SUIVI_QUALITE[type].version}
      </legend>
      {GRILLES_SUIVI_QUALITE[type].criteres.map((c) => (
        <label key={c.code} className={`${texte} flex items-center justify-between gap-2`}>
          <span>{c.libelle}</span>
          <select
            name={`note_${c.code}`}
            required
            defaultValue=""
            className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-1)]"
          >
            <option value="" disabled>
              —
            </option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ))}
    </fieldset>
  );
}

function Commun({
  trainerId,
  retour,
  type,
  aujourdhui,
}: {
  trainerId: string;
  retour: string;
  type: TypeGrilleSuivi;
  aujourdhui: string;
}) {
  return (
    <>
      <input type="hidden" name="trainerId" value={trainerId} />
      <input type="hidden" name="retour" value={retour} />
      <input type="hidden" name="type" value={type} />
      <label className={`${discret} block`}>
        Date {type === "observation" ? "de l'observation" : "de l'évaluation"}
        <input
          type="date"
          name="date"
          required
          max={aujourdhui}
          defaultValue={aujourdhui}
          className={champ}
        />
      </label>
    </>
  );
}

function Conclusion() {
  return (
    <label className={`${discret} block`}>
      Conclusion (obligatoire, gardée au dossier)
      <textarea
        name="conclusion"
        required
        minLength={R.texteMinCaracteres}
        maxLength={5000}
        rows={3}
        className={champ}
      />
    </label>
  );
}

function Grille({ g }: { g: GrilleConsole }) {
  return (
    <li className="border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)] first:border-t-0 first:pt-0">
      <p className={`${texte} font-medium`}>
        {LIBELLE_TYPE[g.type]}
        {g.numero > 1 ? ` (saisie n° ${g.numero})` : ""} — {sur5(g.moyenneCentiemes)}
        {g.type === "evaluation_mission" ? "" : g.favorable ? " · favorable" : " · sous le seuil"}
      </p>
      <p className={discret}>
        {g.sessionNumero !== null ? `Session ${g.sessionNumero} · ` : ""}
        {g.type === "observation" && g.observateur ? `observée par ${g.observateur} · ` : ""}
        le {dateFmt.format(g.dateEvaluation)} · signée par {g.auteurNom}, saisie le{" "}
        {dateFmt.format(g.createdAt)} · grille v{g.versionGrille}
        {g.satisfactionSaisie !== null ? ` · satisfaction saisie ${g.satisfactionSaisie}/5` : ""}
      </p>
      <ul className={`${discret} mt-1`}>
        {g.criteres.map((c) => (
          <li key={c.code}>
            {c.libelle} : {c.note}/5
          </li>
        ))}
      </ul>
      <p className={`${texte} mt-1 whitespace-pre-line`}>{g.conclusion}</p>
    </li>
  );
}

export default async function SuiviQualiteFormateurPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const base = `/${locale}/${adminPrefix}`;
  const acces = await gardePage("consultation", `${base}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={base} />;
  if (!peutEngager(acces.role, "habiliter_formateur")) {
    return (
      <AccesRefuse
        motif="Le suivi qualité des formateurs est réservé à la direction et au responsable qualité."
        retourHref={`${base}/qualiopi/formateurs`}
      />
    );
  }
  if (!UUID.test(id)) notFound();

  const maintenant = new Date();
  const ecran = await lireEcranSuiviQualite(id, maintenant);
  if (ecran === null) notFound();
  if (ecran.allumeLe === null) {
    return (
      <EcranPasEncoreOuvert
        titre="Suivi qualité du formateur"
        interrupteurs={[INTERRUPTEURS_SIGNATURE.suivi_qualite.libelle]}
        base={base}
      />
    );
  }

  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok.slice(0, 300) : null;
  const erreur = typeof sp.erreur === "string" ? sp.erreur.slice(0, 300) : null;
  const retour = `${base}/qualiopi/formateurs/${id}/suivi-qualite`;
  const aujourdhui = jourParis(maintenant);
  const commencees = ecran.missions.filter((m) => m.debut <= aujourdhui);
  const finies = ecran.missions.filter((m) => m.finie);
  const obs = ecran.observation;
  const reeval = ecran.reevaluation;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Suivi qualité du formateur"
        description={`${ecran.nom} · Qualiopi ind. 21 · suivi allumé le ${jourFr(ecran.allumeLe)} (missions commencées depuis)`}
      />
      <p className={`${discret} mb-[var(--space-admin-4)]`}>
        <Link href={`${base}/qualiopi/formateurs/${id}`} className="underline">
          ← Retour à la fiche
        </Link>{" "}
        · Seuils et délais à valider par Will : observation ≥ {virgule(R.observationMoyenneMin)}/5,
        grille après mission relancée à J+{R.evaluationRelanceJours} et en alerte à J+
        {R.evaluationAlerteJours}, entretien sous {virgule(R.satisfactionEntretienSous)}/5,
        suspension sous {virgule(R.satisfactionSuspensionSous)}/5, réévaluation tous les{" "}
        {R.reevaluationMois} mois (rappel J-{R.reevaluationRappelJours}).
      </p>
      {ok !== null ? <p className={`${texte} mb-[var(--space-admin-3)]`}>{ok}</p> : null}
      {erreur !== null ? <p className={`${alerte} mb-[var(--space-admin-3)]`}>{erreur}</p> : null}

      {!ecran.externe ? (
        <section className={carte}>
          <p className={texte}>
            Ce formateur n&apos;est pas un intervenant externe (salarié ou dirigeant) : le suivi de
            l&apos;indicateur 21 pour les intervenants externes ne s&apos;applique pas.
          </p>
        </section>
      ) : (
        <>
          <section className={carte} id="etat">
            <h2 className={titre}>Où en est ce formateur</h2>
            <p className={texte}>
              Habilitation :{" "}
              {obs?.confirmee ? (
                "confirmée par l'observation de la 1re mission."
              ) : obs?.alerte === "insuffisante" ? (
                <strong>
                  non confirmée — observation sous le seuil, une nouvelle observation est attendue.
                </strong>
              ) : obs?.premiere ? (
                <strong>
                  non confirmée — observation de la 1re mission (session du{" "}
                  {jourFr(obs.premiere.debut)}) à saisir ; aucune autre mission avant.
                </strong>
              ) : (
                "pas encore de mission depuis l'allumage ; la 1re sera observée."
              )}
            </p>
            <p className={texte}>
              Réévaluation annuelle :{" "}
              {reeval === null || reeval.etat === "sans_objet" || reeval.echeance === null ? (
                "aucune habilitation datée à réévaluer."
              ) : reeval.etat === "echue" ? (
                <strong>
                  échue depuis le {jourFr(reeval.echeance)} — aucune nouvelle mission avant sa
                  saisie.
                </strong>
              ) : reeval.etat === "rappel" ? (
                <strong>à prévoir avant le {jourFr(reeval.echeance)}.</strong>
              ) : (
                `prochaine échéance le ${jourFr(reeval.echeance)}.`
              )}
            </p>
          </section>

          <section className={carte} id="missions">
            <h2 className={titre}>Missions suivies</h2>
            {ecran.missions.length === 0 ? (
              <p className={discret}>Aucune mission commencée depuis l&apos;allumage.</p>
            ) : (
              <ul className="space-y-[var(--space-admin-4)]">
                {ecran.missions.map((m) => (
                  <li
                    key={m.sessionId}
                    className="border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)] first:border-t-0 first:pt-0"
                  >
                    <p className={`${texte} font-medium`}>
                      <Link href={`${base}/qualiopi/sessions/${m.sessionId}`} className="underline">
                        {m.numero}
                      </Link>{" "}
                      {m.titre} · du {jourFr(m.debut)} au {jourFr(m.fin)}
                    </p>
                    <p className={texte}>
                      Grille après mission :{" "}
                      {m.evaluationSaisie ? (
                        "saisie."
                      ) : !m.finie ? (
                        "à saisir une fois la mission finie."
                      ) : m.evaluation === "alerte" ? (
                        <strong>manquante (alerte).</strong>
                      ) : m.evaluation === "relance" ? (
                        <strong>à saisir (relance).</strong>
                      ) : (
                        "à saisir."
                      )}
                    </p>
                    <p className={texte}>
                      Satisfaction des stagiaires :{" "}
                      {m.satisfaction === null
                        ? "non mesurée (questionnaires sans réponse ; une note peut être saisie avec la grille)."
                        : `${virgule(Math.round(m.satisfaction * 100) / 100)}/5`}
                      {m.niveau === "suspension" && !m.suspensionLevee ? (
                        <strong>
                          {" "}
                          — nouvelles missions suspendues jusqu&apos;à une décision motivée.
                        </strong>
                      ) : m.niveau === "entretien" && !m.decisionPrise ? (
                        <strong> — entretien à prévoir.</strong>
                      ) : m.niveau !== "ok" ? (
                        <span className={discret}> — décision consignée.</span>
                      ) : null}
                    </p>
                    {(m.niveau === "suspension" && !m.suspensionLevee) ||
                    (m.niveau === "entretien" && !m.decisionPrise) ? (
                      <form
                        action={enregistrerDecisionSuiviFormAction}
                        className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-2)]"
                      >
                        <input type="hidden" name="trainerId" value={id} />
                        <input type="hidden" name="sessionId" value={m.sessionId} />
                        <input type="hidden" name="retour" value={retour} />
                        <input
                          type="hidden"
                          name="type"
                          value={m.niveau === "suspension" ? "levee_suspension" : "entretien"}
                        />
                        <label className={`${discret} block`}>
                          {m.niveau === "suspension"
                            ? "Décision motivée de reprise des missions (entretien mené, plan d'action…)"
                            : "Compte rendu de l'entretien (obligatoire, gardé au dossier)"}
                          <textarea
                            name="motif"
                            required
                            minLength={R.texteMinCaracteres}
                            maxLength={2000}
                            rows={2}
                            className={champ}
                          />
                        </label>
                        {m.niveau === "suspension" ? (
                          <label className={`${discret} flex items-center gap-2`}>
                            <input type="checkbox" name="confirmer" value="oui" required />
                            Ce formateur pourra de nouveau recevoir des missions.
                          </label>
                        ) : null}
                        <button type="submit" className={bouton}>
                          {m.niveau === "suspension"
                            ? "Lever la suspension"
                            : "Consigner l'entretien"}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={carte} id="saisir">
            <h2 className={titre}>Saisir une grille</h2>
            <p className={`${discret} mb-[var(--space-admin-3)]`}>
              Une grille enregistrée ne se modifie plus : une correction est une nouvelle grille, et
              la plus récente fait foi. Grille vierge refusée.
            </p>
            <div className="grid gap-[var(--space-admin-5)] md:grid-cols-3">
              <form
                action={enregistrerGrilleSuiviFormAction}
                className="space-y-[var(--space-admin-2)]"
              >
                <h3 className={`${texte} font-semibold`}>{LIBELLE_TYPE.observation}</h3>
                <Commun trainerId={id} retour={retour} type="observation" aujourdhui={aujourdhui} />
                <label className={`${discret} block`}>
                  Session observée
                  <select
                    name="sessionId"
                    required
                    defaultValue={obs?.premiere?.sessionId ?? ""}
                    className={champ}
                  >
                    <option value="" disabled>
                      —
                    </option>
                    {commencees.map((m) => (
                      <option key={m.sessionId} value={m.sessionId}>
                        {m.numero} (du {jourFr(m.debut)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`${discret} block`}>
                  Observateur
                  <input
                    type="text"
                    name="observateur"
                    required
                    maxLength={200}
                    className={champ}
                  />
                </label>
                <Criteres type="observation" />
                <Conclusion />
                <button type="submit" className={bouton} disabled={commencees.length === 0}>
                  Enregistrer l&apos;observation
                </button>
              </form>

              <form
                action={enregistrerGrilleSuiviFormAction}
                className="space-y-[var(--space-admin-2)]"
              >
                <h3 className={`${texte} font-semibold`}>{LIBELLE_TYPE.evaluation_mission}</h3>
                <Commun
                  trainerId={id}
                  retour={retour}
                  type="evaluation_mission"
                  aujourdhui={aujourdhui}
                />
                <label className={`${discret} block`}>
                  Mission
                  <select name="sessionId" required defaultValue="" className={champ}>
                    <option value="" disabled>
                      —
                    </option>
                    {finies.map((m) => (
                      <option key={m.sessionId} value={m.sessionId}>
                        {m.numero} (fin le {jourFr(m.fin)})
                      </option>
                    ))}
                  </select>
                </label>
                <Criteres type="evaluation_mission" />
                <label className={`${discret} block`}>
                  Satisfaction des stagiaires (1 à 5), seulement si aucun questionnaire n&apos;a de
                  réponse
                  <input
                    type="number"
                    name="satisfaction"
                    min={1}
                    max={5}
                    step={1}
                    className={champ}
                  />
                </label>
                <Conclusion />
                <button type="submit" className={bouton} disabled={finies.length === 0}>
                  Enregistrer l&apos;évaluation
                </button>
              </form>

              <form
                action={enregistrerGrilleSuiviFormAction}
                className="space-y-[var(--space-admin-2)]"
              >
                <h3 className={`${texte} font-semibold`}>{LIBELLE_TYPE.reevaluation}</h3>
                <Commun
                  trainerId={id}
                  retour={retour}
                  type="reevaluation"
                  aujourdhui={aujourdhui}
                />
                <Criteres type="reevaluation" />
                <Conclusion />
                <button type="submit" className={bouton}>
                  Enregistrer la réévaluation
                </button>
              </form>
            </div>
          </section>
        </>
      )}

      <section className={carte} id="grilles">
        <h2 className={titre}>Dossier : grilles saisies</h2>
        {ecran.grilles.length === 0 ? (
          <p className={discret}>Aucune grille.</p>
        ) : (
          <ul className="space-y-[var(--space-admin-4)]">
            {ecran.grilles.map((g) => (
              <Grille key={g.id} g={g} />
            ))}
          </ul>
        )}
      </section>

      <section className={carte} id="decisions">
        <h2 className={titre}>Dossier : décisions motivées</h2>
        {ecran.decisions.length === 0 ? (
          <p className={discret}>Aucune décision.</p>
        ) : (
          <ul className="space-y-[var(--space-admin-3)]">
            {ecran.decisions.map((d) => (
              <li key={d.id} className={texte}>
                <span className="font-medium">
                  {d.type === "levee_suspension" ? "Reprise des missions" : "Entretien"}
                </span>{" "}
                <span className={discret}>
                  {d.sessionNumero !== null ? `· session ${d.sessionNumero} ` : ""}· le{" "}
                  {dateFmt.format(d.createdAt)} · signée par {d.auteurNom}
                </span>
                <p className="whitespace-pre-line">{d.motif}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPageShell>
  );
}
