"use client";
// use-client: bouton interactif (useState/useTransition) appelant la Server Action de facturation.

/**
 * Coaching 1-to-1 — panneau facturation (console admin).
 *
 * 2026-08-10 (décision Will) : issu de la scission de l'ancien `AfestPanel`.
 * Le 1-to-1 est une prestation de CONSEIL hors Qualiopi : les écrans de
 * cadrage AFEST, financement tiers (OPCO / CPF / France Travail) et
 * certification France Compétences ont disparu avec lui. Ne reste que la
 * facturation directe au client, et la liste des documents émis.
 */

import { useState, useTransition } from "react";
import { genererFactureCoachingAction } from "@/server/actions/qualiopi/coaching-facturation";

// Libellés des documents encore émis (facture) + valeurs héritées possibles en
// base sur d'anciens parcours — le fallback `d.type` couvre le reste.
const DOC_LABELS: Record<string, string> = {
  facture: "Facture",
};

export interface CoachingFacturationPanelProps {
  coachingContractId: string | null;
  revalidatePath: string;
  documents: ReadonlyArray<{ id: string; type: string; numero: string; pdfUrl: string | null }>;
}

export function CoachingFacturationPanel(props: CoachingFacturationPanelProps): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function genererFacture() {
    setMessage(null);
    startTransition(async () => {
      const res = await genererFactureCoachingAction({
        coachingContractId: props.coachingContractId as string,
        revalidate: props.revalidatePath,
      });
      if (res.ok && res.error)
        setMessage({ kind: "err", text: `Facture générée. Attention : ${res.error}` });
      else if (res.ok) setMessage({ kind: "ok", text: "Facture générée." });
      else setMessage({ kind: "err", text: res.error ?? "Erreur" });
    });
  }

  return (
    <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <h2 className="text-mocha mb-2 text-sm font-semibold">Facturation</h2>

      {message ? (
        <p
          role={message.kind === "ok" ? "status" : "alert"}
          aria-live="polite"
          className={`mb-3 text-xs ${message.kind === "ok" ? "text-success" : "text-terracotta"}`}
        >
          {message.text}
        </p>
      ) : null}

      {props.coachingContractId ? (
        <div className="mb-3">
          <button
            type="button"
            disabled={pending}
            onClick={genererFacture}
            className="border-border rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            Générer la facture
          </button>
        </div>
      ) : (
        <p className="text-fg-muted mb-3 text-xs">
          Aucun contrat de coaching rattaché : la facturation n&apos;est pas disponible pour ce
          parcours.
        </p>
      )}

      {/* Documents émis */}
      {props.documents.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {props.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between">
              <span>
                {DOC_LABELS[d.type] ?? d.type}{" "}
                <span className="text-fg-muted font-mono text-xs">{d.numero}</span>
              </span>
              {/* `pdfUrl` = témoin d'upload R2, pas cible : l'URL stockée est
                  pré-signée 900 s et périmée. Cf. `/api/qualiopi/documents/[id]`. */}
              {d.pdfUrl ? (
                <a
                  href={`/api/qualiopi/documents/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-terracotta text-xs hover:underline"
                >
                  PDF
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted text-sm">Aucun document émis.</p>
      )}
    </section>
  );
}
