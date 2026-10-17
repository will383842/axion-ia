"use client";
// use-client: retour des gestes (rattrapage, trace d'un contrôle, suites des écarts)
// sans recharger la page ; la liste de preuves suit le contrôle choisi.

import { useActionState, useState } from "react";

import {
  corrigerEcartAction,
  leverSuspensionAction,
  synchroniserRegistreAction,
  tracerControlePreuvesAction,
  tracerControleRegistreAction,
  type EtatGesteRegistre,
} from "@/server/actions/qualiopi/registre-sous-traitants";

const INITIAL: EtatGesteRegistre = { etat: "initial" };

function Retour({ etat }: { etat: EtatGesteRegistre }): React.ReactElement | null {
  if (etat.etat === "erreur") {
    return (
      <p role="alert" className="text-[color:var(--color-admin-danger)]">
        {etat.message}
      </p>
    );
  }
  if (etat.etat === "ok") {
    return (
      <p role="status" className="text-[color:var(--color-admin-success)]">
        {etat.message}
      </p>
    );
  }
  return null;
}

export function RattrapageRegistreForm({ nombre }: { nombre: number }): React.ReactElement {
  const [etat, action, enCours] = useActionState(synchroniserRegistreAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-3)]">
      <label className="flex items-center gap-[var(--space-admin-2)]">
        <input type="checkbox" name="confirmer" value="oui" required />
        J&apos;ai relu l&apos;aperçu ci-dessus
      </label>
      <div>
        <button type="submit" className="admin-button" disabled={enCours || nombre === 0}>
          {enCours ? "Synchronisation…" : `Appliquer le rattrapage (${nombre} ligne(s))`}
        </button>
      </div>
      <Retour etat={etat} />
    </form>
  );
}

