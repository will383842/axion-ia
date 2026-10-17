"use client";
// use-client: formulaires du recueil du besoin (envoi, rattachement, validation, dérogation motivée) — useTransition + router.refresh().

/**
 * RecueilBesoinActions — gestes de la console pour le recueil du besoin (L03).
 * Zéro appel DB côté client : tout passe par les actions serveur.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  accorderDerogationAction,
  lancerRecueilAction,
  rattacherProjetAction,
  validerAnalyseAction,
} from "@/server/actions/qualiopi/recueil";

interface Props {
  readonly sessionId: string;
  readonly questionnaireId: string | null;
  readonly projetsCandidats: ReadonlyArray<{ readonly id: string; readonly titre: string }>;
  readonly peutEnvoyer: boolean;
  readonly peutValider: boolean;
  readonly peutRattacher: boolean;
  readonly peutDeroger: boolean;
}

export function RecueilBesoinActions(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [projetId, setProjetId] = useState(p.projetsCandidats[0]?.id ?? "");
  const [motif, setMotif] = useState("");

  function lancer(f: () => Promise<{ data: { message?: string } } | { error: string }>) {
    start(async () => {
      const r = await f();
      if ("error" in r) setMessage({ ton: "erreur", texte: r.error });
      else {
        setMessage({ ton: "ok", texte: r.data.message ?? "Fait." });
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      {message !== null && (
        <p
          role={message.ton === "erreur" ? "alert" : "status"}
          className={`admin-alert ${message.ton === "erreur" ? "admin-alert-error" : "admin-alert-success"}`}
        >
          {message.texte}
        </p>
      )}

      {p.peutRattacher && (
        <div className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
          <label className="text-[length:var(--text-admin-sm)]">
            Projet du client
            <select
              className="admin-input ml-[var(--space-admin-2)]"
              value={projetId}
              onChange={(e) => setProjetId(e.target.value)}
            >
              {p.projetsCandidats.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.titre}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={pending || projetId === ""}
            onClick={() =>
              lancer(() => rattacherProjetAction({ sessionId: p.sessionId, projetId }))
            }
          >
            Rattacher la session à ce projet
          </button>
        </div>
      )}

      {p.peutEnvoyer && (
        <div>
          <button
            type="button"
            className="admin-button"
            disabled={pending}
            onClick={() => lancer(() => lancerRecueilAction(p.sessionId))}
          >
            Envoyer le questionnaire à l&apos;entreprise
          </button>
        </div>
      )}

      {p.peutValider && p.questionnaireId !== null && (
        <div>
          <button
            type="button"
            className="admin-button"
            disabled={pending}
            onClick={() =>
              lancer(async () => {
                const r = await validerAnalyseAction({
                  sessionId: p.sessionId,
                  questionnaireId: p.questionnaireId as string,
                });
                return "error" in r
                  ? r
                  : { data: { message: "Analyse validée, date enregistrée." } };
              })
            }
          >
            Valider l&apos;analyse du besoin
          </button>
        </div>
      )}

      {p.peutDeroger && (
        <details className="admin-muted">
          <summary className="cursor-pointer text-[length:var(--text-admin-sm)]">
            Dérogation motivée (envoyer la convention sans le cadrage ou le devis)
          </summary>
          <div className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]">
            <label className="text-[length:var(--text-admin-sm)]" htmlFor="motif-derogation">
              Pourquoi ? Ce motif est journalisé avec votre nom et la date, et reste affiché en
              rouge.
            </label>
            <textarea
              id="motif-derogation"
              className="admin-input"
              rows={3}
              maxLength={1000}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
            />
            <div>
              <button
                type="button"
                className="admin-button-danger"
                disabled={pending || motif.trim().length < 20}
                onClick={() =>
                  lancer(() => accorderDerogationAction({ sessionId: p.sessionId, motif }))
                }
              >
                Accorder la dérogation
              </button>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
