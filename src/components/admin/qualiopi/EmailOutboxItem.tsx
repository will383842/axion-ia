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
import { libelleTemplateEmail } from "@/server/email/outbox-policy";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";

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
  /** Vrai si le gabarit lit le message personnalisé (liste : `outbox-policy.ts`). */
  accepteMessagePersonnalise: boolean;
  approuverAction: (input: {
    id: string;
    sujet?: string;
    messagePersonnalise?: string;
  }) => Promise<ActionResult<{ id: string; envoye: boolean }>>;
  refuserAction: (input: {
    id: string;
    motif: string;
  }) => Promise<ActionResult<{ id: string; jetonsRevoques?: number }>>;
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
  accepteMessagePersonnalise,
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

  // Champs de 44 px, recopiés de l'assistant devis (pas d'import croisé entre composants).
  const champ =
    "min-h-[44px] w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-3 py-2 text-[length:var(--text-admin-base)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] focus-visible:outline-none";
  const bouton =
    "min-h-[44px] rounded-[var(--radius-admin-md)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold disabled:opacity-50";

  function approuver() {
    setErreur(null);
    startTransition(async () => {
      const r = await approuverAction({
        id,
        ...(sujet.trim() !== sujetInitial ? { sujet: sujet.trim() } : {}),
        ...(accepteMessagePersonnalise && message.trim() !== ""
          ? { messagePersonnalise: message.trim() }
          : {}),
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

  const lignes = apercu.filter((l) => l.label !== "Attention");
  const attention = apercu.find((l) => l.label === "Attention");

  return (
    <AdminCard as="article" className="flex flex-col gap-[var(--space-admin-3)]">
      <header className="flex flex-col gap-[var(--space-admin-2)]">
        <h3 className="m-0 text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          {sujetInitial}
        </h3>
        <p className="m-0 flex flex-wrap gap-[var(--space-admin-2)]">
          <AdminBadge tone="info">{libelleTemplateEmail(template)}</AdminBadge>
          {clientNom ? <AdminBadge tone="neutral">{clientNom}</AdminBadge> : null}
          <AdminBadge tone="outline">En attente depuis le {creeLe}</AdminBadge>
          {nbPiecesJointes > 0 && (
            <AdminBadge tone="outline">
              {nbPiecesJointes} pièce{nbPiecesJointes > 1 ? "s" : ""} jointe
              {nbPiecesJointes > 1 ? "s" : ""}
            </AdminBadge>
          )}
        </p>
        <p className="m-0 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Destinataire :{" "}
          <span className="font-semibold text-[color:var(--color-admin-fg)]">{destinataire}</span>
        </p>
      </header>

      {attention && (
        <p className="m-0 rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-warning-soft)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning-fg)]">
          <span className="font-semibold">Attention : </span>
          {attention.valeur}
        </p>
      )}

      {lignes.length > 0 && (
        <dl className="m-0 grid gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-3)] sm:grid-cols-2">
          {lignes.map((l) => (
            <div key={l.label}>
              <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {l.label}
              </dt>
              <dd className="m-0 text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)]">
                {l.valeur}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <label className="block">
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

      {accepteMessagePersonnalise && (
        <label className="block">
          <span className="mb-[var(--space-admin-1)] block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
            Message personnalisé (facultatif)
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
          <span className="mt-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Inséré dans le corps de l&apos;e-mail.
          </span>
        </label>
      )}

      {erreur && (
        <p
          role="alert"
          className="m-0 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
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
          <div className="flex flex-wrap gap-[var(--space-admin-2)]">
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
        <div className="flex flex-col gap-[var(--space-admin-3)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)] sm:flex-row sm:flex-wrap sm:items-center">
          {/* Lot 3 (2026-09-02) : cette case est l'unique garde-fou avant un
              envoi irréversible, et elle faisait ~13 px. 24 px pour la case,
              44 px de hauteur pour le libellé cliquable qui l'entoure. */}
          <label className="flex min-h-11 items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <input
              type="checkbox"
              className="h-6 w-6 shrink-0"
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
            className={`${bouton} border border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg)] sm:ml-auto`}
          >
            Refuser
          </button>
        </div>
      )}
    </AdminCard>
  );
}
