"use client";
// use-client: bouton « Chercher le SIREN » qui interroge l'annuaire public puis attend une confirmation d'un clic.

/**
 * SIREN PROPOSÉ par l'annuaire public, CONFIRMÉ d'un clic (chantier visio,
 * plan §3.17 point 4). Rien n'est écrit sans ce clic.
 *
 * Deux usages :
 *   · dans le formulaire de création : le clic REMPLIT le champ SIREN ;
 *   · sur une fiche « SIREN à compléter » : le clic ENREGISTRE le SIREN
 *     (`updateClientAction`, qui le compare au SIRET s'il y en a un).
 *
 * Annuaire en panne ou trop lent (3 s) : un message, et la saisie à la main
 * reste possible. La fiche, elle, n'attend jamais l'annuaire.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { rechercherSirenAction } from "@/features/dossier-client/actions";
import type { PropositionSiren } from "@/features/dossier-client/recherche-entreprises";
import { updateClientAction } from "@/server/actions/qualiopi/clients";

export type SirenAnnuaireProps =
  | {
      readonly nom: string;
      readonly ville: string | null;
      readonly onChoisir: (siren: string) => void;
      readonly clientId?: undefined;
    }
  | {
      readonly nom: string;
      readonly ville: string | null;
      readonly clientId: string;
      readonly onChoisir?: undefined;
    };

export function SirenAnnuaire(props: SirenAnnuaireProps): React.ReactElement {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [propositions, setPropositions] = useState<PropositionSiren[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function chercher(): void {
    setMessage(null);
    startTransition(async () => {
      const r = await rechercherSirenAction(props.nom, props.ville);
      if (!r.ok) {
        setPropositions(null);
        setMessage(
          r.motif === "saisie_insuffisante"
            ? "Saisissez d'abord le nom de l'entreprise."
            : "L'annuaire des entreprises ne répond pas pour l'instant. Saisissez le SIREN à la main, ou réessayez plus tard.",
        );
        return;
      }
      setPropositions([...r.propositions]);
      if (r.propositions.length === 0) setMessage("Aucune entreprise trouvée à ce nom.");
    });
  }

  function choisir(p: PropositionSiren): void {
    if (props.onChoisir) {
      props.onChoisir(p.siren);
      setPropositions(null);
      setMessage(`SIREN ${p.siren} repris (${p.nom}).`);
      return;
    }
    const clientId = props.clientId;
    startTransition(async () => {
      const r = await updateClientAction({ id: clientId, siren: p.siren });
      if ("error" in r) {
        setMessage(r.error);
        return;
      }
      setPropositions(null);
      setMessage(`SIREN ${p.siren} enregistré.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <div>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={chercher}
          disabled={enCours || props.nom.trim().length < 2}
        >
          {enCours ? "Recherche…" : "Chercher le SIREN dans l'annuaire"}
        </button>
      </div>
      {propositions !== null && propositions.length > 0 ? (
        <ul className="space-y-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
          {propositions.map((p) => (
            <li key={p.siren} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
              <span className="font-mono">{p.siren}</span>
              <span>{p.nom}</span>
              <span className="text-[color:var(--color-admin-fg-muted)]">
                {[p.codePostal, p.ville].filter(Boolean).join(" ")}
              </span>
              <button
                type="button"
                className="admin-button-ghost"
                onClick={() => choisir(p)}
                disabled={enCours}
              >
                C&apos;est elle
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {message !== null ? (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
