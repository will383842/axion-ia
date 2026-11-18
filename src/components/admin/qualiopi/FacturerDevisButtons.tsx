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
import type { PalierSuivant } from "@/server/qualiopi/devis/palier-suivant";

export function FacturerDevisButtons({
  devisId,
  dejaFactureHtCents,
  totalDevisHtCents,
  palierSuivant,
  palierIndisponible,
}: {
  devisId: string;
  dejaFactureHtCents: number;
  totalDevisHtCents: number;
  /** Devis à formules : palier d'échéancier suivant (acompte pré-rempli et verrouillé). */
  palierSuivant?: PalierSuivant;
  /** Devis à formules dont l'échéancier ne se lit pas : l'acompte est refusé côté serveur. */
  palierIndisponible?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [acomptePercent, setAcomptePercent] = useState(
    palierSuivant !== undefined && !palierSuivant.estSolde ? palierSuivant.pourcentage : 30,
  );
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
        `Facture ${res.data.numero} émise.${res.data.chorusProRequis ? " Attention : client secteur public : dépôt Chorus Pro OBLIGATOIRE." : ""}`,
      );
      router.refresh();
    });
  };

  const restant = totalDevisHtCents - dejaFactureHtCents;

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Facturation
      </p>
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Déjà facturé : {fmt(dejaFactureHtCents)} HT · Restant : {fmt(restant)} HT
      </p>
      {palierSuivant !== undefined && (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          Échéancier du devis · palier {palierSuivant.rang}/{palierSuivant.nbPaliers} —{" "}
          {palierSuivant.libelle} · {palierSuivant.pourcentage} % ·{" "}
          {fmt(palierSuivant.montantHtCents)} HT
          {palierSuivant.estSolde ? " (solde : acomptes déduits)" : ""}
        </p>
      )}
      {palierIndisponible !== undefined && (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          Échéancier illisible : {palierIndisponible}
        </p>
      )}
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
            readOnly={palierSuivant !== undefined}
            onChange={(e) => setAcomptePercent(Number.parseInt(e.target.value, 10) || 30)}
            className="w-16 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)]"
          />
          %
        </label>
        <button
          type="button"
          className="admin-button"
          disabled={
            isPending ||
            restant <= 0 ||
            palierIndisponible !== undefined ||
            palierSuivant?.estSolde === true
          }
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
