"use client";
// use-client: état local + Server Action.

/**
 * « Valable jusqu'au » : choix de la date de validité d'un devis en BROUILLON (fiche A5).
 * Appelle `fixerValiditeDevisBrouillonAction` (7 à 90 jours, refus si le devis a été modifié
 * ailleurs : `attenduMajLe`). Le message d'erreur de l'action est affiché tel quel.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { fixerValiditeDevisBrouillonAction } from "@/server/actions/qualiopi/devis-classique-modifier";

export interface ValiditeBrouillonProps {
  devisId: string;
  statut: string;
  /** Date de validité actuelle (ISO). */
  dateValidite: string;
  /** `updatedAt` du devis (ISO) : sert de `attenduMajLe`. */
  majLe: string;
}

/** Jour civil `AAAA-MM-JJ` à Paris (la validité court jusqu'à 23 h 59 min 59 s, heure de Paris). */
function jourParis(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function ValiditeBrouillon({
  devisId,
  statut,
  dateValidite,
  majLe,
}: ValiditeBrouillonProps): React.ReactElement | null {
  const router = useRouter();
  const champId = useId();
  const [enCours, startTransition] = useTransition();
  const [date, setDate] = useState(() => jourParis(dateValidite));
  const [majCourante, setMajCourante] = useState(majLe);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  if (statut !== "brouillon") return null;

  function enregistrer() {
    setErreur(null);
    setSucces(false);
    startTransition(async () => {
      const res = await fixerValiditeDevisBrouillonAction({
        id: devisId,
        attenduMajLe: majCourante,
        dateValidite: date,
      });
      if ("error" in res) {
        setErreur(res.error);
        return;
      }
      setMajCourante(res.data.majLe);
      setSucces(true);
      router.refresh();
    });
  }

  return (
    <div className="text-[length:var(--text-admin-sm)]">
      <label
        htmlFor={champId}
        className="block text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
      >
        Valable jusqu&apos;au
      </label>
      <div className="mt-0.5 flex flex-wrap items-center gap-[var(--space-admin-2)]">
        <input
          id={champId}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-1)]"
        />
        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours || date === ""}
          className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-fg)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] font-medium text-[color:var(--color-admin-paper)] disabled:opacity-40"
        >
          Enregistrer la date
        </button>
      </div>
      {erreur !== null && (
        <p role="alert" className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      )}
      {succes && (
        <p
          role="status"
          className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-fg-muted)]"
        >
          Date de validité enregistrée.
        </p>
      )}
    </div>
  );
}
