"use client";
// use-client: éditeur de séance coaching (5 livrables conseil, useState/useTransition).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateSessionStatutAction,
  upsertCartographieAction,
  upsertOptimisationAction,
  deleteOptimisationAction,
  upsertPlanAction,
  addCompteRenduAction,
  deleteCompteRenduAction,
  addJournalAction,
  deleteJournalAction,
} from "@/server/actions/formateur/coaching.actions";
import {
  OPTIMISATION_TYPES,
  optimisationTypeLabel,
  SESSION_STATUTS,
} from "@/server/formateur/coaching-options";

// ── Types (miroir de la sérialisation côté page) ─────────────────────────────
type Row = Record<string, unknown>;
interface Optim {
  id: string;
  type: string;
  titre: string;
  situationActuelle: string | null;
  piste: string | null;
  gainTempsMinParOcc: number | null;
  occurrencesSemaine: number | null;
  gainEuroOuRisque: string | null;
  facilite: number | null;
  priorite: number | null;
  retenue: boolean;
}
interface SeanceData {
  id: string;
  statut: string;
  cartographie: {
    taches: unknown[];
    chronophages: string | null;
    irritants: string | null;
    donneesSensibles: string | null;
    contraintes: string | null;
  } | null;
  optimisations: Optim[];
  plan: {
    objectifs: string | null;
    optimisationsRetenues: unknown[];
    prochainesEtapes: unknown[];
    pointsVigilance: string | null;
    gainTempsHSemaine: number | null;
    suiviPropose: string | null;
  } | null;
  comptesRendus: Array<{
    id: string;
    dateSeance: string;
    dureeMinutes: number | null;
    objectifs: string | null;
    misesEnSituation: unknown[];
    phasesReflexives: unknown[];
    planRemis: boolean;
    suite: string | null;
    notesConfidentielles: string | null;
  }>;
  journaux: Array<{
    id: string;
    periode: string | null;
    acquisitions: string | null;
    blocages: string | null;
    prochainsFocus: string | null;
    gainTempsCumuleHSem: number | null;
    engagement: number | null;
  }>;
}

const TABS = [
  { key: "cartographie", label: "Cartographie" },
  { key: "optimisations", label: "Optimisations" },
  { key: "plan", label: "Plan" },
  { key: "cr", label: "Comptes-rendus" },
  { key: "journal", label: "Journal" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// ── Primitives UI ────────────────────────────────────────────────────────────
const inputCls = "border-border block w-full rounded border px-2 py-1.5 text-sm";
const labelCls = "text-mocha block text-xs font-medium";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className={labelCls}>
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.ReactElement {
  return <textarea rows={3} {...props} className={inputCls} />;
}

/** Éditeur générique de lignes répétables (JSON). */
function RepeatableRows({
  rows,
  columns,
  onChange,
}: {
  rows: Row[];
  columns: Array<{ key: string; label: string; type?: "text" | "number" }>;
  onChange: (rows: Row[]) => void;
}): React.ReactElement {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="border-sand flex flex-wrap items-end gap-2 rounded border p-2">
          {columns.map((c) => (
            <label key={c.key} className="text-fg-muted text-[11px]">
              {c.label}
              <input
                type={c.type === "number" ? "number" : "text"}
                value={String(row[c.key] ?? "")}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = {
                    ...row,
                    [c.key]: c.type === "number" ? Number(e.target.value) || 0 : e.target.value,
                  };
                  onChange(next);
                }}
                className="border-border mt-0.5 block w-32 rounded border px-2 py-1 text-sm"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="text-error text-xs hover:underline"
          >
            Retirer
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, {}])}
        className="text-terracotta text-xs font-medium hover:underline"
      >
        + Ajouter une ligne
      </button>
    </div>
  );
}

