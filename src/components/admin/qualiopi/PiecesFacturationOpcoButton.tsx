"use client";
// use-client: téléchargement du ZIP des pièces de facturation OPCO via useTransition + Server Action.

/**
 * PiecesFacturationOpcoButton — lot A8c.
 *
 * Sur la fiche d'une facture financée par un OPCO, télécharge la facture et ses
 * justificatifs en un ZIP : en subrogation, le paquet que l'organisme dépose
 * chez l'OPCO ; en remboursement, les pièces que l'entreprise présente à son
 * OPCO. Les pièces manquantes sont nommées, jamais simulées.
 *
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { telechargerPiecesFacturationOpcoAction } from "@/server/actions/qualiopi/pieces-facturation-opco";

function telechargerZip(base64: string, filename: string): void {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  const url = URL.createObjectURL(
    new Blob([octets.buffer as ArrayBuffer], { type: "application/zip" }),
  );
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = filename;
  lien.style.display = "none";
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

export function PiecesFacturationOpcoButton({
  factureId,
  circuit,
}: {
  factureId: string;
  circuit: "subrogation" | "remboursement";
}): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  function telecharger(): void {
    setMessage(null);
    startTransition(async () => {
      const res = await telechargerPiecesFacturationOpcoAction({ factureId });
      if ("error" in res) {
        setMessage({ ok: false, texte: res.error });
        return;
      }
      telechargerZip(res.data.base64, res.data.filename);
      setMessage({
        ok: res.data.manquantes.length === 0,
        texte:
          res.data.manquantes.length > 0
            ? `Pièces téléchargées — manquantes : ${res.data.manquantes.join(", ")}.`
            : "Pièces téléchargées — tout est joint.",
      });
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={telecharger}
        disabled={isPending}
        className="admin-button-ghost"
      >
        {isPending
          ? "Préparation…"
          : circuit === "subrogation"
            ? "Paquet de facturation OPCO (ZIP)"
            : "Pièces pour le remboursement OPCO (ZIP)"}
      </button>
      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {circuit === "subrogation"
          ? "Facture, certificat(s) de réalisation et feuille d'émargement à jour, à déposer chez l'OPCO."
          : "Facture, certificat(s) de réalisation et feuille d'émargement à jour, que l'entreprise présente à son OPCO."}
      </p>
      {message !== null && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`text-[length:var(--text-admin-sm)] ${message.ok ? "text-[color:var(--color-admin-fg)]" : "text-[color:var(--color-admin-error)]"}`}
        >
          {message.texte}
        </p>
      )}
    </div>
  );
}
