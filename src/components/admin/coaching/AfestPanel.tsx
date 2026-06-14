"use client";
// use-client: formulaire interactif (useState/useTransition) appelant les Server Actions AFEST.

/**
 * Coaching 1-to-1 — panneau AFEST (console admin Qualiopi).
 *
 * Cadrage AFEST (estAfest, heures prévues, tuteur) + génération des documents
 * légaux (protocole AFEST, attestation en heures). Appelle les Server Actions
 * `coaching-afest`. Affiche les heures réelles (Σ séances) et les documents émis.
 */

import { useState, useTransition } from "react";
import {
  setAfestCadrageAction,
  genererProtocoleAfestAction,
  genererAttestation1to1Action,
} from "@/server/actions/qualiopi/coaching-afest";

const DOC_LABELS: Record<string, string> = {
  protocole_afest: "Protocole AFEST",
  attestation: "Attestation de réalisation",
  attestation_partielle: "Attestation partielle",
};

export interface AfestPanelProps {
  coachingSessionId: string;
  revalidatePath: string;
  estAfest: boolean;
  heuresReelles: number;
  heuresPrevues: number | null;
  tuteurNom: string | null;
  tuteurEmail: string | null;
  attestationResultat: string | null;
  documents: ReadonlyArray<{ id: string; type: string; numero: string; pdfUrl: string | null }>;
}

export function AfestPanel(props: AfestPanelProps): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [estAfest, setEstAfest] = useState(props.estAfest);
  const [heuresPrevues, setHeuresPrevues] = useState(
    props.heuresPrevues != null ? String(props.heuresPrevues) : "",
  );
  const [tuteurNom, setTuteurNom] = useState(props.tuteurNom ?? "");
  const [tuteurEmail, setTuteurEmail] = useState(props.tuteurEmail ?? "");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      setMessage(
        res.ok ? { kind: "ok", text: okText } : { kind: "err", text: res.error ?? "Erreur" },
      );
    });
  }

  const inputCls =
    "border-border w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-1";

  return (
    <section className="border-border bg-cream rounded-lg border p-4">
      <h2 className="text-mocha mb-2 text-sm font-semibold">AFEST · documents légaux</h2>

      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <p>
          <span className="text-fg-muted">Heures réalisées (Σ séances) : </span>
          <span className="text-mocha font-medium">{props.heuresReelles} h</span>
        </p>
        <p>
          <span className="text-fg-muted">Heures prévues : </span>
          {props.heuresPrevues != null ? `${props.heuresPrevues} h` : "—"}
        </p>
        <p>
          <span className="text-fg-muted">Attestation : </span>
          {props.attestationResultat ?? "non émise"}
        </p>
      </div>

      {/* Cadrage AFEST */}
      <div className="border-border mb-3 space-y-2 border-t pt-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={estAfest}
            onChange={(e) => setEstAfest(e.target.checked)}
          />
          <span>Parcours cadré en AFEST (action de formation en situation de travail)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-fg-muted text-xs">
            Heures prévues (convention)
            <input
              type="number"
              min={0}
              step={0.5}
              value={heuresPrevues}
              onChange={(e) => setHeuresPrevues(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-fg-muted text-xs">
            Tuteur entreprise (nom)
            <input
              type="text"
              value={tuteurNom}
              onChange={(e) => setTuteurNom(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-fg-muted col-span-2 text-xs">
            Tuteur entreprise (email)
            <input
              type="email"
              value={tuteurEmail}
              onChange={(e) => setTuteurEmail(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                setAfestCadrageAction({
                  coachingSessionId: props.coachingSessionId,
                  estAfest,
                  ...(heuresPrevues !== ""
                    ? { heuresPrevuesConvention: Number(heuresPrevues) }
                    : {}),
                  tuteurEntrepriseNom: tuteurNom,
                  tuteurEntrepriseEmail: tuteurEmail,
                  revalidate: props.revalidatePath,
                }),
              "Cadrage AFEST enregistré.",
            )
          }
          className="bg-terracotta rounded-md px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Enregistrer le cadrage
        </button>
      </div>

      {/* Génération de documents */}
      <div className="border-border mb-3 flex flex-wrap gap-2 border-t pt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                genererProtocoleAfestAction({
                  coachingSessionId: props.coachingSessionId,
                  revalidate: props.revalidatePath,
                }),
              "Protocole AFEST généré.",
            )
          }
          className="border-border rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
        >
          Générer le protocole AFEST
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                genererAttestation1to1Action({
                  coachingSessionId: props.coachingSessionId,
                  force: true,
                  revalidate: props.revalidatePath,
                }),
              "Attestation générée.",
            )
          }
          className="border-border rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
        >
          {"Générer l'attestation en heures"}
        </button>
      </div>

      {message ? (
        <p className={`mb-2 text-xs ${message.kind === "ok" ? "text-success" : "text-terracotta"}`}>
          {message.text}
        </p>
      ) : null}

      {/* Documents émis */}
      {props.documents.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {props.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between">
              <span>
                {DOC_LABELS[d.type] ?? d.type}{" "}
                <span className="text-fg-muted font-mono text-xs">{d.numero}</span>
              </span>
              {d.pdfUrl ? (
                <a
                  href={d.pdfUrl}
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
        <p className="text-fg-muted text-sm">Aucun document AFEST émis.</p>
      )}
    </section>
  );
}