function SaveBar({
  pending,
  saved,
  error,
  onSave,
}: {
  pending: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        disabled={pending}
        onClick={onSave}
        className="bg-terracotta rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      {saved ? <span className="text-success text-xs">Enregistré ✓</span> : null}
      {error ? <span className="text-error text-xs">{error}</span> : null}
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────
export function SeanceEditor({ session }: { session: SeanceData }): React.ReactElement {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("cartographie");
  const refresh = () => router.refresh();

  return (
    <div>
      <StatutSelector sessionId={session.id} statut={session.statut} />

      <div className="border-border mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.key
                ? "border-terracotta text-terracotta font-medium"
                : "text-fg-muted border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Onglets gardés MONTÉS (masquage CSS) pour ne pas perdre les saisies non
          enregistrées (Cartographie/Plan) au changement d'onglet. */}
      <div className={tab === "cartographie" ? "" : "hidden"}>
        <CartographieTab session={session} onDone={refresh} />
      </div>
      <div className={tab === "optimisations" ? "" : "hidden"}>
        <OptimisationsTab session={session} onDone={refresh} />
      </div>
      <div className={tab === "plan" ? "" : "hidden"}>
        <PlanTab session={session} onDone={refresh} />
      </div>
      <div className={tab === "cr" ? "" : "hidden"}>
        <ComptesRendusTab session={session} onDone={refresh} />
      </div>
      <div className={tab === "journal" ? "" : "hidden"}>
        <JournalTab session={session} onDone={refresh} />
      </div>
    </div>
  );
}

function StatutSelector({
  sessionId,
  statut,
}: {
  sessionId: string;
  statut: string;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-fg-muted text-xs">Statut :</span>
      <select
        defaultValue={statut}
        disabled={pending}
        onChange={(e) => {
          const value = e.target.value as "planifiee" | "realisee" | "annulee";
          startTransition(async () => {
            await updateSessionStatutAction({ sessionId, statut: value });
            router.refresh();
          });
        }}
        className="border-border rounded border px-2 py-1 text-sm"
      >
        {SESSION_STATUTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── 1. Cartographie ──────────────────────────────────────────────────────────
function CartographieTab({
  session,
  onDone,
}: {
  session: SeanceData;
  onDone: () => void;
}): React.ReactElement {
  const c = session.cartographie;
  const [taches, setTaches] = useState<Row[]>((c?.taches as Row[]) ?? []);
  const [chronophages, setChronophages] = useState(c?.chronophages ?? "");
  const [irritants, setIrritants] = useState(c?.irritants ?? "");
  const [donneesSensibles, setDonneesSensibles] = useState(c?.donneesSensibles ?? "");
  const [contraintes, setContraintes] = useState(c?.contraintes ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await upsertCartographieAction({
        sessionId: session.id,
        taches,
        chronophages: chronophages || undefined,
        irritants: irritants || undefined,
        donneesSensibles: donneesSensibles || undefined,
        contraintes: contraintes || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur.");
        return;
      }
      setSaved(true);
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-fg-muted text-sm">
        Analyse de l&apos;activité réelle : cartographiez les tâches récurrentes pour repérer ce qui
        peut être optimisé.
      </p>
      <Field label="Tâches récurrentes">
        <RepeatableRows
          rows={taches}
          onChange={setTaches}
          columns={[
            { key: "tache", label: "Tâche" },
            { key: "frequence", label: "Fréquence" },
            { key: "tempsParOccurrenceMin", label: "Temps/occ. (min)", type: "number" },
            { key: "valeurAjoutee", label: "Valeur ajoutée" },
          ]}
        />
      </Field>
      <Field label="Tâches chronophages">
        <Textarea value={chronophages} onChange={(e) => setChronophages(e.target.value)} />
      </Field>
      <Field label="Irritants / points de friction">
        <Textarea value={irritants} onChange={(e) => setIrritants(e.target.value)} />
      </Field>
      <Field label="Données sensibles manipulées (RGPD)">
        <Textarea value={donneesSensibles} onChange={(e) => setDonneesSensibles(e.target.value)} />
      </Field>
      <Field label="Contraintes (techniques, organisationnelles)">
        <Textarea value={contraintes} onChange={(e) => setContraintes(e.target.value)} />
      </Field>
      <SaveBar pending={pending} saved={saved} error={error} onSave={save} />
    </div>
  );
}

// ── 2. Optimisations ─────────────────────────────────────────────────────────
function OptimisationsTab({
  session,
  onDone,
}: {
  session: SeanceData;
  onDone: () => void;
}): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(OPTIMISATION_TYPES[0]?.value ?? "automatisation");
  const [titre, setTitre] = useState("");
  const [situation, setSituation] = useState("");
  const [piste, setPiste] = useState("");
  const [gainMin, setGainMin] = useState("");
  const [occ, setOcc] = useState("");
  const [gainEuro, setGainEuro] = useState("");
  const [facilite, setFacilite] = useState("");
  const [priorite, setPriorite] = useState("");

  function add() {
    setError(null);
    if (!titre.trim()) {
      setError("Titre requis.");
      return;
    }
    startTransition(async () => {
      const res = await upsertOptimisationAction({
        sessionId: session.id,
        type: type as "automatisation",
        titre: titre.trim(),
        situationActuelle: situation || undefined,
        piste: piste || undefined,
        gainTempsMinParOcc: gainMin ? Number(gainMin) : undefined,
        occurrencesSemaine: occ ? Number(occ) : undefined,
        gainEuroOuRisque: gainEuro || undefined,
        facilite: facilite ? Number(facilite) : undefined,
        priorite: priorite ? Number(priorite) : undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur.");
        return;
      }
      setTitre("");
      setSituation("");
      setPiste("");
      setGainMin("");
      setOcc("");
      setGainEuro("");
      setFacilite("");
      setPriorite("");
      onDone();
    });
  }

  function toggleRetenue(o: Optim) {
    startTransition(async () => {
      await upsertOptimisationAction({
        sessionId: session.id,
        id: o.id,
        type: o.type as "automatisation",
        titre: o.titre,
        retenue: !o.retenue,
      });
      onDone();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteOptimisationAction({ sessionId: session.id, id });
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-fg-muted text-sm">
        Pistes d&apos;optimisation / automatisation identifiées. Cochez « retenue » pour les inclure
        au plan.
      </p>

      {session.optimisations.length > 0 ? (
        <ul className="space-y-2">
          {session.optimisations.map((o) => (
            <li
              key={o.id}
              className="border-border bg-sand flex flex-wrap items-center justify-between gap-2 rounded border p-3"
            >
              <div>
                <span className="text-mocha text-sm font-medium">{o.titre}</span>
                <span className="text-fg-muted ml-2 text-xs">{optimisationTypeLabel(o.type)}</span>
                {o.gainTempsMinParOcc && o.occurrencesSemaine ? (
                  <span className="text-success ml-2 text-xs">
                    ≈ {((o.gainTempsMinParOcc * o.occurrencesSemaine) / 60).toFixed(1)} h/sem
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleRetenue(o)}
                  className={`rounded px-2 py-0.5 ${o.retenue ? "bg-sage-soft text-success" : "bg-sand text-fg-muted"}`}
                >
                  {o.retenue ? "Retenue" : "À étudier"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(o.id)}
                  className="text-error hover:underline"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted text-sm">Aucune optimisation pour l&apos;instant.</p>
      )}

      <div className="border-border space-y-2 rounded-lg border p-3">
        <h3 className="text-mocha text-sm font-semibold">Ajouter une optimisation</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {OPTIMISATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Titre">
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Gain (min / occurrence)">
            <input
              type="number"
              value={gainMin}
              onChange={(e) => setGainMin(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Occurrences / semaine">
            <input
              type="number"
              value={occ}
              onChange={(e) => setOcc(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Gain € ou risque évité">
            <input
              value={gainEuro}
              onChange={(e) => setGainEuro(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Facilité (1 facile → 5 complexe)">
            <input
              type="number"
              min={1}
              max={5}
              value={facilite}
              onChange={(e) => setFacilite(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Priorité (1 = max)">
            <input
              type="number"
              min={1}
              value={priorite}
              onChange={(e) => setPriorite(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Situation actuelle">
          <Textarea value={situation} onChange={(e) => setSituation(e.target.value)} />
        </Field>
        <Field label="Piste proposée">
          <Textarea value={piste} onChange={(e) => setPiste(e.target.value)} />
        </Field>
        {error ? <p className="text-error text-xs">{error}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={add}
          className="bg-terracotta rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Ajout…" : "Ajouter"}
        </button>
      </div>
    </div>
  );
}

// ── 3. Plan ──────────────────────────────────────────────────────────────────
function PlanTab({
  session,
  onDone,
}: {
  session: SeanceData;
  onDone: () => void;
}): React.ReactElement {
  const p = session.plan;
  const [objectifs, setObjectifs] = useState(p?.objectifs ?? "");
  const [retenues, setRetenues] = useState<Row[]>((p?.optimisationsRetenues as Row[]) ?? []);
  const [etapes, setEtapes] = useState<Row[]>((p?.prochainesEtapes as Row[]) ?? []);
  const [vigilance, setVigilance] = useState(p?.pointsVigilance ?? "");
  const [gain, setGain] = useState(p?.gainTempsHSemaine != null ? String(p.gainTempsHSemaine) : "");
  const [suivi, setSuivi] = useState(p?.suiviPropose ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await upsertPlanAction({
        sessionId: session.id,
        objectifs: objectifs || undefined,
        optimisationsRetenues: retenues,
        prochainesEtapes: etapes,
        pointsVigilance: vigilance || undefined,
        gainTempsHSemaine: gain ? Number(gain) : undefined,
        suiviPropose: suivi || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur.");
        return;
      }
      setSaved(true);
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-fg-muted text-sm">
        Plan d&apos;optimisation personnalisé remis au bénéficiaire.
      </p>
      <Field label="Objectifs">
        <Textarea value={objectifs} onChange={(e) => setObjectifs(e.target.value)} />
      </Field>
      <Field label="Optimisations retenues">
        <RepeatableRows
          rows={retenues}
          onChange={setRetenues}
          columns={[
            { key: "optimisation", label: "Optimisation" },
            { key: "comment", label: "Comment" },
            { key: "gainAttendu", label: "Gain attendu" },
            { key: "quand", label: "Quand" },
          ]}
        />
      </Field>
      <Field label="Prochaines étapes">
        <RepeatableRows
          rows={etapes}
          onChange={setEtapes}
          columns={[
            { key: "etape", label: "Étape" },
            { key: "echeance", label: "Échéance" },
          ]}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Gain de temps estimé (h/semaine)">
          <input
            type="number"
            value={gain}
            onChange={(e) => setGain(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Suivi proposé">
          <input value={suivi} onChange={(e) => setSuivi(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Points de vigilance">
        <Textarea value={vigilance} onChange={(e) => setVigilance(e.target.value)} />
      </Field>
      <SaveBar pending={pending} saved={saved} error={error} onSave={save} />
    </div>
  );
}

// ── 4. Comptes-rendus ────────────────────────────────────────────────────────
function ComptesRendusTab({
  session,
  onDone,
}: {
  session: SeanceData;
  onDone: () => void;
}): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [duree, setDuree] = useState("");
  const [objectifs, setObjectifs] = useState("");
  const [mises, setMises] = useState<Row[]>([]);
  const [planRemis, setPlanRemis] = useState(false);
  const [suite, setSuite] = useState("");
  const [notes, setNotes] = useState("");

  function add() {
    setError(null);
    if (!date) {
      setError("Date requise.");
      return;
    }
    startTransition(async () => {
      const res = await addCompteRenduAction({
        sessionId: session.id,
        dateSeance: date,
        dureeMinutes: duree ? Number(duree) : undefined,
        objectifs: objectifs || undefined,
        misesEnSituation: mises,
        planRemis,
        suite: suite || undefined,
        notesConfidentielles: notes || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur.");
        return;
      }
      setDate("");
      setDuree("");
      setObjectifs("");
      setMises([]);
      setPlanRemis(false);
      setSuite("");
      setNotes("");
      onDone();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteCompteRenduAction({ sessionId: session.id, id });
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      {session.comptesRendus.length > 0 ? (
        <ul className="space-y-2">
          {session.comptesRendus.map((c) => (
            <li key={c.id} className="border-border bg-sand rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-mocha font-medium">{c.dateSeance}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(c.id)}
                  className="text-error text-xs hover:underline"
                >
                  Supprimer
                </button>
              </div>
              {c.objectifs ? <p className="text-fg-muted mt-1">{c.objectifs}</p> : null}
              <p className="text-fg-muted text-xs">
                {c.dureeMinutes ? `${c.dureeMinutes} min · ` : ""}
                {c.planRemis ? "Plan remis" : "Plan non remis"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted text-sm">Aucun compte-rendu.</p>
      )}

      <div className="border-border space-y-2 rounded-lg border p-3">
        <h3 className="text-mocha text-sm font-semibold">Nouveau compte-rendu</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Date de la séance">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Durée (min)">
            <input
              type="number"
              value={duree}
              onChange={(e) => setDuree(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Objectifs de la séance">
          <Textarea value={objectifs} onChange={(e) => setObjectifs(e.target.value)} />
        </Field>
        <Field label="Mises en situation">
          <RepeatableRows
            rows={mises}
            onChange={setMises}
            columns={[
              { key: "cas", label: "Cas" },
              { key: "usageIa", label: "Usage IA" },
              { key: "resultat", label: "Résultat" },
              { key: "autonomie", label: "Autonomie" },
            ]}
          />
        </Field>
        {/* 2026-08-10 (décision Will) : champ « Phases réflexives (AFEST) »
            retiré — notion AFEST, le 1-to-1 est du conseil hors Qualiopi. */}
        <label className="text-mocha flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={planRemis}
            onChange={(e) => setPlanRemis(e.target.checked)}
          />
          Plan d&apos;optimisation remis au bénéficiaire
        </label>
        <Field label="Suite à donner">
          <input value={suite} onChange={(e) => setSuite(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Notes confidentielles (coach uniquement)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error ? <p className="text-error text-xs">{error}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={add}
          className="bg-terracotta rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Ajout…" : "Ajouter le compte-rendu"}
        </button>
      </div>
    </div>
  );
}

// ── 5. Journal ───────────────────────────────────────────────────────────────
function JournalTab({
  session,
  onDone,
}: {
  session: SeanceData;
  onDone: () => void;
}): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState("");
  const [acquisitions, setAcquisitions] = useState("");
  const [blocages, setBlocages] = useState("");
  const [focus, setFocus] = useState("");
  const [gain, setGain] = useState("");
  const [engagement, setEngagement] = useState("");

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await addJournalAction({
        sessionId: session.id,
        periode: periode || undefined,
        acquisitions: acquisitions || undefined,
        blocages: blocages || undefined,
        prochainsFocus: focus || undefined,
        gainTempsCumuleHSem: gain ? Number(gain) : undefined,
        engagement: engagement ? Number(engagement) : undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur.");
        return;
      }
      setPeriode("");
      setAcquisitions("");
      setBlocages("");
      setFocus("");
      setGain("");
      setEngagement("");
      onDone();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteJournalAction({ sessionId: session.id, id });
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-fg-muted text-sm">
        Suivi de la progression entre les séances (gains cumulés, blocages, focus).
      </p>

      {session.journaux.length > 0 ? (
        <ul className="space-y-2">
          {session.journaux.map((j) => (
            <li key={j.id} className="border-border bg-sand rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-mocha font-medium">{j.periode ?? "Entrée"}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(j.id)}
                  className="text-error text-xs hover:underline"
                >
                  Supprimer
                </button>
              </div>
              {j.acquisitions ? <p className="text-fg-muted mt-1">{j.acquisitions}</p> : null}
              {j.gainTempsCumuleHSem != null ? (
                <p className="text-success text-xs">{j.gainTempsCumuleHSem} h/sem cumulées</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted text-sm">Aucune entrée de journal.</p>
      )}

      <div className="border-border space-y-2 rounded-lg border p-3">
        <h3 className="text-mocha text-sm font-semibold">Nouvelle entrée</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Période">
            <input
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              placeholder="Semaine 3"
              className={inputCls}
            />
          </Field>
          <Field label="Gain cumulé (h/sem)">
            <input
              type="number"
              value={gain}
              onChange={(e) => setGain(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Acquisitions">
          <Textarea value={acquisitions} onChange={(e) => setAcquisitions(e.target.value)} />
        </Field>
        <Field label="Blocages">
          <Textarea value={blocages} onChange={(e) => setBlocages(e.target.value)} />
        </Field>
        <Field label="Prochains focus">
          <Textarea value={focus} onChange={(e) => setFocus(e.target.value)} />
        </Field>
        <Field label="Engagement (1-5)">
          <input
            type="number"
            min={1}
            max={5}
            value={engagement}
            onChange={(e) => setEngagement(e.target.value)}
            className={inputCls}
          />
        </Field>
        {error ? <p className="text-error text-xs">{error}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={add}
          className="bg-terracotta rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Ajout…" : "Ajouter l'entrée"}
        </button>
      </div>
    </div>
  );
}
