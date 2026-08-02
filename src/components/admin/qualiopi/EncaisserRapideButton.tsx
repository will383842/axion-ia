"use client";
// use-client: mini-formulaire inline (état local) + appel Server Action + refresh.

/**
 * « Encaisser » — action rapide sur une ligne du hub Facturation.
 *
 * Réutilise `enregistrerPaiementFactureAction` TELLE QUELLE (transaction
 * complète : Payment + statut + dossier de financement). Le détail de la
 * facture garde son panneau complet (`FactureFormationActions`) ; ici on ne
 * fait que raccourcir le chemin du cas courant — le virement reçu qui solde la
 * facture — sans quitter la liste.
 *
 * ⚠️ Modes proposés en SAISIE : virement et espèces uniquement — pas de chèque
 * (décision Will du 2026-07-30). Le libellé « Chèque » reste en LECTURE sur les
 * paiements historiques qui en portent un.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enregistrerPaiementFactureAction } from "@/server/actions/qualiopi/facturation-hub";
import { AdminButton } from "@/components/admin/ui/AdminButton";

const MODES: ReadonlyArray<{ value: "manual_wire" | "manual_cash"; label: string }> = [
  { value: "manual_wire", label: "Virement" },
  { value: "manual_cash", label: "Espèces" },
];

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Date du jour au format input[type=date] (YYYY-MM-DD), en LOCAL — pas UTC. */
function todayInput(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Euros saisis → centimes, sans arithmétique flottante hasardeuse : le format
 * est VALIDÉ (2 décimales max) avant `Math.round(parseFloat × 100)`, qui est
 * alors exact. « 1 234,56 », « 1234.56 » et « 1234 » passent ; « 12.345 » non.
 */
function eurosEnCents(saisie: string): number | null {
  const normalise = saisie.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalise)) return null;
  const n = Number.parseFloat(normalise);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function EncaisserRapideButton({
  factureId,
  resteDuCents,
}: {
  factureId: string;
  /** Reste dû NET en centimes (TTC + avoirs − encaissés), pré-calculé serveur. */
  resteDuCents: number;
}): React.ReactElement {
  const router = useRouter();
  const idBase = useId();
  const [enCours, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [montantEur, setMontantEur] = useState<string>(
    (Math.max(resteDuCents, 0) / 100).toFixed(2),
  );
  const [paidAt, setPaidAt] = useState<string>(todayInput());
  const [mode, setMode] = useState<"manual_wire" | "manual_cash">("manual_wire");
  const [reference, setReference] = useState<string>("");

  function confirmer() {
    setErreur(null);
    const cents = eurosEnCents(montantEur);
    if (cents === null || cents <= 0) {
      setErreur("Montant invalide (ex. 1234,56).");
      return;
    }
    if (paidAt === "") {
      setErreur("Indiquez la date d'encaissement.");
      return;
    }
    startTransition(async () => {
      const res = await enregistrerPaiementFactureAction({
        factureId,
        montantCents: cents,
        paidAt,
        mode,
        ...(reference.trim() !== "" ? { reference: reference.trim() } : {}),
      });
      if ("error" in res) {
        setErreur(res.error);
        return;
      }
      setSucces(
        res.data.statut === "payee"
          ? "Encaissé — facture soldée"
          : `Encaissé — reste dû ${eur(res.data.resteACents)}`,
      );
      setOuvert(false);
      router.refresh();
    });
  }

  if (succes !== null) {
    return (
      <span
        role="status"
        className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
      >
        {succes}
      </span>
    );
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg)]";
  const inputCls =
    "mt-1 block w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <div className="flex flex-col items-start gap-[var(--space-admin-2)]">
      <AdminButton
        variant="secondary"
        size="sm"
        disabled={enCours}
        onClick={() => {
          setErreur(null);
          setOuvert((o) => !o);
        }}
        aria-expanded={ouvert}
      >
        Encaisser
      </AdminButton>

      {ouvert && (
        <div className="min-w-56 space-y-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-3)] text-left">
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Reste dû : <span className="font-medium tabular-nums">{eur(resteDuCents)}</span>
          </p>
          <div>
            <label htmlFor={`${idBase}-montant`} className={labelCls}>
              Montant (€)
            </label>
            <input
              id={`${idBase}-montant`}
              type="text"
              inputMode="decimal"
              value={montantEur}
              onChange={(e) => setMontantEur(e.target.value)}
              disabled={enCours}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`${idBase}-date`} className={labelCls}>
              Date
            </label>
            <input
              id={`${idBase}-date`}
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              disabled={enCours}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`${idBase}-mode`} className={labelCls}>
              Mode
            </label>
            <select
              id={`${idBase}-mode`}
              value={mode}
              onChange={(e) => setMode(e.target.value as "manual_wire" | "manual_cash")}
              disabled={enCours}
              className={inputCls}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idBase}-ref`} className={labelCls}>
              Référence (optionnel)
            </label>
            <input
              id={`${idBase}-ref`}
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={enCours}
              className={inputCls}
              placeholder="Référence du virement"
            />
          </div>
          <AdminButton variant="primary" size="sm" loading={enCours} onClick={confirmer}>
            Confirmer l&apos;encaissement
          </AdminButton>
        </div>
      )}

      {erreur !== null && (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </span>
      )}
    </div>
  );
}
