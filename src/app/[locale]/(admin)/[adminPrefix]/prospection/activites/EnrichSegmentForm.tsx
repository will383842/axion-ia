"use client";
// use-client: déclenche l'enrichissement d'un segment (Server Action) + feedback.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrichProspectionSegment } from "@/server/actions/prospection/ops";

export function EnrichSegmentForm({
  departement,
  secteur,
}: {
  departement?: string;
  secteur?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [naf, setNaf] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      try {
        const { enqueued } = await enrichProspectionSegment({
          ...(departement ? { departement } : {}),
          ...(secteur ? { secteur } : {}),
          ...(naf ? { naf } : {}),
          onlyPending,
        });
        setMsg(
          `${enqueued.toLocaleString("fr-FR")} entreprise(s) mise(s) en file d’enrichissement.`,
        );
        router.refresh();
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <form onSubmit={submit} className="admin-toolbar" style={{ marginTop: "0.75rem" }}>
      <input
        placeholder="Code NAF (optionnel, ex. 71.11Z)"
        value={naf}
        onChange={(e) => setNaf(e.target.value)}
      />
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={onlyPending}
          onChange={(e) => setOnlyPending(e.target.checked)}
        />{" "}
        seulement les non enrichies
      </label>
      <button type="submit" className="admin-button-cta" disabled={isPending}>
        {isPending ? "En file…" : "Enrichir ce segment"}
      </button>
      {msg && (
        <span className="admin-muted" role="status">
          {msg}
        </span>
      )}
    </form>
  );
}
