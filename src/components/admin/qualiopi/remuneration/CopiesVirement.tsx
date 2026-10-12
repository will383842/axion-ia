"use client";
// use-client: navigator.clipboard — « Copier l'IBAN », « Copier le montant », « Copier la référence ».

/**
 * Lot D (M9) — les trois copies d'une ligne de « Virements à faire ».
 *
 * L'IBAN n'est jamais dans la page : « Copier l'IBAN » le demande au serveur, qui
 * journalise l'affichage (sans l'IBAN). Si son empreinte n'est plus celle de la
 * page, le compte a changé : rien n'est copié, il faut recharger — c'est la même
 * empreinte que « Virements faits » renverra au clic.
 */

import { useState } from "react";

import { revelerIbanVirementAction } from "@/server/actions/qualiopi/virements-a-faire";

export function CopiesVirement({
  trainerId,
  empreinteAffichee,
  montant,
  reference,
}: {
  readonly trainerId: string | null;
  readonly empreinteAffichee: string | null;
  /** Montant à virer, déjà mis en texte (« 770,00 »). */
  readonly montant: string;
  readonly reference: string | null;
}): React.ReactElement {
  const [message, setMessage] = useState<string | null>(null);

  async function copier(texte: string, libelle: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texte);
      setMessage(`${libelle} copié`);
    } catch {
      setMessage(`Copie impossible : ${texte}`);
    }
  }

  async function copierIban(): Promise<void> {
    if (trainerId === null) return;
    const r = await revelerIbanVirementAction(trainerId);
    if ("error" in r) {
      setMessage(r.error);
      return;
    }
    if (empreinteAffichee !== null && r.data.empreinte !== empreinteAffichee) {
      setMessage("Le compte bancaire a changé : rechargez la page avant de virer.");
      return;
    }
    await copier(r.data.iban, "IBAN");
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      {trainerId !== null && empreinteAffichee !== null && (
        <button type="button" className="admin-button-ghost" onClick={copierIban}>
          Copier l&apos;IBAN
        </button>
      )}
      <button
        type="button"
        className="admin-button-ghost"
        onClick={() => copier(montant, "Montant")}
      >
        Copier le montant
      </button>
      {reference !== null && (
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => copier(reference, "Référence")}
        >
          Copier la référence
        </button>
      )}
      <span aria-live="polite" className="admin-muted">
        {message ?? ""}
      </span>
    </div>
  );
}
