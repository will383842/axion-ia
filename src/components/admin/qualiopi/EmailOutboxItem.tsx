"use client";
// use-client: édition du sujet/message + approbation/refus via useTransition + Server Actions.
/**
 * EmailOutboxItem — un email en attente de validation (F60).
 *
 * Approuver ENVOIE réellement, et un email parti ne se rappelle pas. D'où :
 *   - une confirmation explicite avant l'envoi, jamais un simple clic ;
 *   - un motif OBLIGATOIRE pour refuser — un refus sans raison est
 *     indistinguable d'un oubli six mois plus tard, et c'est précisément ce
 *     qu'un auditeur demanderait sur une relance non envoyée ;
 *   - le bouton désactivé pendant la transition, pour qu'un double-clic
 *     n'envoie pas deux fois (le verrou serveur couvre le reste).
 *
 * Le sujet et le bloc de texte libre sont modifiables ; la mise en page, les
 * mentions légales et les pièces jointes ne le sont pas — c'est ce qui garantit
 * qu'un email conforme le reste.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ActionResult<T> = { data: T } | { error: string };

export interface EmailOutboxItemProps {
  id: string;
  template: string;
  destinataire: string;
  sujet: string;
  clientNom: string | null;
  creeLe: string;
  /** Résumé lisible de la charge utile, rendu côté serveur. */
  apercu: readonly { label: string; valeur: string }[];
  nbPiecesJointes: number;
  approuverAction: (input: {
    id: string;
    sujet?: string;
    messagePersonnalise?: string;
  }) => Promise<ActionResult<{ id: string; envoye: boolean }>>;
  refuserAction: (input: { id: string; motif: string }) => Promise<ActionResult<{ id: string }>>;
}

export function EmailOutboxItem({
  id,
  template,
  destinataire,
  sujet: sujetInitial,
  clientNom,
  creeLe,
  apercu,
  nbPiecesJointes,
  approuverAction,
  refuserAction,
}: EmailOutboxItemProps): React.ReactElement {
  const router = useRouter();
  const [sujet, setSujet] = useState(sujetInitial);
  const [message, setMessage] = useState("");
  const [motifRefus, setMotifRefus] = useState("");
  const [modeRefus, setModeRefus] = useState(false);
  const [confirmeEnvoi, setConfirmeEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const champ =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const bouton =
    "rounded-[var(--radius-admin-sm)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold disabled:opacity-50";

  function approuver() {
    setErreur(null);
    startTransition(async () => {
      const r = await approuverAction({
        id,
        ...(sujet.trim() !== sujetInitial ? { sujet: sujet.trim() } : {}),
        ...(message.trim() !== "" ? { messagePersonnalise: message.trim() } : {}),
      });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      if (!r.data.envoye) {
        setErreur("Approuvé, mais la mise en file a échoué — l'email n'est pas parti.");
        return;
      }
      router.refresh();
    });
  }

  function refuser() {
    setErreur(null);
    if (motifRefus.trim() === "") {
      setErreur("Indiquez pourquoi cet email ne doit pas partir.");
      return;
    }
    startTransition(async () => {
      const r = await refuserAction({ id, motif: motifRefus.trim() });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] p-[var(--space-admin-4)]">
      <header className="mb-[var(--space-admin-3)] flex flex-wrap items-baseline justify-between gap-[var(--space-admin-2)]">
        <div>
          <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
            {destinataire}
            {clientNom ? (
              <span className="font-normal text-[color:var(--color-admin-fg-muted)]">
                {" "}
                · {clientNom}
              </span>
            ) : null}
          </p>
          <p className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {template} · en attente depuis le {creeLe}
          </p>
        </div>
        {nbPiecesJointes > 0 && (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {nbPiecesJointes} pièce(s) jointe(s) — non modifiables
          </span>
        )}
      </header>

      <label className="mb-[var(--space-admin-3)] block">
        <span className="mb-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]">
          Objet
        </span>
        <input
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          disabled={isPending}
          maxLength={300}
          className={champ}
        />
      </label>

      {apercu.length > 0 && (
        <dl className="mb-[var(--space-admin-3)] grid gap-[var(--space-admin-1)] rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-3)] sm:grid-cols-2">
          {apercu.map((l) => (
            <div key={l.label} className="text-[length:var(--text-admin-xs)]">
              <dt className="inline text-[color:var(--color-admin-fg-muted)]">{l.label} : </dt>
              <dd className="inline text-[color:var(--color-admin-fg)]">{l.valeur}</dd>
            </div>
          ))}
        </dl>
      )}

      <label className="mb-[var(--space-admin-3)] block">
        <span className="mb-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]">
          Message personnalisé (facultatif) — inséré dans le corps de l&apos;email
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isPending}
          rows={3}
          maxLength={4000}
          placeholder="Ex. : « Comme convenu par téléphone, un règlement au 15 du mois nous convient. »"
          className={champ}
        />
      </label>

      {erreur && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </p>
      )}

      {modeRefus ? (
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <textarea
            value={motifRefus}
            onChange={(e) => setMotifRefus(e.target.value)}
            disabled={isPending}
            rows={2}
            maxLength={1000}
            placeholder="Pourquoi cet email ne doit-il pas partir ?"
            aria-label="Motif du refus"
            className={champ}
          />
          <div className="flex gap-[var(--space-admin-2)]">
            <button
              type="button"
              onClick={refuser}
              disabled={isPending}
              className={`${bouton} bg-[color:var(--color-admin-error)] text-white`}
            >
              {isPending ? "…" : "Confirmer le refus"}
            </button>
            <button
              type="button"
              onClick={() => setModeRefus(false)}
              disabled={isPending}
              className={`${bouton} border border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg)]`}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
          <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <input
              type="checkbox"
              checked={confirmeEnvoi}
              onChange={(e) => setConfirmeEnvoi(e.target.checked)}
              disabled={isPending}
            />
            J&apos;ai relu — envoyer à {destinataire}
          </label>
          <button
            type="button"
            onClick={approuver}
            disabled={isPending || !confirmeEnvoi}
            className={`${bouton} bg-[color:var(--color-admin-accent)] text-white`}
          >
            {isPending ? "Envoi…" : "Approuver et envoyer"}
          </button>
          <button
            type="button"
            onClick={() => setModeRefus(true)}
            disabled={isPending}
            className={`${bouton} border border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg)]`}
          >
            Refuser
          </button>
        </div>
      )}
    </article>
  );
}
