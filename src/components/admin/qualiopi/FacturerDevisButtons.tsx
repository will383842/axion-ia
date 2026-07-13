"use client";
// use-client: saisie du % d'acompte + boutons de facturation (useTransition + refresh)

/**
 * Facturation d'un devis accepté (Hub facturation) :
 *   - « Facturer un acompte de X % » → facture d'ACOMPTE (document séparé,
 *     obligatoire fiscalement quand un acompte est demandé à la commande) ;
 *   - « Facturer le solde / la totalité » → lignes du devis, acomptes déduits.
 * Rien d'automatique : chaque facture = un clic. L'alerte Chorus Pro remonte
 * si le client est du secteur public.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { genererFactureDepuisDevisAction } from "@/server/actions/qualiopi/facturation-hub";

export function FacturerDevisButtons({
  devisId,
  dejaFactureHtCents,
  totalDevisHtCents,
}: {
  devisId: string;
  dejaFactureHtCents: number;
  totalDevisHtCents: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [acomptePercent, setAcomptePercent] = useState(30);
  const [message, setMessage] = useState<string | null>(null);

  const fmt = (cents: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

  const facturer = (avecAcompte: boolean) => {
    setMessage(null);
    startTransition(async () => {
      const res = await genererFactureDepuisDevisAction({
        devisId,
        ...(avecAcompte ? { acomptePercent } : {}),
      });
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      setMessage(
        `Facture ${res.data.numero} émise.${res.data.chorusProRequis ? " ⚠️ Client secteur public : dépôt Chorus Pro OBLIGATOIRE." : ""}`,
      );
      router.refresh();
    });
  };

  const restant = totalDevisHtCents - dejaFactureHtCents;

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Facturation
      </p>
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Déjà facturé : {fmt(dejaFactureHtCents)} HT · Restant : {fmt(restant)} HT
      </p>
      {message !== null && (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">{message}</p>
      )}
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          Acompte
          <input
            type="number"
            min={1}
            max={90}
            value={acomptePercent}
            onChange={(e) => setAcomptePercent(Number.parseInt(e.target.value, 10) || 30)}
            className="w-16 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-1)]"
          />
          %
        </label>
        <button
          type="button"
          className="admin-button"
          disabled={isPending || restant <= 0}
          onClick={() => facturer(true)}
        >
          Facturer l&apos;acompte
        </button>
        <button
          type="button"
          className="admin-button"
          disabled={isPending || restant <= 0}
          onClick={() => facturer(false)}
        >
          {dejaFactureHtCents > 0 ? "Facturer le solde" : "Facturer la totalité"}
        </button>
      </div>
    </div>
  );
}
