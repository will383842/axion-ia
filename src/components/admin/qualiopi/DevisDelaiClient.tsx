"use client";
// use-client: zone « Le client demande un délai » de la fiche d'un devis envoyé (demanderDelaiClientAction / leverDelaiClientAction). useState + useTransition + router.refresh().

/**
 * DevisDelaiClient — « Ne pas relancer avant le JJ/MM/AAAA » pour un devis envoyé.
 *
 * Aucun appel en base côté client : tout passe par les deux actions serveur. Rien n'est envoyé au
 * client. `router.refresh()` après chaque succès.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  demanderDelaiClientAction,
  leverDelaiClientAction,
} from "@/server/actions/qualiopi/devis-delai-client";

export interface DevisDelaiClientProps {
  devisId: string;
  numero: string;
  /** Délai en cours : `JJ/MM/AAAA` du jour choisi ; `null` s'il n'y en a pas. */
  delaiJusquAuLisible: string | null;
  /** Bornes du choix de date (`AAAA-MM-JJ`), ou `null` si la validité se termine aujourd'hui. */
  bornes: { min: string; max: string; defaut: string } | null;
}

/** `JJ/MM/AAAA` → `AAAA-MM-JJ`. */
function versIso(lisible: string): string {
  const [d, m, y] = lisible.split("/");
  return `${y}-${m}-${d}`;
}

export function DevisDelaiClient({
  devisId,
  numero,
  delaiJusquAuLisible,
  bornes,
}: DevisDelaiClientProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [jour, setJour] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  function ouvrir() {
    setError(null);
    setSucces(null);
    if (bornes) {
      const actuel = delaiJusquAuLisible ? versIso(delaiJusquAuLisible) : null;
      setJour(
        actuel !== null && actuel >= bornes.min && actuel <= bornes.max ? actuel : bornes.defaut,
      );
    }
    setOuvert(true);
  }

  function enregistrer() {
    setError(null);
    setSucces(null);
    startTransition(async () => {
      const r = await demanderDelaiClientAction({ devisId, jour });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setOuvert(false);
      setSucces(
        `Délai enregistré : pas de rappel pour ce devis avant le ${r.data.jourLisible}. Rien n'a été envoyé au client.`,
      );
      router.refresh();
    });
  }

  function lever() {
    setError(null);
    setSucces(null);
    startTransition(async () => {
      const r = await leverDelaiClientAction({ devisId });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setOuvert(false);
      setSucces(
        "Délai levé : ce devis peut de nouveau être signalé « À relancer ». Les alertes reviendront au prochain passage du matin s'il y a lieu.",
      );
      router.refresh();
    });
  }

  const note = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";

  return (
    <div
      data-devis-numero={numero}
      className="flex flex-wrap items-center gap-[var(--space-admin-3)]"
    >
      {delaiJusquAuLisible === null && bornes === null && (
        <p className={note}>
          La validité de ce devis se termine aujourd&apos;hui : prolongez-la d&apos;abord pour
          accorder un délai.
        </p>
      )}

      {delaiJusquAuLisible !== null && (
        <>
          <p data-testid="delai-client-actif" className={note}>
            Le client a demandé un délai : pas de rappel avant le {delaiJusquAuLisible}.
          </p>
          {!ouvert && bornes && (
            <button
              type="button"
              onClick={ouvrir}
              disabled={isPending}
              className="admin-button-secondary"
            >
              Changer la date…
            </button>
          )}
          <button
            type="button"
            onClick={lever}
            disabled={isPending}
            className="admin-button-secondary"
          >
            Lever le délai
          </button>
        </>
      )}

      {delaiJusquAuLisible === null && bornes && !ouvert && (
        <button
          type="button"
          onClick={ouvrir}
          disabled={isPending}
          className="admin-button-secondary"
        >
          Le client demande un délai…
        </button>
      )}

      {ouvert && bornes && (
        <div
          data-testid="zone-delai-client"
          className="flex basis-full flex-wrap items-end gap-[var(--space-admin-3)]"
        >
          <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
            <span>Ne pas relancer avant le</span>
            <input
              type="date"
              name="jourDelai"
              value={jour}
              min={bornes.min}
              max={bornes.max}
              onChange={(e) => setJour(e.target.value)}
              disabled={isPending}
              className="admin-input"
            />
          </label>
          <button
            type="button"
            onClick={enregistrer}
            disabled={isPending || jour === ""}
            className="admin-button"
          >
            Enregistrer le délai
          </button>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            disabled={isPending}
            className="admin-button-secondary"
          >
            Annuler
          </button>
          <p className="basis-full text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Jusqu&apos;à cette date, ce devis n&apos;est plus signalé « À relancer » : ni pastille,
            ni rappel, ni alerte. Rien n&apos;est envoyé au client.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="basis-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {succes && (
        <p role="status" className={`basis-full ${note}`}>
          {succes}
        </p>
      )}
    </div>
  );
}
