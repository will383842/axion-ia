"use client";
// use-client: retour des gestes (rattrapage, trace d'un contrôle) sans recharger la page.

import { useActionState } from "react";

import {
  synchroniserRegistreAction,
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
