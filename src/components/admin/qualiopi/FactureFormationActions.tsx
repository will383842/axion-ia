"use client";
// use-client: actions unitaires d'une facture (paiement / avoir / envoi email / émission brouillon) — panneaux repliables, useTransition + router.refresh().

/**
 * FactureFormationActions — Actions du cycle de vie d'une facture du Hub.
 *
 * Panneaux repliables selon le statut :
 *   - brouillon : « Émettre » (emettreFactureBrouillonAction) — fige numéro/TVA/PDF.
 *   - émise / partiellement payée / en retard : « Marquer payé »
 *     (enregistrerPaiementFactureAction, partiel accepté), « Envoyer par email »
 *     (envoyerFactureEmailAction), « Émettre un avoir » (genererAvoirAction).
 *   - payée : « Envoyer par email », « Émettre un avoir ».
 *   - annulée / avoir : aucune action.
 *
 * Rien d'automatique : chaque action = un clic admin. router.refresh() au succès.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  enregistrerPaiementFactureAction,
  genererAvoirAction,
  emettreFactureBrouillonAction,
} from "@/server/actions/qualiopi/facturation-hub";
import { envoyerFactureEmailAction } from "@/server/actions/qualiopi/facturation-emails";

type FactureStatut =
  | "brouillon"
  | "emise"
  | "partiellement_payee"
  | "en_retard"
  | "payee"
  | "annulee";

export interface FactureFormationActionsProps {
  factureId: string;
  statut: FactureStatut;
  /** Reste dû NET en centimes (TTC + avoirs − encaissements). Défaut du paiement. */
  resteDuCents: number;
  /** Montant HT en centimes (borne d'un avoir partiel). */
  montantHtCents: number;
  /** True si cette facture est déjà un avoir (aucune action). */
  estAvoir: boolean;
  /** Email de contact du client (préremplit l'envoi ; peut être vide). */
  contactEmail: string | null;
  /** Le rôle courant peut-il écrire (admin/super_admin) ? Sinon lecture seule. */
  canWrite: boolean;
}

type Panel = "paiement" | "avoir" | "email" | null;

