"use client";

// Les pièces d'un apporteur : ouvrir, puis « conforme » ou « à retransmettre » avec un motif.

import { useState, useTransition } from "react";

import { jugerPieceAction } from "@/features/apporteurs-reseau/actions-apporteurs";
import { LIBELLE_PIECE, MOTIFS_A_RETRANSMETTRE, type TypePiece } from "@/features/apporteurs-reseau/regles";

import { MessageRetour } from "./ApercuEmail";

export interface PieceAffichee {
  id: string;
  type: TypePiece;
  statut: "deposee" | "conforme" | "a_retransmettre";
  motif: string | null;
  nomFichier: string;
  deposeeLe: string;
  lienOuvrir: string | null;
}

const PASTILLE: Record<PieceAffichee["statut"], { texte: string; classe: string }> = {
  deposee: { texte: "À vérifier", classe: "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]" },
  conforme: { texte: "Conforme", classe: "bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]" },
  a_retransmettre: {
    texte: "À retransmettre",
    classe: "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]",
  },
};

function LignePiece({ apporteurId, piece, modifiable }: { apporteurId: string; piece: PieceAffichee; modifiable: boolean }) {
  const [motif, setMotif] = useState<string>(piece.motif ?? "illisible");
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const juger = (verdict: "conforme" | "a_retransmettre") =>
    demarrer(async () => {
      setRetour(await jugerPieceAction({ apporteurId, pieceId: piece.id, verdict, motif: verdict === "conforme" ? null : motif }));
    });
  const p = PASTILLE[piece.statut];
  return (
    <li className="flex flex-col gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-2)]">
        <div>
          <strong>{LIBELLE_PIECE[piece.type]}</strong>
          <div className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {piece.nomFichier} · déposée le {piece.deposeeLe}
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[length:var(--text-admin-sm)] font-semibold ${p.classe}`}>
          {p.texte}
          {piece.statut === "a_retransmettre" && piece.motif
            ? ` (${MOTIFS_A_RETRANSMETTRE.find((m) => m.valeur === piece.motif)?.libelle ?? piece.motif})`
            : ""}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        {piece.lienOuvrir ? (
          <a className="admin-button-secondary" href={piece.lienOuvrir} target="_blank" rel="noreferrer">
            Ouvrir
          </a>
        ) : (
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Fichier supprimé après vérification
          </span>
        )}
        {modifiable ? (
          <>
            <button type="button" className="admin-button" disabled={enCours} onClick={() => juger("conforme")}>
              Conforme
            </button>
            <select
              aria-label="Motif"
              className="admin-select"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              disabled={enCours}
            >
              {MOTIFS_A_RETRANSMETTRE.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {m.libelle}
                </option>
              ))}
            </select>
            <button type="button" className="admin-button-secondary" disabled={enCours} onClick={() => juger("a_retransmettre")}>
              À retransmettre
            </button>
          </>
        ) : null}
      </div>
      <MessageRetour retour={retour} />
    </li>
  );
}

export function PiecesVerification({
  apporteurId,
  pieces,
  modifiable,
}: {
  apporteurId: string;
  pieces: PieceAffichee[];
  modifiable: boolean;
}) {
  if (pieces.length === 0) {
    return <p className="text-[color:var(--color-admin-fg-muted)]">Aucune pièce déposée pour l'instant.</p>;
  }
  return (
    <ul className="flex flex-col gap-[var(--space-admin-2)]">
      {pieces.map((p) => (
        <LignePiece key={p.id} apporteurId={apporteurId} piece={p} modifiable={modifiable} />
      ))}
    </ul>
  );
}
