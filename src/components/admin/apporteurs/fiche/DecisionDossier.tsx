"use client";
// use-client: choix de l'issue du dossier (état local, useTransition + Server Actions)

// Les trois issues d'un dossier signé : oui (contresigner), à compléter, non définitif.
// Toujours un aperçu de l'e-mail, puis une confirmation.

import { useState, useTransition } from "react";

import {
  apercuDecisionAction,
  appliquerDecisionAction,
} from "@/features/apporteurs-reseau/actions-apporteurs";
import type { Decision } from "@/features/apporteurs-reseau/verification";

import { ApercuEmail, MessageRetour, type EmailApercu } from "./ApercuEmail";

const LIBELLE: Record<Decision, { bouton: string; envoyer: string }> = {
  contresigner: { bouton: "Oui, contresigner", envoyer: "Contresigner et envoyer le contrat" },
  a_completer: { bouton: "À compléter", envoyer: "Envoyer la demande de complément" },
  refuser: { bouton: "Non, définitif", envoyer: "Envoyer le refus" },
};

export function DecisionDossier({ apporteurId }: { apporteurId: string }) {
  const [note, setNote] = useState("");
  const [choix, setChoix] = useState<Decision | null>(null);
  const [email, setEmail] = useState<EmailApercu | null>(null);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const preparer = (d: Decision) =>
    demarrer(async () => {
      setRetour(null);
      const r = await apercuDecisionAction({ apporteurId, decision: d, note });
      if (r.ok) {
        setChoix(d);
        setEmail(r.email);
      } else {
        setRetour(r);
      }
    });
  const confirmer = () =>
    demarrer(async () => {
      if (!choix) return;
      const r = await appliquerDecisionAction({ apporteurId, decision: choix, note });
      setRetour(r);
      if (r.ok) {
        setEmail(null);
        setChoix(null);
      }
    });

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Note pour l&apos;apporteur (facultative ; reprise dans l&apos;e-mail « à compléter » ou «
          non »)
        </span>
        <textarea
          className="admin-textarea min-h-[90px]"
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          disabled={enCours}
        />
      </label>
      {!email ? (
        <div className="flex flex-wrap gap-[var(--space-admin-2)]">
          <button
            type="button"
            className="admin-button"
            disabled={enCours}
            onClick={() => preparer("contresigner")}
          >
            {LIBELLE.contresigner.bouton}
          </button>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={enCours}
            onClick={() => preparer("a_completer")}
          >
            {LIBELLE.a_completer.bouton}
          </button>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={enCours}
            onClick={() => preparer("refuser")}
          >
            {LIBELLE.refuser.bouton}
          </button>
        </div>
      ) : (
        <ApercuEmail
          email={email}
          libelleEnvoyer={choix ? LIBELLE[choix].envoyer : "Envoyer"}
          occupe={enCours}
          onEnvoyer={confirmer}
          onAnnuler={() => {
            setEmail(null);
            setChoix(null);
          }}
        />
      )}
      <MessageRetour retour={retour} />
    </div>
  );
}