const MODES: Array<{ value: "manual_wire" | "manual_check" | "manual_cash"; label: string }> = [
  { value: "manual_wire", label: "Virement" },
  { value: "manual_check", label: "Chèque" },
  { value: "manual_cash", label: "Espèces" },
];

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Date du jour au format input[type=date] (YYYY-MM-DD), en local. */
function todayInput(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function FactureFormationActions({
  factureId,
  statut,
  resteDuCents,
  montantHtCents,
  estAvoir,
  contactEmail,
  canWrite,
}: FactureFormationActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Paiement
  const [montantEur, setMontantEur] = useState<string>(
    (Math.max(resteDuCents, 0) / 100).toFixed(2),
  );
  const [paidAt, setPaidAt] = useState<string>(todayInput());
  const [mode, setMode] = useState<"manual_wire" | "manual_check" | "manual_cash">("manual_wire");
  const [reference, setReference] = useState<string>("");

  // Avoir
  const [motif, setMotif] = useState<string>("");
  const [avoirPartiel, setAvoirPartiel] = useState<boolean>(false);
  const [avoirMontantEur, setAvoirMontantEur] = useState<string>((montantHtCents / 100).toFixed(2));

  // Email
  const [emailTo, setEmailTo] = useState<string>(contactEmail ?? "");
  const [emailMessage, setEmailMessage] = useState<string>("");

  function reset() {
    setError(null);
    setSuccess(null);
  }

  function togglePanel(p: Panel) {
    reset();
    setPanel((cur) => (cur === p ? null : p));
  }

  function eurToCents(v: string): number | null {
    const normalized = v.replace(/\s/g, "").replace(",", ".");
    const n = Number.parseFloat(normalized);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }

  function handlePaiement() {
    reset();
    const cents = eurToCents(montantEur);
    if (cents === null || cents <= 0) {
      setError("Montant invalide.");
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
        setError(res.error);
        return;
      }
      setSuccess(
        res.data.statut === "payee"
          ? "Paiement enregistré — facture soldée."
          : `Paiement enregistré — reste dû ${eur(res.data.resteACents)}.`,
      );
      setPanel(null);
      router.refresh();
    });
  }

  function handleAvoir() {
    reset();
    if (motif.trim().length < 5) {
      setError("Motif requis (5 caractères minimum).");
      return;
    }
    let montantPartielHtCents: number | undefined;
    if (avoirPartiel) {
      const cents = eurToCents(avoirMontantEur);
      if (cents === null || cents <= 0) {
        setError("Montant partiel invalide.");
        return;
      }
      montantPartielHtCents = cents;
    }
    startTransition(async () => {
      const res = await genererAvoirAction({
        factureId,
        motif: motif.trim(),
        ...(montantPartielHtCents !== undefined ? { montantPartielHtCents } : {}),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess(`Avoir ${res.data.numero} émis.`);
      setPanel(null);
      router.refresh();
    });
  }

  function handleEmail() {
    reset();
    startTransition(async () => {
      const res = await envoyerFactureEmailAction({
        factureId,
        ...(emailTo.trim() !== "" ? { to: emailTo.trim() } : {}),
        ...(emailMessage.trim() !== "" ? { messagePersonnalise: emailMessage.trim() } : {}),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess(`Facture envoyée à ${res.data.to}.`);
      setPanel(null);
      router.refresh();
    });
  }

  function handleEmettre() {
    reset();
    startTransition(async () => {
      const res = await emettreFactureBrouillonAction({ factureId });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess(`Facture ${res.data.numero} émise.`);
      router.refresh();
    });
  }

  if (!canWrite) {
    return (
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Lecture seule — les actions de facturation sont réservées aux administrateurs.
      </p>
    );
  }

  if (estAvoir || statut === "annulee") {
    return (
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Aucune action disponible ({estAvoir ? "avoir" : "facture annulée"}).
      </p>
    );
  }

  const estBrouillon = statut === "brouillon";
  const estOuverte =
    statut === "emise" || statut === "partiellement_payee" || statut === "en_retard";
  const peutAvoir = estOuverte || statut === "payee";
  const peutEnvoyer = estOuverte || statut === "payee";

  const labelCls =
    "block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const inputCls =
    "mt-1 block w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const panelCls =
    "mt-[var(--space-admin-3)] space-y-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]";

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        {estBrouillon && (
          <button
            type="button"
            onClick={handleEmettre}
            disabled={isPending}
            className="admin-button"
            aria-label="Émettre la facture (fige numéro, TVA et PDF)"
          >
            {isPending ? "…" : "Émettre la facture"}
          </button>
        )}
        {estOuverte && (
          <button
            type="button"
            onClick={() => togglePanel("paiement")}
            disabled={isPending}
            className="admin-button"
            aria-expanded={panel === "paiement"}
          >
            Marquer payé
          </button>
        )}
        {peutEnvoyer && (
          <button
            type="button"
            onClick={() => togglePanel("email")}
            disabled={isPending}
            className="admin-button"
            aria-expanded={panel === "email"}
          >
            Envoyer par email
          </button>
        )}
        {peutAvoir && (
          <button
            type="button"
            onClick={() => togglePanel("avoir")}
            disabled={isPending}
            className="admin-button-danger"
            aria-expanded={panel === "avoir"}
          >
            Émettre un avoir
          </button>
        )}
        {estBrouillon && (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Émettre la facture avant de pouvoir l&apos;encaisser ou l&apos;envoyer.
          </p>
        )}
      </div>

      {/* Panneau paiement */}
      {panel === "paiement" && (
        <div className={panelCls}>
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Reste dû : <span className="font-medium tabular-nums">{eur(resteDuCents)}</span>. Un
            paiement partiel est accepté.
          </p>
          <div className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2">
            <div>
              <label htmlFor="pay-montant" className={labelCls}>
                Montant (€)
              </label>
              <input
                id="pay-montant"
                type="text"
                inputMode="decimal"
                value={montantEur}
                onChange={(e) => setMontantEur(e.target.value)}
                disabled={isPending}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="pay-date" className={labelCls}>
                Date de paiement
              </label>
              <input
                id="pay-date"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                disabled={isPending}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="pay-mode" className={labelCls}>
                Mode
              </label>
              <select
                id="pay-mode"
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as "manual_wire" | "manual_check" | "manual_cash")
                }
                disabled={isPending}
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
              <label htmlFor="pay-ref" className={labelCls}>
                Référence (optionnel)
              </label>
              <input
                id="pay-ref"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={isPending}
                className={inputCls}
                placeholder="Référence du virement"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handlePaiement}
            disabled={isPending}
            className="admin-button"
          >
            {isPending ? "Enregistrement…" : "Enregistrer le paiement"}
          </button>
        </div>
      )}

      {/* Panneau avoir */}
      {panel === "avoir" && (
        <div className={panelCls}>
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Un avoir rectifie une facture émise (montants négatifs). Refusé sur les factures
            multi-taux de TVA.
          </p>
          <div>
            <label htmlFor="avoir-motif" className={labelCls}>
              Motif (5 caractères minimum)
            </label>
            <textarea
              id="avoir-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              disabled={isPending}
              rows={2}
              className={inputCls}
              placeholder="Erreur de facturation, geste commercial, annulation…"
            />
          </div>
          <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            <input
              type="checkbox"
              checked={avoirPartiel}
              onChange={(e) => setAvoirPartiel(e.target.checked)}
              disabled={isPending}
            />
            Avoir partiel (sinon avoir total)
          </label>
          {avoirPartiel && (
            <div>
              <label htmlFor="avoir-montant" className={labelCls}>
                Montant HT de l&apos;avoir (€)
              </label>
              <input
                id="avoir-montant"
                type="text"
                inputMode="decimal"
                value={avoirMontantEur}
                onChange={(e) => setAvoirMontantEur(e.target.value)}
                disabled={isPending}
                className={inputCls}
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleAvoir}
            disabled={isPending}
            className="admin-button-danger"
          >
            {isPending ? "Émission…" : "Émettre l'avoir"}
          </button>
        </div>
      )}

      {/* Panneau email */}
      {panel === "email" && (
        <div className={panelCls}>
          <div>
            <label htmlFor="email-to" className={labelCls}>
              Destinataire
            </label>
            <input
              id="email-to"
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              disabled={isPending}
              className={inputCls}
              placeholder="Email du client (défaut : contact CRM)"
            />
          </div>
          <div>
            <label htmlFor="email-msg" className={labelCls}>
              Message (optionnel)
            </label>
            <textarea
              id="email-msg"
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              disabled={isPending}
              rows={3}
              className={inputCls}
              placeholder="Message personnalisé ajouté à l'email (PDF joint automatiquement)."
            />
          </div>
          <button type="button" onClick={handleEmail} disabled={isPending} className="admin-button">
            {isPending ? "Envoi…" : "Envoyer la facture"}
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
    </div>
  );
}
