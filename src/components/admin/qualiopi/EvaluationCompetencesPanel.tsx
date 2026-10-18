"use client";
// use-client: grilles notées interactives (sélecteurs, calcul des seuils en direct,
// useTransition) de l'évaluation des compétences pédagogiques (Qualiopi ind. 21).

/**
 * Évaluation des compétences pédagogiques d'un formateur indépendant (Qualiopi ind. 21).
 *
 * Rendu par la fiche console pour un sous-traitant et le rôle `habiliter_formateur`.
 * Trois grilles et une case, en AJOUT SEUL : rien ne se modifie ni ne se supprime, une
 * nouvelle grille remplace la précédente pour la lecture et l'ancienne reste listée.
 * Les seuils s'affichent en direct ; « habilité » est refusé par le serveur s'ils ne
 * sont pas atteints. Critères et seuils : `evaluation-competences/configuration.ts` et
 * `reglages.ts`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  verserEvaluationCompetencesAction,
  type VersementEvaluationInput,
} from "@/server/actions/qualiopi/formateur-evaluation-competences";
import {
  BLOCS_MISE_EN_SITUATION,
  CRITERES_ENTRETIEN,
  DECISIONS_HABILITATION,
  LIBELLES_DECISION,
  LIBELLES_GRILLES,
  NOTE_MAX,
  NOTE_MIN,
  type CritereGrille,
  type DecisionHabilitation,
} from "@/server/qualiopi/formateurs-independants/evaluation-competences/configuration";
import type { ReglagesEvaluation } from "@/server/qualiopi/formateurs-independants/evaluation-competences/reglages";
import {
  seuilsEntretien,
  seuilsMiseEnSituation,
} from "@/server/qualiopi/formateurs-independants/evaluation-competences/regles";

export interface LigneEvaluationAffichee {
  readonly id: string;
  readonly nature: string;
  readonly formationTitre: string | null;
  readonly notes: Record<string, number> | null;
  readonly decision: string | null;
  readonly motif: string | null;
  /** AAAA-MM-JJ. */
  readonly dateSuivie: string | null;
  /** Date et heure de versement, déjà mise en forme (Paris). */
  readonly versee: string;
  readonly auteur: string;
}

export interface EvaluationCompetencesPanelProps {
  readonly trainerId: string;
  readonly formations: ReadonlyArray<{ id: string; titre: string }>;
  readonly lignes: ReadonlyArray<LigneEvaluationAffichee>;
  /** Seuils RÉGLÉS en console (ou leurs défauts), lus côté serveur. */
  readonly reglages: ReglagesEvaluation;
  /** Seuils des DERNIÈRES grilles versées. */
  readonly dernierEntretienAtteint: boolean | null;
  readonly derniereMiseEnSituationAtteinte: boolean | null;
}

const labelCls =
  "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
const h3Cls = "text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]";

const NOTES = Array.from({ length: NOTE_MAX - NOTE_MIN + 1 }, (_, i) => NOTE_MIN + i);

function libelleNature(n: string): string {
  return (LIBELLES_GRILLES as Record<string, string>)[n] ?? n;
}

function Etat({ atteint, oui, non }: { atteint: boolean | null; oui: string; non: string }) {
  if (atteint === null) return <span className="admin-muted">Non versée</span>;
  return (
    <span
      className={atteint ? "admin-badge admin-badge-validated" : "admin-badge admin-badge-warning"}
    >
      {atteint ? oui : non}
    </span>
  );
}

function useVersement(onOk: () => void) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function verser(input: VersementEvaluationInput, message: string) {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const r = await verserEvaluationCompetencesAction(input);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setOk(message);
      onOk();
      router.refresh();
    });
  }
  return { error, ok, isPending, verser };
}

function Messages({ error, ok }: { error: string | null; ok: string | null }) {
  return (
    <>
      {error !== null && (
        <div className="admin-alert admin-alert-error" role="alert">
          {error}
        </div>
      )}
      {ok !== null && (
        <div className="admin-alert admin-alert-success" role="status">
          {ok}
        </div>
      )}
    </>
  );
}