export function TracerControleForm({
  formateurs,
  controles,
  aujourdhui,
}: {
  formateurs: ReadonlyArray<{ trainerId: string; libelle: string }>;
  controles: ReadonlyArray<{ code: string; libelle: string }>;
  /** `AAAA-MM-JJ`, jour de Paris. */
  aujourdhui: string;
}): React.ReactElement {
  const [etat, action, enCours] = useActionState(tracerControleRegistreAction, INITIAL);
  return (
    <form action={action} className="grid gap-[var(--space-admin-3)] sm:grid-cols-2">
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        Sous-traitant
        <select name="trainerId" required className="admin-select">
          {formateurs.map((f) => (
            <option key={f.trainerId} value={f.trainerId}>
              {f.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        Contrôle
        <select name="code" required className="admin-select">
          {controles.map((c) => (
            <option key={c.code} value={c.code}>
              {c.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        Résultat
        <select name="resultat" required className="admin-select" defaultValue="conforme">
          <option value="conforme">Conforme</option>
          <option value="non_conforme">Non conforme</option>
          <option value="a_revoir">À revoir</option>
        </select>
      </label>
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        Fait le
        <input
          type="date"
          name="faitLe"
          required
          max={aujourdhui}
          defaultValue={aujourdhui}
          className="admin-input"
        />
      </label>
      <label className="flex flex-col gap-[var(--space-admin-1)] sm:col-span-2">
        Motif (obligatoire si non conforme ou à revoir)
        <textarea name="motif" rows={2} maxLength={2000} className="admin-input" />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="admin-button"
          disabled={enCours || formateurs.length === 0}
        >
          {enCours ? "Enregistrement…" : "Tracer le contrôle"}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Retour etat={etat} />
      </div>
    </form>
  );
}

interface PreuveForm {
  readonly code: string;
  readonly libelle: string;
  readonly gravite: "majeur" | "mineur";
}

/** Contrôle à preuves : contrôle de chaque mission, ou revue complète annuelle. */
export function ControlePreuvesForm({
  formateurs,
  missions,
  preuvesMission,
  preuvesRevue,
  aujourdhui,
}: {
  formateurs: ReadonlyArray<{ trainerId: string; libelle: string }>;
  missions: ReadonlyArray<{
    missionId: string;
    trainerId: string;
    libelle: string;
    dejaControlee: boolean;
  }>;
  preuvesMission: ReadonlyArray<PreuveForm>;
  preuvesRevue: ReadonlyArray<PreuveForm>;
  /** `AAAA-MM-JJ`, jour de Paris. */
  aujourdhui: string;
}): React.ReactElement {
  const [etat, action, enCours] = useActionState(tracerControlePreuvesAction, INITIAL);
  const [trainerId, setTrainerId] = useState(formateurs[0]?.trainerId ?? "");
  const [code, setCode] = useState<"controle_mission" | "revue_annuelle">("controle_mission");
  const siennes = missions.filter((m) => m.trainerId === trainerId);
  const preuves = code === "controle_mission" ? preuvesMission : preuvesRevue;
  const sansMission = code === "controle_mission" && siennes.length === 0;
  return (
    <form action={action} className="grid gap-[var(--space-admin-3)] sm:grid-cols-2">
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        Sous-traitant
        <select
          name="trainerId"
          required
          className="admin-select"
          value={trainerId}
          onChange={(e) => setTrainerId(e.target.value)}
        >
          {formateurs.map((f) => (
            <option key={f.trainerId} value={f.trainerId}>
              {f.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        Contrôle
        <select
          name="code"
          required
          className="admin-select"
          value={code}
          onChange={(e) =>
            setCode(e.target.value === "revue_annuelle" ? "revue_annuelle" : "controle_mission")
          }
        >
          <option value="controle_mission">Contrôle de la mission</option>
          <option value="revue_annuelle">Revue complète annuelle</option>
        </select>
      </label>
      {code === "controle_mission" ? (
        <label className="flex flex-col gap-[var(--space-admin-1)] sm:col-span-2">
          Mission contrôlée
          {sansMission ? (
            <span className="admin-meta-small">
              Aucune mission commencée pour ce sous-traitant.
            </span>
          ) : (
            <select name="missionId" required className="admin-select">
              {siennes.map((m) => (
                <option key={m.missionId} value={m.missionId}>
                  {m.libelle}
                  {m.dejaControlee ? " — déjà contrôlée" : ""}
                </option>
              ))}
            </select>
          )}
        </label>
      ) : null}
      <fieldset className="flex flex-col gap-[var(--space-admin-1)] sm:col-span-2">
        <legend>Preuves présentes (cocher chacune)</legend>
        {preuves.map((p) => (
          <label key={`${code}-${p.code}`} className="flex items-center gap-[var(--space-admin-2)]">
            <input type="checkbox" name="preuves" value={p.code} />
            {p.libelle}
            <span className="admin-meta-small">
              {p.gravite === "majeur"
                ? "absente : écart majeur, suspension"
                : "absente : écart mineur, plan de correction"}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        Fait le
        <input
          type="date"
          name="faitLe"
          required
          max={aujourdhui}
          defaultValue={aujourdhui}
          className="admin-input"
        />
      </label>
      <label className="flex flex-col gap-[var(--space-admin-1)] sm:col-span-2">
        Observations (facultatif)
        <textarea name="motif" rows={2} maxLength={2000} className="admin-input" />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="admin-button"
          disabled={enCours || formateurs.length === 0 || sansMission}
        >
          {enCours ? "Enregistrement…" : "Tracer le contrôle"}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Retour etat={etat} />
      </div>
    </form>
  );
}

/** Levée d'une suspension : décision motivée. */
export function LeverSuspensionForm({ trainerId }: { trainerId: string }): React.ReactElement {
  const [etat, action, enCours] = useActionState(leverSuspensionAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-1)]">
      <input type="hidden" name="trainerId" value={trainerId} />
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        Motif de la levée
        <textarea name="motif" rows={2} maxLength={2000} required className="admin-input" />
      </label>
      <div>
        <button type="submit" className="admin-button-ghost" disabled={enCours}>
          {enCours ? "Levée…" : "Lever la suspension"}
        </button>
      </div>
      <Retour etat={etat} />
    </form>
  );
}

/** Clôture d'un plan de correction (écart mineur) : motivée. */
export function CorrigerEcartForm({ ecartId }: { ecartId: string }): React.ReactElement {
  const [etat, action, enCours] = useActionState(corrigerEcartAction, INITIAL);
  return (
    <form action={action} className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
      <input type="hidden" name="ecartId" value={ecartId} />
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        Correction obtenue
        <input name="motif" required maxLength={2000} className="admin-input" />
      </label>
      <button type="submit" className="admin-button-ghost" disabled={enCours}>
        {enCours ? "…" : "Tracer la correction"}
      </button>
      <Retour etat={etat} />
    </form>
  );
}
