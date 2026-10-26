"use client";
// use-client: le contenu du brouillon n'existe que dans la réponse de l'action (lecture tracée), jamais dans la page rendue.

// « Lire le brouillon » d'un questionnaire avant audit (2026-10-27). Rendu pour le
// super-administrateur seulement ; l'action revérifie le rôle et l'interrupteur, et trace l'accès.

import { useActionState } from "react";

import {
  lireBrouillonAction,
  type EtatLectureBrouillon,
} from "@/features/questionnaire-preaudit/actions-suivi-ouvertures";

const jourHeure = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function LireBrouillonPreaudit({
  brouillonId,
}: {
  brouillonId: string;
}): React.ReactElement {
  const [etat, lire, enCours] = useActionState<EtatLectureBrouillon, FormData>(
    lireBrouillonAction,
    { etat: "initial" },
  );
  return (
    <div className="mt-[var(--space-admin-1)]">
      {etat.etat !== "lu" ? (
        <form action={lire}>
          <input type="hidden" name="brouillonId" value={brouillonId} />
          <button type="submit" className="admin-link" disabled={enCours}>
            {enCours ? "Lecture…" : "Lire le brouillon (lecture tracée)"}
          </button>
        </form>
      ) : null}
      {etat.etat === "refuse" ? (
        <p role="alert" className="text-[color:var(--color-admin-error)]">
          {etat.message}
        </p>
      ) : null}
      {etat.etat === "lu" ? (
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]">
          <p className="font-medium">
            Brouillon de : {etat.personne} · enregistré le {jourHeure(etat.majLe)}
          </p>
          <p className="text-[color:var(--color-admin-fg-muted)]">
            Ce n&apos;est pas une réponse envoyée : la personne peut encore tout changer.
          </p>
          {etat.champs.length === 0 ? (
            <p>Aucun champ rempli.</p>
          ) : (
            <dl className="mt-[var(--space-admin-2)] grid gap-x-[var(--space-admin-4)] gap-y-[var(--space-admin-1)] sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              {etat.champs.map((c) => (
                <div key={c.cle} className="contents">
                  <dt className="text-[color:var(--color-admin-fg-muted)]">{c.libelle}</dt>
                  <dd className="break-words whitespace-pre-wrap">{c.valeur}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ) : null}
    </div>
  );
}