function GrilleNotee({
  trainerId,
  nature,
  criteres,
  reglages: R,
}: {
  trainerId: string;
  nature: "entretien" | "mise_en_situation";
  criteres: ReadonlyArray<CritereGrille>;
  reglages: ReglagesEvaluation;
}) {
  const [notes, setNotes] = useState<Record<string, number>>({});
  const [observation, setObservation] = useState("");
  const { error, ok, isPending, verser } = useVersement(() => {
    setNotes({});
    setObservation("");
  });
  const complete = criteres.every((c) => typeof notes[c.code] === "number");
  const apercu = !complete
    ? null
    : nature === "entretien"
      ? seuilsEntretien(notes, R)
      : seuilsMiseEnSituation(notes, R);

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <h3 className={h3Cls}>{LIBELLES_GRILLES[nature]}</h3>
      <p className="admin-muted">
        {nature === "entretien"
          ? `Habilitation possible si la moyenne atteint ${R.entretienMoyenneMin} et qu'aucun critère n'est sous ${R.entretienNoteCritereMin}.`
          : `Chaque bloc doit atteindre ${R.miseEnSituationNoteBlocMin}/5 ; sinon refus motivé ou 2e essai.`}{" "}
        Seuils à valider par Will.
      </p>
      {criteres.map((c) => (
        <div key={c.code} className="grid gap-[var(--space-admin-2)] sm:grid-cols-[1fr_8rem]">
          <div>
            <label className={labelCls} htmlFor={`${nature}-${c.code}`}>
              {c.libelle}
            </label>
            <p className="admin-muted">{c.aide}</p>
          </div>
          <select
            id={`${nature}-${c.code}`}
            className={inputCls}
            value={notes[c.code] ?? ""}
            onChange={(e) =>
              setNotes((n) => {
                const v = e.target.value;
                const suite = { ...n };
                if (v === "") delete suite[c.code];
                else suite[c.code] = Number(v);
                return suite;
              })
            }
          >
            <option value="">—</option>
            {NOTES.map((v) => (
              <option key={v} value={v}>
                {v} / {NOTE_MAX}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div>
        <label className={labelCls} htmlFor={`${nature}-observation`}>
          Observation (facultative)
        </label>
        <textarea
          id={`${nature}-observation`}
          className={inputCls}
          rows={2}
          maxLength={2000}
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
        />
      </div>
      {apercu !== null && (
        <p role="status">
          {"moyenne" in apercu && apercu.moyenne !== null
            ? `Moyenne ${apercu.moyenne.toFixed(2).replace(".", ",")} — `
            : ""}
          <Etat atteint={apercu.atteint} oui="Seuils atteints" non="Seuils non atteints" />
        </p>
      )}
      <Messages error={error} ok={ok} />
      <div>
        <button
          type="button"
          className="admin-button"
          disabled={isPending || !complete}
          onClick={() =>
            verser(
              { nature, trainerId, notes, ...(observation.trim() ? { observation } : {}) },
              `${LIBELLES_GRILLES[nature]} versé(e).`,
            )
          }
        >
          Verser la grille
        </button>
      </div>
    </div>
  );
}

function Decision({
  trainerId,
  formations,
}: {
  trainerId: string;
  formations: ReadonlyArray<{ id: string; titre: string }>;
}) {
  const [formationId, setFormationId] = useState("");
  const [decision, setDecision] = useState<DecisionHabilitation | "">("");
  const [motif, setMotif] = useState("");
  const { error, ok, isPending, verser } = useVersement(() => {
    setDecision("");
    setMotif("");
  });
  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <h3 className={h3Cls}>{LIBELLES_GRILLES.decision_habilitation}</h3>
      <p className="admin-muted">
        Par formation. Le motif est obligatoire. « Habilité » n&apos;est accepté que si
        l&apos;entretien et la mise en situation les plus récents atteignent les seuils.
      </p>
      <div className="sm:max-w-md">
        <label className={labelCls} htmlFor="decision-formation">
          Formation
        </label>
        <select
          id="decision-formation"
          className={inputCls}
          value={formationId}
          onChange={(e) => setFormationId(e.target.value)}
        >
          <option value="">Choisir une formation</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.titre}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="flex flex-col gap-[var(--space-admin-1)]">
        <legend className={labelCls}>Décision</legend>
        {DECISIONS_HABILITATION.map((d) => (
          <label key={d} className="flex items-center gap-[var(--space-admin-2)]">
            <input
              type="radio"
              name="decision-habilitation"
              value={d}
              checked={decision === d}
              onChange={() => setDecision(d)}
            />
            {LIBELLES_DECISION[d]}
          </label>
        ))}
      </fieldset>
      <div>
        <label className={labelCls} htmlFor="decision-motif">
          Motif (obligatoire)
        </label>
        <textarea
          id="decision-motif"
          className={inputCls}
          rows={3}
          maxLength={2000}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </div>
      <Messages error={error} ok={ok} />
      <div>
        <button
          type="button"
          className="admin-button"
          disabled={isPending || formationId === "" || decision === "" || motif.trim() === ""}
          onClick={() =>
            verser(
              { nature: "decision_habilitation", trainerId, formationId, decision, motif },
              "Décision versée.",
            )
          }
        >
          Verser la décision
        </button>
      </div>
    </div>
  );
}

function FormationMethode({ trainerId }: { trainerId: string }) {
  const [jour, setJour] = useState("");
  const [coche, setCoche] = useState(false);
  const { error, ok, isPending, verser } = useVersement(() => {
    setJour("");
    setCoche(false);
  });
  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <h3 className={h3Cls}>{LIBELLES_GRILLES.formation_methode}</h3>
      <p className="admin-muted">Obligatoire avant l&apos;activation.</p>
      <label className="flex items-center gap-[var(--space-admin-2)]">
        <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)} />
        Le formateur a suivi la formation à la méthode
      </label>
      <div className="sm:max-w-xs">
        <label className={labelCls} htmlFor="formation-methode-jour">
          Suivie le
        </label>
        <input
          id="formation-methode-jour"
          type="date"
          className={inputCls}
          value={jour}
          onChange={(e) => setJour(e.target.value)}
        />
      </div>
      <Messages error={error} ok={ok} />
      <div>
        <button
          type="button"
          className="admin-button"
          disabled={isPending || !coche || jour === ""}
          onClick={() =>
            verser(
              { nature: "formation_methode", trainerId, jour },
              "Formation à la méthode enregistrée.",
            )
          }
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function detailLigne(l: LigneEvaluationAffichee): string {
  if (l.nature === "decision_habilitation") {
    const d = (LIBELLES_DECISION as Record<string, string>)[l.decision ?? ""] ?? l.decision ?? "";
    return `${l.formationTitre ?? "formation"} : ${d} — ${l.motif ?? ""}`;
  }
  if (l.nature === "formation_methode") {
    return l.dateSuivie
      ? `Suivie le ${new Date(`${l.dateSuivie}T12:00:00Z`).toLocaleDateString("fr-FR")}`
      : "";
  }
  const criteres = l.nature === "entretien" ? CRITERES_ENTRETIEN : BLOCS_MISE_EN_SITUATION;
  const notes = criteres.map((c) => `${c.code} ${l.notes?.[c.code] ?? "?"}`).join(" · ");
  return l.motif ? `${notes} — ${l.motif}` : notes;
}

export function EvaluationCompetencesPanel(props: EvaluationCompetencesPanelProps) {
  const { trainerId, formations, lignes, reglages } = props;
  return (
    <section
      id="evaluation-competences"
      className="admin-card mb-[var(--space-admin-5)] flex flex-col gap-[var(--space-admin-5)]"
    >
      <div>
        <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Compétences pédagogiques (Qualiopi, indicateur 21)
        </h2>
        <p className="admin-muted">
          Grilles versées en ajout seul, datées et signées de votre compte. Jamais visibles du
          formateur. Activation impossible sans entretien, mise en situation, décision « habilité »
          ou « avec réserve » sur au moins une formation, et formation à la méthode suivie.
        </p>
        <p>
          Dernier entretien :{" "}
          <Etat
            atteint={props.dernierEntretienAtteint}
            oui="Seuils atteints"
            non="Seuils non atteints"
          />{" "}
          · Dernière mise en situation :{" "}
          <Etat
            atteint={props.derniereMiseEnSituationAtteinte}
            oui="Seuils atteints"
            non="Seuils non atteints"
          />
        </p>
      </div>

      {lignes.length > 0 && (
        <div className="admin-table-wrapper overflow-x-auto">
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th scope="col">Versée le</th>
                <th scope="col">Grille</th>
                <th scope="col">Détail</th>
                <th scope="col">Par</th>
              </tr>
            </thead>
            <tbody>
              {[...lignes].reverse().map((l) => (
                <tr key={l.id}>
                  <td>{l.versee}</td>
                  <td>{libelleNature(l.nature)}</td>
                  <td>{detailLigne(l)}</td>
                  <td>{l.auteur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GrilleNotee
        trainerId={trainerId}
        nature="entretien"
        criteres={CRITERES_ENTRETIEN}
        reglages={reglages}
      />
      <GrilleNotee
        trainerId={trainerId}
        nature="mise_en_situation"
        criteres={BLOCS_MISE_EN_SITUATION}
        reglages={reglages}
      />
      <Decision trainerId={trainerId} formations={formations} />
      <FormationMethode trainerId={trainerId} />
    </section>
  );
}
