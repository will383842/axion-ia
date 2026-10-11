"use client";
// use-client: formulaire de désistement — état local (ouvert, motif, remplaçant), transition serveur.

/**
 * « Je ne peux plus assurer cette mission » (lot L11h, écran F-15). Sans
 * pénalité ; le motif et le remplaçant sont facultatifs.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { seDesisterMissionAction } from "@/server/actions/qualiopi/choix-formateur";
import { DESISTEMENT } from "@/components/espace-formateur/mission-copy";

export function DesistementForm({ missionId }: { missionId: string }): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [remplacant, setRemplacant] = useState("");
  const [fait, setFait] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (fait) {
    return (
      <p
        role="status"
        className="text-mocha border-border rounded-lg border p-4 text-base font-semibold"
      >
        {DESISTEMENT.fait}
      </p>
    );
  }
  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="border-border text-mocha hover:bg-sand inline-flex min-h-[48px] w-full items-center justify-center rounded-md border px-5 text-sm font-semibold"
      >
        {DESISTEMENT.bouton}
      </button>
    );
  }
  function envoyer() {
    setErreur(null);
    startTransition(async () => {
      const r = await seDesisterMissionAction({
        missionId,
        ...(motif.trim() !== "" ? { motif: motif.trim() } : {}),
        ...(remplacant.trim() !== "" ? { remplacant: remplacant.trim() } : {}),
      });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setFait(true);
      router.refresh();
    });
  }
  return (
    <div className="border-border space-y-3 rounded-lg border p-4">
      <p className="text-mocha text-base font-semibold">{DESISTEMENT.bouton}</p>
      <label htmlFor="desistement-motif" className="text-mocha block text-sm font-medium">
        {DESISTEMENT.question} <span className="text-fg-muted">(facultatif)</span>
      </label>
      <textarea
        id="desistement-motif"
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        rows={2}
        maxLength={1400}
        disabled={isPending}
        className="border-border w-full rounded-md border px-3 py-2 text-sm"
      />
      <label htmlFor="desistement-remplacant" className="text-mocha block text-sm font-medium">
        {DESISTEMENT.remplacant} <span className="text-fg-muted">(facultatif)</span>
      </label>
      <input
        id="desistement-remplacant"
        type="text"
        value={remplacant}
        onChange={(e) => setRemplacant(e.target.value)}
        maxLength={500}
        disabled={isPending}
        className="border-border w-full rounded-md border px-3 py-2 text-sm"
      />
      {erreur !== null && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {erreur}
        </p>
      )}
      <button
        type="button"
        onClick={envoyer}
        disabled={isPending}
        className="bg-terracotta inline-flex min-h-[48px] w-full items-center justify-center rounded-md px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "…" : DESISTEMENT.envoyer}
      </button>
    </div>
  );
}
