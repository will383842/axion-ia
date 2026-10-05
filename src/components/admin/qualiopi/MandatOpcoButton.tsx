"use client";
// use-client: bouton interactif (choix du client mandant, génération, lien émis) en état local, chargé à part par DocumentsSection.

/**
 * Bouton « Générer le mandat OPCO » (INT-T66-A), extrait de `DocumentsSection`
 * pour être chargé à la demande (`next/dynamic`) : il ne sert qu'aux sessions
 * financées par un OPCO, et la page des sessions reste sous son cliquet de poids.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  genererMandatOpcoAction,
  listerClientsMandatOpcoAction,
} from "@/server/actions/qualiopi/documents";
import {
  useMotifRectification,
  type PieceProduite,
} from "@/components/admin/qualiopi/DocumentsSection";

/**
 * « Générer le mandat OPCO » — rendu à côté des conventions, et SEULEMENT
 * quand la session est financée par un OPCO (ou en mixte) : ailleurs le
 * mandat n'a pas d'objet, et le bouton n'est pas replié mais absent.
 *
 * Le mandat se rattache à UN client. L'écran ne connaît que la session : la
 * liste des mandants est lue au premier clic ; un seul client → génération
 * directe, plusieurs (inter-entreprises) → choix, puis génération.
 *
 * Le résultat dit comment le lien part : dans l'envoi d'une convention en
 * circuit (nommée), ou seul — et pourquoi il n'est pas parti quand il ne l'est
 * pas.
 */
export function MandatOpcoButton({
  sessionId,
  onDone,
  dejaGenereLe,
}: {
  sessionId: string;
  onDone: (piece: PieceProduite) => void;
  /** Cf. SessionDocButton. */
  dejaGenereLe?: string | undefined;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lien, setLien] = useState<string | null>(null);
  const [clients, setClients] = useState<Array<{
    clientId: string;
    raisonSociale: string;
  }> | null>(null);
  const [clientId, setClientId] = useState("");
  const rect = useMotifRectification(dejaGenereLe);
  const label = "Générer le mandat OPCO";

  function generer(pour: string) {
    startTransition(async () => {
      const result = await genererMandatOpcoAction({
        sessionId,
        clientId: pour,
        ...rect.argument,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const { numero, documentId, envoi } = result.data;
      const suite =
        envoi.mode === "avec_convention"
          ? `Lien émis à ${envoi.destinataire}, dans l'envoi de la convention n° ${envoi.conventionNumero} (même échéance) : joignez-le à cet envoi.`
          : envoi.mode === "seul"
            ? `Aucune convention de ce client n'est en circuit de signature : le mandat part SEUL. Lien émis à ${envoi.destinataire}.`
            : envoi.motif;
      setSuccess(`Mandat OPCO — n° ${numero} généré. ${suite}`);
      setLien(envoi.mode === "non_emis" ? null : envoi.url);
      onDone({ libelle: "Mandat OPCO", numero, documentId });
      rect.fermer();
      router.refresh();
    });
  }

  function handleClick() {
    if (rect.requis && !rect.ouvert) {
      rect.ouvrir();
      return;
    }
    setError(null);
    setSuccess(null);
    setLien(null);
    if (clients !== null) {
      if (clientId === "") {
        setError("Choisissez le client mandant.");
        return;
      }
      generer(clientId);
      return;
    }
    startTransition(async () => {
      const res = await listerClientsMandatOpcoAction({ sessionId });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      if (res.data.length === 0) {
        setError("Aucun client n'est rattaché à cette session : le mandat n'a pas de mandant.");
        return;
      }
      const [seul] = res.data;
      if (res.data.length === 1 && seul !== undefined) {
        generer(seul.clientId);
        return;
      }
      setClients(res.data);
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      {clients !== null && clients.length > 1 && (
        <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          <span>Client mandant</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={isPending}
            className="admin-input"
          >
            <option value="">— Choisir —</option>
            {clients.map((c) => (
              <option key={c.clientId} value={c.clientId}>
                {c.raisonSociale}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || (rect.ouvert && !rect.valide)}
        className={dejaGenereLe ? "admin-button-ghost" : "admin-button"}
        aria-label={
          dejaGenereLe ? `Régénérer : Mandat OPCO (dernière génération le ${dejaGenereLe})` : label
        }
      >
        {isPending
          ? "Génération…"
          : rect.ouvert
            ? "Rectifier : Mandat OPCO"
            : dejaGenereLe
              ? `Mandat OPCO · génération du ${dejaGenereLe} — régénérer`
              : label}
      </button>
      {rect.champ("Mandat OPCO")}
      {rect.ouvert && (
        <button type="button" onClick={rect.fermer} className="admin-button-ghost self-start">
          Annuler
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
      {lien !== null && (
        <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          <span>Lien de signature du mandat — personnel, il vaut signature</span>
          <input
            type="text"
            readOnly
            value={lien}
            onFocus={(e) => e.currentTarget.select()}
            className="admin-input"
          />
        </label>
      )}
    </div>
  );
}
