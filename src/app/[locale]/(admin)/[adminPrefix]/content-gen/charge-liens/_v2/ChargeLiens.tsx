// use-client: état local des occasions + presse-papiers pour copier le message validé.
"use client";

import { useState, useTransition } from "react";
import {
  ecarterOccasionLien,
  validerOccasionLien,
} from "@/server/actions/content-gen/charge-liens";
import type { ArticleAvecOccasions } from "@/server/content-gen/equipe/charge-de-liens-donnees";

const ETATS = { proposee: "Proposée", validee: "Validée", ecartee: "Écartée" } as const;

export function ChargeLiens({ articles }: { articles: ArticleAvecOccasions[] }) {
  const [liste, setListe] = useState(articles);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decider(jobId: string, occasionId: string, valider: boolean) {
    setInfo(null);
    startTransition(async () => {
      const res = await (valider ? validerOccasionLien : ecarterOccasionLien)({
        jobId,
        occasionId,
      });
      if (!res.ok) {
        setInfo(res.message);
        return;
      }
      if (valider) {
        try {
          await navigator.clipboard.writeText(res.message);
          setInfo("Occasion validée ; message copié. Aucun e-mail n'a été envoyé.");
        } catch {
          setInfo("Occasion validée ; copie impossible, sélectionnez le message à la main.");
        }
      }
      setListe((l) =>
        l.map((a) =>
          a.jobId !== jobId
            ? a
            : {
                ...a,
                occasions: a.occasions.map((o) =>
                  o.id === occasionId ? { ...o, etat: valider ? "validee" : "ecartee" } : o,
                ),
              },
        ),
      );
    });
  }

  if (liste.length === 0) return <p>Aucune occasion proposée pour le moment.</p>;
  return (
    <div className="space-y-8">
      {info ? <p role="status">{info}</p> : null}
      {liste.map((a) => (
        <section key={a.jobId}>
          <h2 className="text-lg font-semibold">{a.titre}</h2>
          <ul className="mt-3 space-y-4">
            {a.occasions.map((o) => (
              <li key={o.id} className="rounded border p-4">
                <p>
                  <strong>{o.cible}</strong> — {o.type} — {ETATS[o.etat]}
                </p>
                <p>
                  <a href={o.url} target="_blank" rel="noopener noreferrer">
                    {o.url}
                  </a>
                </p>
                <p className="mt-2 whitespace-pre-wrap">{o.message}</p>
                {o.etat === "proposee" ? (
                  <div className="mt-3 flex gap-2">
                    <button disabled={pending} onClick={() => decider(a.jobId, o.id, true)}>
                      Valider
                    </button>
                    <button disabled={pending} onClick={() => decider(a.jobId, o.id, false)}>
                      Écarter
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
